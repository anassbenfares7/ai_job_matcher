import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response } from "express";
import { db } from "../src/config/database.js";

const makeMockRes = () => {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };

  return res as Response;
};

describe("resume upload flows", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env.JWT_SECRET = "test-jwt-secret";
  });

  it("rejects upload when no PDF file is attached", async () => {
    const { uploadAndParseResume } = await import("../src/controllers/resume.controller.js");
    const req = { file: undefined, user: { id: "user-123" } } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await uploadAndParseResume(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: "error",
      message:
        "Payload unfulfilled. Please attach a valid PDF document under the field key \"resume\".",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects upload when the user is missing from the request", async () => {
    const { uploadAndParseResume } = await import("../src/controllers/resume.controller.js");
    const req = { file: { buffer: Buffer.from("pdf-content") }, user: undefined } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await uploadAndParseResume(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      status: "error",
      message: "Unauthorized execution context. Missing user identifier session markers.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("parses and stores a valid resume payload successfully", async () => {
    const { uploadAndParseResume } = await import("../src/controllers/resume.controller.js");
    const { parseResumeText, generateEmbedding } = await import("../src/services/ai.service.js");

    vi.spyOn(await import("../src/services/ai.service.js"), "parseResumeText").mockResolvedValue({
      fullName: "Test User",
      summary: "Full stack developer",
      skills: ["TypeScript", "Node.js"],
      education: [{ degree: "BSc", institution: "UI", year: "2020" }],
      experience: [{ role: "Developer", company: "Acme", duration: "2020-2024", description: "Built apps" }],
    });

    vi.spyOn(await import("../src/services/ai.service.js"), "generateEmbedding").mockResolvedValue(
      Array.from({ length: 768 }, () => 0.1),
    );

    vi.spyOn(db, "query").mockResolvedValueOnce({
      rows: [{ id: "resume-1", created_at: "2025-01-01T00:00:00.000Z" }],
    } as any);

    const req = {
      file: { buffer: Buffer.from("fake-pdf") },
      user: { id: "user-123" },
    } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await uploadAndParseResume(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        data: expect.objectContaining({
          resumeId: "resume-1",
          parsedProfile: expect.objectContaining({ fullName: "Test User" }),
        }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});
