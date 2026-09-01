import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response } from "express";

const makeMockRes = () => {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };

  return res as Response;
};

describe("semantic match flows", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env.JWT_SECRET = "test-jwt-secret";
  });

  it("returns an empty list when the user has no uploaded resume", async () => {
    const { db } = await import("../src/config/database.js");
    const { getSemanticMatches } = await import("../src/controllers/match.controller.js");

    vi.spyOn(db, "query").mockResolvedValueOnce({ rows: [] } as any);

    const req = { user: { id: "11111111-1111-4111-8111-111111111111" } } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await getSemanticMatches(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      message: "No active profile found. Please upload a CV first to activate semantic job matching.",
      data: [],
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns ranked matches when a resume embedding exists", async () => {
    const { db } = await import("../src/config/database.js");
    const { getSemanticMatches } = await import("../src/controllers/match.controller.js");

    vi.spyOn(db, "query")
      .mockResolvedValueOnce({
        rows: [{ embedding: "[0.1,0.2,0.3]" }],
      } as any)
      .mockResolvedValueOnce({
        rows: [
          {
            id: "job-1",
            title: "Frontend Engineer",
            company: "MoroccoTech",
            location: "Casablanca",
            description: "Build React apps",
            match_score: "0.82",
          },
          {
            id: "job-2",
            title: "Backend Engineer",
            company: "Codeline",
            location: "Rabat",
            description: "Build APIs",
            match_score: "0.65",
          },
        ],
      } as any);

    const req = { user: { id: "11111111-1111-4111-8111-111111111111" } } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await getSemanticMatches(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        data: [
          expect.objectContaining({
            id: "job-1",
            title: "Frontend Engineer",
            matchPercentage: 82,
          }),
          expect.objectContaining({
            id: "job-2",
            title: "Backend Engineer",
            matchPercentage: 65,
          }),
        ],
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects requests without an authenticated user", async () => {
    const { getSemanticMatches } = await import("../src/controllers/match.controller.js");

    const req = { user: undefined } as any;
    const res = makeMockRes();
    const next = vi.fn();

    await getSemanticMatches(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      status: "error",
      message: "Unauthorized execution context. Missing user identifier session markers.",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
