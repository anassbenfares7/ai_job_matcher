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

describe("HTTP match routes", () => {
  beforeEach(() => {
    mockDbQuery.mockReset();
    Object.assign(process.env, BASE_ENV);
    vi.clearAllMocks();
  });

  it("rejects match request without authentication", async () => {
    const { default: app } = await import("../src/app.js");

    const res = await request(app).get("/api/matches");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      status: "error",
      message: "Authentication failed. Missing or malformed token access header.",
    });
  });

  it("returns empty state when user has no resume", async () => {
    const { default: app } = await import("../src/app.js");
    const jwt = await import("jsonwebtoken");

    const token = jwt.sign(
      { id: "11111111-1111-4111-8111-111111111111", email: "test@example.com" },
      "test-jwt-secret",
      { expiresIn: "1h" },
    );

    // Mock: No resume found
    mockDbQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .get("/api/matches")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: "success",
      message: "No active profile found. Please upload a CV first to activate semantic job matching.",
      data: [],
    });
  });

  it("returns ranked job matches when resume exists", async () => {
    const { default: app } = await import("../src/app.js");
    const jwt = await import("jsonwebtoken");

    const token = jwt.sign(
      { id: "11111111-1111-4111-8111-111111111111", email: "test@example.com" },
      "test-jwt-secret",
      { expiresIn: "1h" },
    );

    // Mock: Resume exists
    mockDbQuery.mockResolvedValueOnce({
      rows: [{ embedding: Array.from({ length: 768 }, () => 0.1) }],
    } as any);

    // Mock: Job matches
    mockDbQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "job-1",
          title: "Senior TypeScript Engineer",
          company: "TechCorp",
          location: "Remote",
          description: "Build scalable web apps",
          match_score: 0.95,
        },
        {
          id: "job-2",
          title: "Full Stack Developer",
          company: "StartupXYZ",
          location: "Casablanca",
          description: "Work on our AI platform",
          match_score: 0.87,
        },
      ],
    } as any);

    const res = await request(app)
      .get("/api/matches")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toEqual({
      id: "job-1",
      title: "Senior TypeScript Engineer",
      company: "TechCorp",
      location: "Remote",
      description: "Build scalable web apps",
      matchPercentage: 95,
    });
    expect(res.body.data[1].matchPercentage).toBe(87);
  });
});
