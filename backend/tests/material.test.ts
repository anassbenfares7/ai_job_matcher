import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response } from "express";

const makeMockRes = () => {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };

  return res as Response;
};

describe("material generation flows", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env.JWT_SECRET = "test-jwt-secret";
  });

  it("returns cached materials when they already exist", async () => {
    const { db } = await import("../src/config/database.js");
    const { getOrGenerateMaterials } =
      await import("../src/controllers/material.controller.js");

    vi.spyOn(db, "query").mockResolvedValueOnce({
      rows: [
        {
          match_score: 0.82,
          generated_cover_letter: "Cached cover letter",
          generated_feedback: "Cached feedback",
        },
      ],
    } as any);

    const req = {
      body: { jobId: "11111111-1111-4111-8111-111111111111" },
      user: { id: "22222222-2222-4222-8222-222222222222" },
    } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await getOrGenerateMaterials(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      message:
        "Tailored application materials retrieved successfully from local cache.",
      data: {
        matchScore: 0.82,
        coverLetter: "Cached cover letter",
        feedback: "Cached feedback",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("generates and stores materials for a valid job and resume", async () => {
    const { db } = await import("../src/config/database.js");
    const { getOrGenerateMaterials } =
      await import("../src/controllers/material.controller.js");
    const ai = await import("../src/services/ai.service.js");

    vi.spyOn(db, "query")
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({
        rows: [
          {
            title: "Frontend Engineer",
            company: "MoroccoTech",
            description: "Build UI with React",
          },
        ],
      } as any)
      .mockResolvedValueOnce({
        rows: [
          {
            structured_data: {
              fullName: "Test User",
              skills: ["TypeScript"],
              experience: [],
            },
          },
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    vi.spyOn(ai, "generateApplicationMaterials").mockResolvedValue({
      coverLetter: "Generated cover letter",
      feedback: "Generated feedback",
    });

    const req = {
      body: { jobId: "11111111-1111-4111-8111-111111111111" },
      user: { id: "22222222-2222-4222-8222-222222222222" },
    } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await getOrGenerateMaterials(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        data: expect.objectContaining({
          coverLetter: "Generated cover letter",
          feedback: "Generated feedback",
        }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects generation when the job id is missing", async () => {
    const { getOrGenerateMaterials } =
      await import("../src/controllers/material.controller.js");

    const req = {
      body: {},
      user: { id: "22222222-2222-4222-8222-222222222222" },
    } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await getOrGenerateMaterials(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: "error",
      message: "Payload unfulfilled. Missing target jobId parameter.",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
