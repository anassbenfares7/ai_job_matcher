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
  parseResumeText: vi.fn(),
  generateEmbedding: vi.fn(),
}));

describe("HTTP resume routes", () => {
  beforeEach(() => {
    mockDbQuery.mockReset();
    Object.assign(process.env, BASE_ENV);
    vi.clearAllMocks();
  });

  it("rejects upload without authentication", async () => {
    const { default: app } = await import("../src/app.js");

    const res = await request(app)
      .post("/api/resumes/upload")
      .attach("resume", Buffer.from("fake-pdf-content"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      status: "error",
      message:
        "Authentication failed. Missing or malformed token access header.",
    });
  });

  it("rejects upload when no file is attached", async () => {
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
      .post("/api/resumes/upload")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      status: "error",
      message:
        'Payload unfulfilled. Please attach a valid PDF document under the field key "resume".',
    });
  });

  it("uploads and parses a valid PDF resume successfully", async () => {
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

    vi.mocked(ai.parseResumeText).mockResolvedValue({
      fullName: "Test User",
      summary: "Full stack developer",
      skills: ["TypeScript", "Node.js"],
      education: [{ degree: "BSc", institution: "UI", year: "2020" }],
      experience: [
        {
          role: "Developer",
          company: "Acme",
          duration: "2020-2024",
          description: "Built apps",
        },
      ],
    });

    vi.mocked(ai.generateEmbedding).mockResolvedValue(
      Array.from({ length: 768 }, () => 0.1),
    );

    mockDbQuery.mockResolvedValueOnce({
      rows: [
        { id: "resume-1", created_at: "2025-01-01T00:00:00.000Z" },
      ],
    } as any);

    const res = await request(app)
      .post("/api/resumes/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("resume", Buffer.from("fake-pdf-content"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.data.resumeId).toBe("resume-1");
    expect(res.body.data.parsedProfile.fullName).toBe("Test User");
  });
});
