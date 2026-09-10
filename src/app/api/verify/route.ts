import { NextResponse } from "next/server";
import { verifyTool } from "@/lib/genlayer";

function isGitHubRepositoryUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    const pathParts = url.pathname.split("/").filter(Boolean);

    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      (url.hostname === "github.com" || url.hostname === "www.github.com") &&
      pathParts.length === 2
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!isGitHubRepositoryUrl(body?.toolUrl)) {
      return NextResponse.json(
        { error: "Enter a valid GitHub repository URL." },
        { status: 400 },
      );
    }

    const verification = await verifyTool(
      body.toolUrl,
      "AI tool verification",
      "Declared capabilities from repository"
    );

    return NextResponse.json({
      success: true,
      ...verification,
    });
  } catch (error) {

    console.error(
      "Verification error:",
      error
    );


    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Verification failed",
      },
      {
        status: 500,
      }
    );
  }
}
