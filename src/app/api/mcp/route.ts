import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getReceipt, verifyTool } from "@/lib/genlayer";

type AgentSealReceipt = {
  id: number;
  tool_url: string;
  claimed_purpose: string;
  declared_capabilities: string;
  verdict: string;
  risk_level: string;
  purpose_alignment: string;
  evidence_quality: string;
  reason_codes: string[];
  summary: string;
};

function createAgentSealServer() {
  const server = new McpServer({
    name: "AgentSeal",
    version: "0.1.0",
  });

  server.registerTool(
    "verify_ai_tool",
    {
      title: "Verify AI Tool",
      description:
        "Verify an AI tool hosted on GitHub using AgentSeal and GenLayer consensus. Returns a real on-chain Trust Receipt.",
      inputSchema: z.object({
        tool_url: z
          .string()
          .url()
          .describe("The GitHub repository URL of the AI tool."),
        claimed_purpose: z
          .string()
          .min(1)
          .describe("What the AI tool claims it is intended to do."),
        declared_capabilities: z
          .string()
          .min(1)
          .describe("The capabilities the AI tool claims to provide."),
      }),
    },
    async ({
      tool_url,
      claimed_purpose,
      declared_capabilities,
    }) => {
      const githubUrlPattern =
        /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+\/?$/;

      if (!githubUrlPattern.test(tool_url)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text:
                "Only valid GitHub repository URLs are supported. Example: https://github.com/owner/repository",
            },
          ],
        };
      }

      try {
        const result = await verifyTool(
          tool_url,
          claimed_purpose,
          declared_capabilities,
        );

        const receipt = result.receipt as AgentSealReceipt;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  receipt_id: result.receiptId,
                  status: "LIVE",
                  verdict: receipt.verdict,
                  risk_level: receipt.risk_level,
                  purpose_alignment: receipt.purpose_alignment,
                  evidence_quality: receipt.evidence_quality,
                  reason_codes: receipt.reason_codes,
                  summary: receipt.summary,
                  transaction_hash: result.txHash,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        console.error(
          "AgentSeal MCP verification error:",
          error,
        );

        return {
          isError: true,
          content: [
            {
              type: "text",
              text:
                error instanceof Error
                  ? error.message
                  : "AgentSeal verification failed.",
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    "get_trust_receipt",
    {
      title: "Get Trust Receipt",
      description:
        "Retrieve an existing AgentSeal Trust Receipt from the GenLayer contract.",
      inputSchema: z.object({
        receipt_id: z
          .number()
          .int()
          .nonnegative()
          .describe("The AgentSeal Trust Receipt ID."),
      }),
    },
    async ({ receipt_id }) => {
      try {
        const rawReceipt = await getReceipt(receipt_id);

        if (
          typeof rawReceipt !== "string" ||
          rawReceipt.length === 0
        ) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Trust Receipt #${receipt_id} was not found.`,
              },
            ],
          };
        }

        let receipt: unknown;

        try {
          receipt = JSON.parse(rawReceipt);
        } catch {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text:
                  `Trust Receipt #${receipt_id} contains invalid JSON.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(receipt, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error(
          "AgentSeal MCP receipt error:",
          error,
        );

        return {
          isError: true,
          content: [
            {
              type: "text",
              text:
                error instanceof Error
                  ? error.message
                  : "Unable to retrieve Trust Receipt.",
            },
          ],
        };
      }
    },
  );

  return server;
}

const handler = createMcpHandler(
  () => createAgentSealServer(),
);

export async function GET(request: Request) {
  return handler.fetch(request);
}

export async function POST(request: Request) {
  return handler.fetch(request);
}

export async function DELETE(request: Request) {
  return handler.fetch(request);
}
