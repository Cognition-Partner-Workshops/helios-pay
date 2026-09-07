"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { CopilotPanel } from "../../../components/CopilotPanel";
import { InvoiceMemo } from "../../../components/InvoiceMemo";
import { Notes } from "../../../components/Notes";
import { apiBase, authHeaders } from "../../../lib/api";

type Invoice = {
  id: string;
  number: string;
  customer_name: string;
  amount_cents: number;
  currency: string;
  status: string;
  memo_html: string | null;
};

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInvoice() {
      try {
        const response = await fetch(`${apiBase()}/invoices/${params.id}`, {
          headers: authHeaders(),
        });
        if (response.status === 401) {
          setUnauthorized(true);
          return;
        }
        if (!response.ok) {
          throw new Error(`Unable to load invoice (${response.status})`);
        }
        setInvoice((await response.json()) as Invoice);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Unable to load invoice.");
      }
    }
    loadInvoice();
  }, [params.id]);

  if (unauthorized) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <p className="eyebrow">Session required</p>
          <h1>Sign in to view this invoice.</h1>
          <Link className="primary-button button-link" href="/login">
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="console-shell">
        <Link className="back-link" href="/invoices">
          ← Back to invoices
        </Link>
        <p className="error-message">{error}</p>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="console-shell">
        <p className="helper-text">Loading invoice…</p>
      </main>
    );
  }

  return (
    <main className="console-shell">
      <Link className="back-link" href="/invoices">
        ← Back to invoices
      </Link>
      <header className="detail-header">
        <div>
          <p className="eyebrow">Invoice detail</p>
          <h1>{invoice.number}</h1>
          <p className="lede">{invoice.customer_name}</p>
        </div>
        <span className={`status-pill ${invoice.status}`}>{invoice.status}</span>
      </header>
      <section className="detail-grid">
        <div className="detail-column">
          <div className="metric-card">
            <span className="metric-label">Total due</span>
            <strong>
              {(invoice.amount_cents / 100).toLocaleString("en-US", {
                style: "currency",
                currency: invoice.currency,
              })}
            </strong>
          </div>
          <InvoiceMemo html={invoice.memo_html} />
          <Notes html={invoice.memo_html} />
        </div>
        <CopilotPanel invoiceId={invoice.id} />
      </section>
    </main>
  );
}
