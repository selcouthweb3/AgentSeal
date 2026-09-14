import {
  createClient,
  createAccount,
  isSuccessful,
} from "genlayer-js";

import {
  studioDevnet,
} from "genlayer-js/chains";
import type { Address } from "genlayer-js/types";

const CONTRACT_ADDRESS: Address =
  "0x58683d8dF22E2292a8Da0aD87b23fdaEbD90D30b";

function getClient() {
  const privateKey = process.env.GENLAYER_PRIVATE_KEY;

  if (
    !privateKey ||
    typeof privateKey !== "string" ||
    !privateKey.startsWith("0x")
  ) {
    throw new Error("GenLayer private key is missing or invalid");
  }

  return createClient({
    chain: studioDevnet,
    endpoint: "https://studio-next.genlayer.com/api",
    account: createAccount(privateKey as `0x${string}`),
  });
}

export async function verifyTool(
  toolUrl: string,
  claimedPurpose: string,
  declaredCapabilities: string,
) {
  const client = getClient();

  // Receipt IDs are sequential. Capture the next ID before this transaction can
  // create its receipt, rather than deriving an ID from the transaction hash.
  const receiptCount = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_receipt_count",
    args: [],
  });
  const receiptId = Number(receiptCount);

  if (!Number.isSafeInteger(receiptId) || receiptId < 0) {
    throw new Error("GenLayer returned an invalid receipt count");
  }

  const write = {
    address: CONTRACT_ADDRESS,
    functionName: "assess_tool",
    args: [
      toolUrl,
      claimedPurpose,
      declaredCapabilities,
    ],
  };

  console.log("Estimating transaction fees...");

  const feeEstimate =
    await client.estimateTransactionFeesForWrite(write);

  console.log("Fee estimate:", feeEstimate);

  const txHash = await client.writeContract({
    ...write,
    fees: {
      distribution: feeEstimate.distribution,
      messageAllocations: feeEstimate.messageAllocations,
      feeValue: feeEstimate.feeValue,
    },
  });

  console.log("Transaction submitted:", txHash);

  const transaction = await client.waitForDecision({
    hash: txHash,
    interval: 3_000,
    retries: 120,
  });

  if (
    !isSuccessful(transaction) ||
    transaction.txExecutionResultName !== "FINISHED_WITH_RETURN"
  ) {
    throw new Error(
      `GenLayer assessment did not execute successfully (${transaction.txExecutionResultName ?? "unknown result"})`,
    );
  }

  const rawReceipt = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_receipt",
    args: [receiptId],
  });

  if (typeof rawReceipt !== "string") {
    throw new Error("GenLayer returned a receipt in an unexpected format");
  }

  let receipt: unknown;

  try {
    receipt = JSON.parse(rawReceipt);
  } catch {
    throw new Error("GenLayer returned invalid receipt JSON");
  }

  return {
    txHash,
    receiptId,
    receipt,
  };
}

export async function getReceiptCount() {
  const client = getClient();

  return client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_receipt_count",
    args: [],
  });
}

export async function getReceipt(receiptId: number) {
  const client = getClient();

  return client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_receipt",
    args: [receiptId],
  });
}
