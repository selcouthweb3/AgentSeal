import { NextResponse } from "next/server";
import { verifyTool } from "@/lib/genlayer";

export const maxDuration = 360;

type GitHubVerificationRequest = {
  repository?: unknown;
  commitSha?: unknown;
  claimedPurpose?: unknown;
  declaredCapabilities?: unknown;
};

type Receipt = {
  verdict: string;
  risk_level: string;
  purpose_alignment: string;
  evidence_quality: string;
  summary: string;
};

function isRepository(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)
  );
}

function isCommitSha(value: unknown): value is string {
  return typeof value === "string" && /^[a-fA-F0-9]{7,64}$/.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isReceipt(value: unknown): value is Receipt {
  if (!value || typeof value !== "object") return false;

  const receipt = value as Record<string, unknown>;

  return [
    "verdict",
    "risk_level",
    "purpose_alignment",
    "evidence_quality",
    "summary",
  ].every(
    (field) =>
      typeof receipt[field] === "string" && receipt[field].trim().length > 0,
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GitHubVerificationRequest;

    if (!isRepository(body.repository) || !isCommitSha(body.commitSha)) {
      return NextResponse.json(
        { error: "repository must be owner/repo and commitSha must be a Git SHA." },
        { status: 400 },
      );
    }

    if (
      !isNonEmptyString(body.claimedPurpose) ||
      !isNonEmptyString(body.declaredCapabilities)
    ) {
      return NextResponse.json(
        { error: "claimedPurpose and declaredCapabilities are required." },
        { status: 400 },
      );
    }

    const verification = await verifyTool(
      `https://github.com/${body.repository}`,
      body.claimedPurpose.trim(),
      body.declaredCapabilities.trim(),
    );

    if (!isReceipt(verification.receipt)) {
      throw new Error("GenLayer returned an invalid trust receipt");
    }

    return NextResponse.json({
      success: true,
      txHash: verification.txHash,
      receiptId: verification.receiptId,
      verdict: verification.receipt.verdict,
      riskLevel: verification.receipt.risk_level,
      purposeAlignment: verification.receipt.purpose_alignment,
      evidenceQuality: verification.receipt.evidence_quality,
      summary: verification.receipt.summary,
    });
  } catch (error) {
    console.error("GitHub verification error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "GitHub verification failed",
      },
      { status: 500 },
    );
  }
}
