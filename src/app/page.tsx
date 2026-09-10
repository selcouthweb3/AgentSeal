"use client";

import { useState } from "react";

type Receipt = {
  verdict: string;
  risk_level: string;
  purpose_alignment: string;
  evidence_quality: string;
  summary: string;
};

type VerificationStatus =
  | "idle"
  | "verifying"
  | "verified"
  | "review"
  | "blocked"
  | "error";

function isGitHubRepositoryUrl(value: string) {
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
      typeof receipt[field] === "string" &&
      receipt[field].trim().length > 0,
  );
}

function receiptStatus(verdict: string): VerificationStatus {
  const normalizedVerdict = verdict.toUpperCase();

  if (/(BLOCK|REJECT|DENY|FAIL)/.test(normalizedVerdict)) {
    return "blocked";
  }

  if (/(REVIEW|WARN|CAUTION)/.test(normalizedVerdict)) {
    return "review";
  }

  return "verified";
}

function formatErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Verification failed";

  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("timed out")) {
    return "GenLayer consensus is taking longer than expected. Please try again shortly.";
  }

  if (
    normalizedMessage.includes("did not execute successfully") ||
    normalizedMessage.includes("transaction")
  ) {
    return "The GenLayer transaction could not complete. No trust receipt was issued.";
  }

  if (normalizedMessage.includes("receipt")) {
    return "GenLayer returned an unreadable trust receipt. Please try again.";
  }

  return message;
}

export default function Home() {
  const [toolUrl, setToolUrl] = useState("");
  const [status, setStatus] = useState<VerificationStatus>("idle");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [receiptId, setReceiptId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleVerify() {
    const repositoryUrl = toolUrl.trim();

    setErrorMessage("");
    setReceipt(null);
    setReceiptId(null);

    if (!isGitHubRepositoryUrl(repositoryUrl)) {
      setStatus("error");
      setErrorMessage(
        "Enter a valid GitHub repository URL, such as github.com/owner/repository.",
      );
      return;
    }

    setStatus("verifying");

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ toolUrl: repositoryUrl }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const error = data as { error?: unknown };

        throw new Error(
          typeof error?.error === "string"
            ? error.error
            : "Verification failed",
        );
      }

      const verification = data as {
        receipt?: unknown;
        receiptId?: unknown;
      };

      if (
        typeof verification.receiptId !== "number" ||
        !Number.isSafeInteger(verification.receiptId) ||
        !isReceipt(verification.receipt)
      ) {
        throw new Error("GenLayer returned an invalid trust receipt");
      }

      setReceipt(verification.receipt);
      setReceiptId(verification.receiptId);
      setStatus(receiptStatus(verification.receipt.verdict));
    } catch (error) {
      console.error(error);
      setStatus("error");
      setErrorMessage(formatErrorMessage(error));
    }
  }

  const isVerifying = status === "verifying";
  const hasReceipt = receipt !== null && receiptId !== null;

  const verdictIsBlocked = status === "blocked";
  const verdictIsReview = status === "review";

  const verdictLabel = verdictIsBlocked
    ? "BLOCKED"
    : verdictIsReview
      ? "REVIEW"
      : "SEALED";

  return (
    <main className="agentseal-page">
      <nav className="site-nav">
        <div className="brand">
          <div className="brand-mark">
            <span />
          </div>
          <span className="brand-name">AgentSeal</span>
        </div>

        <div className="nav-right">
          <span className="status-dot" />
          <span>GenLayer Studio</span>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            Consensus-backed AI verification
          </div>

          <h1>
            Know what your
            <br />
            AI agent <span className="highlight">trusts.</span>
          </h1>

          <p className="hero-description">
            AgentSeal verifies AI tools before they gain access. It compares
            what a tool claims, what it can do, and what public evidence
            supports.
          </p>

          <div className="trust-pills">
            <span>
              <CheckIcon />
              Public evidence
            </span>
            <span>
              <CheckIcon />
              Consensus verified
            </span>
            <span>
              <CheckIcon />
              On-chain receipt
            </span>
          </div>

          <div className="verify-card">
            <div className="verify-card-header">
              <div>
                <span className="field-label">Tool repository</span>
                <span className="field-helper">
                  Verify a public GitHub repository
                </span>
              </div>

              <div className="github-label">
                <GitHubIcon />
                GitHub
              </div>
            </div>

            <div className="input-row">
              <div className="url-input">
                <span className="url-prefix">github.com/</span>
                <input
                  value={toolUrl}
                  onChange={(event) => setToolUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !isVerifying) {
                      handleVerify();
                    }
                  }}
                  placeholder="owner/repository"
                  disabled={isVerifying}
                  aria-invalid={status === "error"}
                />
              </div>

              <button
                onClick={handleVerify}
                disabled={isVerifying || !toolUrl.trim()}
                className="verify-button"
              >
                {isVerifying ? (
                  <>
                    <Spinner />
                    Verifying
                  </>
                ) : (
                  <>
                    Verify
                    <ArrowIcon />
                  </>
                )}
              </button>
            </div>

            {status === "idle" && (
              <div className="input-note">
                <LockIcon />
                Your verification is backed by GenLayer consensus.
              </div>
            )}

            {isVerifying && (
              <div className="verification-progress" role="status">
                <div className="progress-orbit">
                  <span />
                </div>

                <div>
                  <strong>Consensus is running</strong>
                  <p>
                    AgentSeal is assessing repository evidence with GenLayer.
                    This may take a few minutes.
                  </p>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="error-message" role="alert">
                <span>!</span>
                {errorMessage}
              </div>
            )}
          </div>
        </div>

        <div className="hero-result">
          {!hasReceipt && !isVerifying && (
            <div className="empty-receipt">
              <div className="empty-grid" />

              <div className="empty-content">
                <div className="empty-seal">
                  <SealIcon />
                </div>

                <span className="empty-kicker">TRUST RECEIPT</span>

                <h2>Verification<br />starts here.</h2>

                <p>
                  Submit a GitHub repository to generate a live,
                  consensus-backed trust assessment.
                </p>

                <div className="empty-meta">
                  <span>
                    <span className="meta-dot" />
                    GenLayer
                  </span>
                  <span>On-chain</span>
                </div>
              </div>
            </div>
          )}

          {isVerifying && (
            <div className="processing-card">
              <div className="processing-top">
                <span>AGENTSEAL</span>
                <span className="live-label">
                  <i />
                  LIVE
                </span>
              </div>

              <div className="processing-center">
                <div className="consensus-ring ring-one" />
                <div className="consensus-ring ring-two" />
                <div className="consensus-ring ring-three">
                  <SealIcon />
                </div>

                <span className="processing-status">
                  CONSENSUS
                </span>
              </div>

              <div className="processing-footer">
                <span>Analyzing repository evidence</span>
                <span className="processing-dots">•••</span>
              </div>
            </div>
          )}

          {hasReceipt && receipt && receiptId !== null && (
            <div
              className={`receipt-card ${
                verdictIsBlocked
                  ? "receipt-blocked"
                  : verdictIsReview
                    ? "receipt-review"
                    : ""
              }`}
            >
              <div className="receipt-header">
                <div>
                  <span className="receipt-kicker">TRUST RECEIPT</span>
                  <strong>
                    #{String(receiptId).padStart(4, "0")}
                  </strong>
                </div>

                <span className="live-label">
                  <i />
                  LIVE
                </span>
              </div>

              <div className="seal-area">
                <div className="seal-halo" />

                <div className="large-seal">
                  <div className="seal-icon">
                    {verdictIsBlocked ? (
                      <span className="blocked-symbol">×</span>
                    ) : verdictIsReview ? (
                      <span className="review-symbol">!</span>
                    ) : (
                      <CheckIcon />
                    )}
                  </div>

                  <span className="seal-status">{verdictLabel}</span>

                  <span className="seal-caption">
                    GenLayer verified
                  </span>
                </div>
              </div>

              <div className="receipt-metrics">
                <ReceiptMetric
                  label="Risk"
                  value={receipt.risk_level}
                  accent={!verdictIsBlocked}
                />

                <ReceiptMetric
                  label="Purpose"
                  value={receipt.purpose_alignment}
                />

                <ReceiptMetric
                  label="Evidence"
                  value={receipt.evidence_quality}
                />
              </div>

              <div className="assessment">
                <div className="assessment-label">
                  <span>ASSESSMENT</span>
                  <span className="assessment-check">
                    <CheckIcon />
                  </span>
                </div>

                <p>{receipt.summary}</p>
              </div>

              <div className="receipt-footer">
                <span>
                  <LockIcon />
                  Recorded on GenLayer
                </span>

                <span className="receipt-state">
                  VERIFIED
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="site-footer">
        <div>
          <span className="footer-brand">AGENTSEAL</span>
          <span>Trust infrastructure for AI agents.</span>
        </div>

        <div className="footer-right">
          <span>GITHUB</span>
          <span>MCP</span>
          <span>GENLAYER</span>
        </div>
      </footer>
    </main>
  );
}

function ReceiptMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="receipt-metric">
      <span>{label}</span>
      <strong className={accent ? "metric-accent" : ""}>
        {value}
      </strong>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="icon"
    >
      <path d="M3.5 8.3 6.5 11.2 12.5 4.8" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="arrow-icon"
    >
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="github-icon"
    >
      <path
        fill="currentColor"
        d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2.17c-3.22.7-3.9-1.36-3.9-1.36-.53-1.35-1.3-1.71-1.3-1.71-1.06-.73.08-.72.08-.72 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.72 1.27 3.38.97.11-.75.41-1.27.74-1.56-2.57-.29-5.28-1.29-5.28-5.75 0-1.27.45-2.3 1.2-3.11-.12-.3-.52-1.47.11-3.06 0 0 .98-.31 3.16 1.19a10.96 10.96 0 0 1 5.76 0c2.18-1.5 3.16-1.19 3.16-1.19.63 1.59.23 2.76.11 3.06.75.81 1.2 1.84 1.2 3.11 0 4.47-2.72 5.46-5.3 5.75.42.36.79 1.07.79 2.16v3.19c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="lock-icon"
    >
      <rect x="3.5" y="7" width="9" height="6" rx="1" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

function SealIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="seal-svg"
    >
      <path d="M24 5 29 8.2l5.9-.1 2.8 5.2 5.1 2.9-.2 5.8 3.1 5-3.1 5 .2 5.8-5.1 2.9-2.8 5.2-5.9-.1L24 45l-5-3.2-5.9.1-2.8-5.2-5.1-2.9.2-5.8-3.1-5 3.1-5-.2-5.8 5.1-2.9 2.8-5.2 5.9.1L24 5Z" />
      <path d="m16.5 24.2 5 5 10.2-11" />
    </svg>
  );
}
