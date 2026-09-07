import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

vi.mock("../src/services/email.service.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

const BASE_ENV = {
  DATABASE_URL: "postgresql://test:test@localhost:5432/testdb",
  GEMINI_API_KEY: "test-gemini-key",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  JWT_SECRET: "test-jwt-secret",
  PORT: "5000",
  NODE_ENV: "test",
};

Object.assign(process.env, BASE_ENV);

const makeMockRes = () => {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };

  return res as Response;
};

describe("auth core flows", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    Object.assign(process.env, BASE_ENV);
  });

  it("rejects a request without a bearer token", async () => {
    const { requireAuth } = await import("../src/middleware/auth.js");
    const req = { headers: {} } as any;
    const res = makeMockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      status: "error",
      message:
        "Authentication failed. Missing or malformed token access header.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects invalid JWT payloads", async () => {
    const { requireAuth } = await import("../src/middleware/auth.js");
    const req = {
      headers: { authorization: "Bearer invalid.token.here" },
    } as any;
    const res = makeMockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts a valid bearer token and attaches the user to the request", async () => {
    const secret = process.env.JWT_SECRET as string;
    const { requireAuth } = await import("../src/middleware/auth.js");
    const token = jwt.sign(
      { id: "user-123", email: "test@example.com" },
      secret,
      { expiresIn: "1h" },
    );
    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as any;
    const res = makeMockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(req.user).toEqual({
      id: "user-123",
      email: "test@example.com",
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("auth controller flows", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    Object.assign(process.env, BASE_ENV);
  });

  it("rejects invalid registration payloads", async () => {
    const { registerUser } = await import("../src/controllers/auth.controller.js");
    const req = { body: { email: "bad-email", password: "123" } } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await registerUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: "error",
      message:
        "Invalid payload. Please provide a valid email address and password.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("registers a new user without returning a session token", async () => {
    const { db } = await import("../src/config/database.js");
    const { registerUser } = await import("../src/controllers/auth.controller.js");
    const querySpy = vi.spyOn(db, "query");
    querySpy
      .mockResolvedValueOnce({ rows: [] } as any) // no existing account
      .mockResolvedValueOnce({ rows: [] } as any); // insert

    const req = {
      body: { email: "test@example.com", password: "secret123" },
    } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await registerUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];
    expect(payload.status).toBe("success");
    // No token / user payload — the account must be verified first.
    expect(payload.data).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  it("does not reveal whether an email is already registered", async () => {
    const { db } = await import("../src/config/database.js");
    const { registerUser } = await import("../src/controllers/auth.controller.js");
    vi.spyOn(db, "query")
      .mockResolvedValueOnce({
        rows: [{ id: "u1", email_verified: true, email_verification_sent_at: null }],
      } as any);

    const req = {
      body: { email: "taken@example.com", password: "secret123" },
    } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await registerUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].status).toBe("success");
  });

  it("logs in an existing verified user with a valid password", async () => {
    const { db } = await import("../src/config/database.js");
    const { loginUser } = await import("../src/controllers/auth.controller.js");
    const passwordHash = await bcrypt.hash("secret123", 12);
    vi.spyOn(db, "query").mockResolvedValueOnce({
      rows: [
        {
          id: "user-123",
          email: "test@example.com",
          password_hash: passwordHash,
          email_verified: true,
          created_at: "2025-01-01T00:00:00.000Z",
        },
      ],
    } as any);

    const req = {
      body: { email: "test@example.com", password: "secret123" },
    } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await loginUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        data: expect.objectContaining({
          user: expect.objectContaining({ email: "test@example.com" }),
        }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects login when the password is wrong", async () => {
    const { db } = await import("../src/config/database.js");
    const { loginUser } = await import("../src/controllers/auth.controller.js");
    const passwordHash = await bcrypt.hash("correctpassword", 12);
    vi.spyOn(db, "query").mockResolvedValueOnce({
      rows: [
        {
          id: "user-123",
          email: "test@example.com",
          password_hash: passwordHash,
          created_at: "2025-01-01T00:00:00.000Z",
        },
      ],
    } as any);

    const req = {
      body: { email: "test@example.com", password: "wrongpassword" },
    } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await loginUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      status: "error",
      message: "Authentication failed. Invalid email address or credentials.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks login for a correct password on an unverified account", async () => {
    const { db } = await import("../src/config/database.js");
    const { loginUser } = await import("../src/controllers/auth.controller.js");
    const passwordHash = await bcrypt.hash("secret123", 12);
    vi.spyOn(db, "query").mockResolvedValueOnce({
      rows: [
        {
          id: "user-123",
          email: "test@example.com",
          password_hash: passwordHash,
          email_verified: false,
          created_at: "2025-01-01T00:00:00.000Z",
        },
      ],
    } as any);

    const req = {
      body: { email: "test@example.com", password: "secret123" },
    } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await loginUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].code).toBe("EMAIL_NOT_VERIFIED");
    expect(next).not.toHaveBeenCalled();
  });
});

describe("email verification flows", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    Object.assign(process.env, BASE_ENV);
  });

  it("verifies a fresh token and hands back a session token", async () => {
    const { db } = await import("../src/config/database.js");
    const { verifyEmail } = await import("../src/controllers/auth.controller.js");
    vi.spyOn(db, "query")
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-123",
            email: "test@example.com",
            email_verified: false,
            email_verification_sent_at: new Date().toISOString(),
            created_at: "2025-01-01T00:00:00.000Z",
          },
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any); // UPDATE

    const req = { body: { token: "a".repeat(64) } } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await verifyEmail(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.token).toBeTypeOf("string");
  });

  it("rejects an unknown verification token", async () => {
    const { db } = await import("../src/config/database.js");
    const { verifyEmail } = await import("../src/controllers/auth.controller.js");
    vi.spyOn(db, "query").mockResolvedValueOnce({ rows: [] } as any);

    const req = { body: { token: "does-not-exist" } } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await verifyEmail(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects an expired verification token", async () => {
    const { db } = await import("../src/config/database.js");
    const { verifyEmail } = await import("../src/controllers/auth.controller.js");
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    vi.spyOn(db, "query").mockResolvedValueOnce({
      rows: [
        {
          id: "user-123",
          email: "test@example.com",
          email_verified: false,
          email_verification_sent_at: stale,
          created_at: "2025-01-01T00:00:00.000Z",
        },
      ],
    } as any);

    const req = { body: { token: "a".repeat(64) } } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await verifyEmail(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe("TOKEN_EXPIRED");
  });

  it("resend-verification always responds the same way", async () => {
    const { db } = await import("../src/config/database.js");
    const { resendVerification } = await import("../src/controllers/auth.controller.js");
    vi.spyOn(db, "query").mockResolvedValueOnce({ rows: [] } as any);

    const req = { body: { email: "nobody@example.com" } } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await resendVerification(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].status).toBe("success");
  });
});
