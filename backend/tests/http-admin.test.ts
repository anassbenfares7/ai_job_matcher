import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";

const BASE_ENV = {
  DATABASE_URL: "postgresql://test:test@localhost:5432/testdb",
  GEMINI_API_KEY: "test-gemini-key",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  JWT_SECRET: "test-jwt-secret",
  ADMIN_EMAIL: "admin@example.com",
  PORT: "5000",
  NODE_ENV: "test",
};

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const mockDbQuery = vi.fn();

Object.assign(process.env, BASE_ENV);

vi.mock("../src/config/database.js", () => ({
  db: {
    query: mockDbQuery,
  },
}));

describe("HTTP admin routes", () => {
  beforeEach(() => {
    mockDbQuery.mockReset();
    Object.assign(process.env, BASE_ENV);
  });

  const tokenFor = async (id: string, email: string) => {
    const jwt = await import("jsonwebtoken");
    return jwt.sign({ id, email }, BASE_ENV.JWT_SECRET, { expiresIn: "1h" });
  };

  it("allows CORS preflight for account suspension updates", async () => {
    const { default: app } = await import("../src/app.js");

    const res = await request(app)
      .options(`/api/admin/users/${USER_ID}/suspension`)
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "PATCH")
      .set("Access-Control-Request-Headers", "authorization,content-type");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-methods"]).toContain("PATCH");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("denies admin endpoints to authenticated non-admin users", async () => {
    const { default: app } = await import("../src/app.js");
    const token = await tokenFor(USER_ID, "user@example.com");
    mockDbQuery.mockResolvedValueOnce({
      rows: [{ email: "user@example.com", is_approved: true, is_suspended: false }],
    } as any);

    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("You do not have permission to access this page.");
    expect(mockDbQuery).toHaveBeenCalledTimes(1);
  });

  it("returns paginated users and their latest parsed resume profile to the admin", async () => {
    const { default: app } = await import("../src/app.js");
    const token = await tokenFor(ADMIN_ID, "ADMIN@example.com");
    mockDbQuery
      .mockResolvedValueOnce({
        rows: [{ email: "admin@example.com", is_approved: true, is_suspended: false }],
      } as any)
      .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any)
      .mockResolvedValueOnce({
        rows: [
          {
            id: USER_ID,
            email: "user@example.com",
            is_approved: true,
            is_suspended: false,
            created_at: "2026-01-01T00:00:00.000Z",
            resume_id: "resume-1",
            resume_created_at: "2026-02-01T00:00:00.000Z",
            resume_profile: { fullName: "Example User", skills: ["TypeScript"] },
          },
        ],
      } as any);

    const res = await request(app)
      .get("/api/admin/users?page=1&search=example")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 1,
      users: [
        {
          id: USER_ID,
          email: "user@example.com",
          isApproved: true,
          isSuspended: false,
          resume: {
            id: "resume-1",
            profile: { fullName: "Example User", skills: ["TypeScript"] },
          },
        },
      ],
    });
    expect(res.body.data.users[0].resume.rawText).toBeUndefined();
  });

  it("prevents the admin from deleting their own account", async () => {
    const { default: app } = await import("../src/app.js");
    const token = await tokenFor(ADMIN_ID, "admin@example.com");
    mockDbQuery.mockResolvedValueOnce({
      rows: [{ email: "admin@example.com", is_approved: true, is_suspended: false }],
    } as any);

    const res = await request(app)
      .delete(`/api/admin/users/${ADMIN_ID}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(mockDbQuery).toHaveBeenCalledTimes(1);
  });
});
