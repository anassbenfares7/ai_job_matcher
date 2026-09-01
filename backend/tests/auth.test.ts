import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

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

  it("registers a new user and returns a usable JWT", async () => {
    const { db } = await import("../src/config/database.js");
    const { registerUser } = await import("../src/controllers/auth.controller.js");
    const querySpy = vi.spyOn(db, "query");
    querySpy
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({
        rows: [{ id: "user-123", email: "test@example.com", created_at: "2025-01-01T00:00:00.000Z" }],
      } as any);

    const req = {
      body: { email: "test@example.com", password: "secret123" },
    } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await registerUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        data: expect.objectContaining({
          user: expect.objectContaining({
            id: "user-123",
            email: "test@example.com",
          }),
        }),
      }),
    );

    const payload = res.json.mock.calls[0][0];
    expect(payload.data.token).toBeTypeOf("string");
    expect(next).not.toHaveBeenCalled();
  });

  it("logs in an existing user with a valid password", async () => {
    const { db } = await import("../src/config/database.js");
    const { loginUser } = await import("../src/controllers/auth.controller.js");
    const passwordHash = await bcrypt.hash("secret123", 12);
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
});
