import { NextResponse } from "next/server";
import { verifyTool } from "@/lib/genlayer";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      repository,
      commitSha,
      claimedPurpose,
      declaredCapabilities,
    } = body ?? {};

    if (typeof repository !== "string" || !repository.trim()) {
      return NextResponse.json(
        { error: "Repository is required." },
        { status: 400 },
      );
    }

    if (typeof commitSha !== "string" || !commitSha.trim()) {
      return NextResponse.json(
        { error: "Commit SHA is required." },
        { status: 400 },
      );
    }

    if (
      typeof claimedPurpose !== "string" ||
      !claimedPurpose.trim()
    ) {
      return NextResponse.json(
        { error: "Claimed purpose is required." },
        { status: 400 },
      );
    }

    if (
      typeof declaredCapabilities !== "string" ||
      !declaredCapabilities.trim()
    ) {
      return NextResponse.json(
        { error: "Declared capabilities are required." },
        { status: 400 },
      );
    }

    const githubUrlPattern =
      /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/;

    if (!githubUrlPattern.test(repository.trim())) {
      return NextResponse.json(
        {
          error:
            "Repository must be a valid GitHub repository URL.",
        },
        { status: 400 },
      );
    }

    const verification = await verifyTool(
      repository.trim(),
      claimedPurpose.trim(),
      declaredCapabilities.trim(),
    );

    const receipt =
      verification.receipt as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      repository: repository.trim(),
      commitSha: commitSha.trim(),
      txHash: verification.txHash,
      receiptId: verification.receiptId,
      verdict: receipt.verdict,
      risk_level: receipt.risk_level,
      purpose_alignment: receipt.purpose_alignment,
      evidence_quality: receipt.evidence_quality,
      reason_codes: receipt.reason_codes,
      summary: receipt.summary,
    });
  } catch (error) {
    console.error("GitHub verification error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "GitHub verification failed.",
      },
      { status: 500 },
    );
  }
}
