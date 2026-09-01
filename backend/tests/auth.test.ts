import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response } from "express";
import jwt from "jsonwebtoken";

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
    vi.resetAllMocks();
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
    const { requireAuth } = await import("../src/middleware/auth.js");
    const token = jwt.sign(
      { id: "user-123", email: "test@example.com" },
      "test-jwt-secret",
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
