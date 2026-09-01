import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";

const BASE_ENV = {
  DATABASE_URL: "postgresql://test:test@localhost:5432/testdb",
  GEMINI_API_KEY: "test-gemini-key",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  JWT_SECRET: "test-jwt-secret",
  PORT: "5000",
  NODE_ENV: "test",
};

const mockDbQuery = vi.fn();

Object.assign(process.env, BASE_ENV);

vi.mock("../src/config/database.js", () => ({
  db: {
    query: mockDbQuery,
  },
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    async verifyIdToken(options: any) {
      return {
        getPayload: () => ({
          email: "test@gmail.com",
          sub: "google-id-123",
        }),
      };
    }
  },
}));

describe("HTTP auth routes", () => {
  beforeEach(() => {
    mockDbQuery.mockReset();
    Object.assign(process.env, BASE_ENV);
  });

  it("rejects invalid register payloads at the HTTP layer", async () => {
    const { default: app } = await import("../src/app.js");

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "bad-email", password: "123" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      status: "error",
      message:
        "Invalid payload. Please provide a valid email address and password.",
    });
  });

  it("registers a user and returns a token over HTTP", async () => {
    const { default: app } = await import("../src/app.js");

    mockDbQuery
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-123",
            email: "test@example.com",
            created_at: "2025-01-01T00:00:00.000Z",
          },
        ],
      } as any);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@example.com", password: "secret123" });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe("test@example.com");
  });

  it("logs in an existing user through the HTTP layer", async () => {
    const { default: app } = await import("../src/app.js");
    const bcrypt = await import("bcrypt");

    const passwordHash = await bcrypt.hash("secret123", 12);
    mockDbQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "user-123",
          email: "test@example.com",
          password_hash: passwordHash,
          created_at: "2025-01-01T00:00:00.000Z",
        },
      ],
    } as any);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "secret123" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe("test@example.com");
  });

  it("rejects wrong login credentials over HTTP", async () => {
    const { default: app } = await import("../src/app.js");
    const bcrypt = await import("bcrypt");

    const passwordHash = await bcrypt.hash("correctpassword", 12);
    mockDbQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "user-123",
          email: "test@example.com",
          password_hash: passwordHash,
          created_at: "2025-01-01T00:00:00.000Z",
        },
      ],
    } as any);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      status: "error",
      message:
        "Authentication failed. Invalid email address or credentials.",
    });
  });

  it("rejects Google sign-in with missing idToken", async () => {
    const { default: app } = await import("../src/app.js");

    const res = await request(app).post("/api/auth/google").send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      status: "error",
      message:
        "Invalid signature request. Missing Google idToken payload parameters.",
    });
  });

  it("validates Google token and creates new user", async () => {
    const { default: app } = await import("../src/app.js");

    // Mock: No existing user
    mockDbQuery.mockResolvedValueOnce({ rows: [] } as any);
    // Mock: Insert new user
    mockDbQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "user-google-123",
          email: "newuser@gmail.com",
          created_at: "2025-01-01T00:00:00.000Z",
        },
      ],
    } as any);

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "valid-google-token" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe("newuser@gmail.com");
  });

  it("validates Google token and returns existing user", async () => {
    const { default: app } = await import("../src/app.js");

    // Mock: Existing user found
    mockDbQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "user-existing-456",
          email: "test@gmail.com",
          created_at: "2024-12-01T00:00:00.000Z",
        },
      ],
    } as any);

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "valid-google-token" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe("test@gmail.com");
  });
});
