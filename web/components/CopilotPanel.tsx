"use client";

import { useState } from "react";

import { apiBase, authHeaders } from "../lib/api";

type CopilotPanelProps = {
  invoiceId: string;
};

export function CopilotPanel({ invoiceId }: CopilotPanelProps) {
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function summarize() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBase()}/copilot/summarize`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      if (!response.ok) {
        throw new Error(`Copilot request failed (${response.status})`);
      }
      const data = (await response.json()) as { summary?: string };
      setSummary(data.summary ?? "No summary was returned.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to summarize invoice.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="copilot-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Support Copilot</p>
          <h2>Invoice intelligence</h2>
        </div>
        <span className="copilot-orb" aria-hidden="true" />
      </div>
      <p className="helper-text">Copilot summarizes the invoice memo for support follow-up.</p>
      <button className="primary-button" type="button" onClick={summarize} disabled={loading}>
        {loading ? "Summarizing…" : "Summarize"}
      </button>
      {summary && <p className="copilot-result">{summary}</p>}
      {error && <p className="error-message">{error}</p>}
    </section>
  );
}
