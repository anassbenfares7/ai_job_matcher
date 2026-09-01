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

vi.mock("../src/services/ai.service.js", () => ({
  generateApplicationMaterials: vi.fn(),
}));

describe("HTTP material routes", () => {
  beforeEach(() => {
    mockDbQuery.mockReset();
    Object.assign(process.env, BASE_ENV);
    vi.clearAllMocks();
  });

  it("rejects generation request without authentication", async () => {
    const { default: app } = await import("../src/app.js");

    const res = await request(app)
      .post("/api/materials/generate")
      .send({ jobId: "job-123" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      status: "error",
      message:
        "Authentication failed. Missing or malformed token access header.",
    });
  });

  it("rejects generation when jobId is missing", async () => {
    const { default: app } = await import("../src/app.js");
    const jwt = await import("jsonwebtoken");

    const token = jwt.sign(
      {
        id: "11111111-1111-4111-8111-111111111111",
        email: "test@example.com",
      },
      "test-jwt-secret",
      { expiresIn: "1h" },
    );

    const res = await request(app)
      .post("/api/materials/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      status: "error",
      message: "Payload unfulfilled. Missing target jobId parameter.",
    });
  });

  it("returns cached materials on cache hit", async () => {
    const { default: app } = await import("../src/app.js");
    const jwt = await import("jsonwebtoken");

    const token = jwt.sign(
      {
        id: "11111111-1111-4111-8111-111111111111",
        email: "test@example.com",
      },
      "test-jwt-secret",
      { expiresIn: "1h" },
    );

    // Mock: Cached materials found
    mockDbQuery.mockResolvedValueOnce({
      rows: [
        {
          match_score: 0.92,
          generated_cover_letter: "Dear Hiring Manager...",
          generated_feedback: "Strong background match",
        },
      ],
    } as any);

    const res = await request(app)
      .post("/api/materials/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ jobId: "job-456" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: "success",
      message:
        "Tailored application materials retrieved successfully from local cache.",
      data: {
        matchScore: 0.92,
        coverLetter: "Dear Hiring Manager...",
        feedback: "Strong background match",
      },
    });
  });

  it("generates materials when cache misses and returns 201", async () => {
    const { default: app } = await import("../src/app.js");
    const jwt = await import("jsonwebtoken");
    const ai = await import("../src/services/ai.service.js");

    const token = jwt.sign(
      {
        id: "11111111-1111-4111-8111-111111111111",
        email: "test@example.com",
      },
      "test-jwt-secret",
      { expiresIn: "1h" },
    );

    // Mock: No cached materials
    mockDbQuery.mockResolvedValueOnce({ rows: [] } as any);

    // Mock: Job data found
    mockDbQuery.mockResolvedValueOnce({
      rows: [
        {
          title: "Senior Engineer",
          company: "TechCorp",
          description: "Build scalable systems",
        },
      ],
    } as any);

    // Mock: Resume found
    mockDbQuery.mockResolvedValueOnce({
      rows: [
        {
          structured_data: {
            fullName: "Test User",
            skills: ["TypeScript", "Node.js"],
          },
        },
      ],
    } as any);

    // Mock: AI generation
    vi.mocked(ai.generateApplicationMaterials).mockResolvedValueOnce({
      coverLetter: "Generated cover letter content",
      feedback: "Generated feedback on fit",
    });

    // Mock: DB insert/update
    mockDbQuery.mockResolvedValueOnce({} as any);

    const res = await request(app)
      .post("/api/materials/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ jobId: "job-789" });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.data.coverLetter).toBe(
      "Generated cover letter content",
    );
    expect(res.body.data.feedback).toBe("Generated feedback on fit");
    expect(res.body.data.matchScore).toBe(0.75); // Fallback score
  });

  it("returns 404 when job posting not found", async () => {
    const { default: app } = await import("../src/app.js");
    const jwt = await import("jsonwebtoken");

    const token = jwt.sign(
      {
        id: "11111111-1111-4111-8111-111111111111",
        email: "test@example.com",
      },
      "test-jwt-secret",
      { expiresIn: "1h" },
    );

    // Mock: No cached materials
    mockDbQuery.mockResolvedValueOnce({ rows: [] } as any);

    // Mock: Job not found
    mockDbQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post("/api/materials/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ jobId: "nonexistent-job" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      status: "error",
      message: "The targeted job posting could not be found.",
    });
  });

  it("returns 400 when user has no resume", async () => {
    const { default: app } = await import("../src/app.js");
    const jwt = await import("jsonwebtoken");

    const token = jwt.sign(
      {
        id: "11111111-1111-4111-8111-111111111111",
        email: "test@example.com",
      },
      "test-jwt-secret",
      { expiresIn: "1h" },
    );

    // Mock: No cached materials
    mockDbQuery.mockResolvedValueOnce({ rows: [] } as any);

    // Mock: Job found
    mockDbQuery.mockResolvedValueOnce({
      rows: [
        {
          title: "Senior Engineer",
          company: "TechCorp",
          description: "Build scalable systems",
        },
      ],
    } as any);

    // Mock: No resume found
    mockDbQuery.mockResolvedValueOnce({ rows: [] } as any);

    const res = await request(app)
      .post("/api/materials/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ jobId: "job-xyz" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      status: "error",
      message:
        "Generation aborted. Please upload a CV profile before generating tailored content.",
    });
  });
});
