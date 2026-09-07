"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiBase, authHeaders } from "../../lib/api";
import { shimmerOffset } from "../../lib/anim";

type Invoice = {
  id: string;
  number: string;
  customer_name: string;
  amount_cents: number;
  currency: string;
  status: string;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInvoices() {
      try {
        const response = await fetch(`${apiBase()}/invoices`, {
          headers: authHeaders(),
        });
        if (response.status === 401) {
          setUnauthorized(true);
          return;
        }
        if (!response.ok) {
          throw new Error(`Unable to load invoices (${response.status})`);
        }
        setInvoices((await response.json()) as Invoice[]);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Unable to load invoices.");
      } finally {
        setLoading(false);
      }
    }
    loadInvoices();
  }, []);

  return (
    <main className="console-shell">
      <header className="page-header">
        <div>
          <Link className="back-link" href="/">
            ← Helios Pay
          </Link>
          <p className="eyebrow">Billing operations</p>
          <h1>Invoices</h1>
        </div>
        <Link className="secondary-button" href="/login">
          Switch account
        </Link>
      </header>
      <section
        className="table-panel"
        style={{ "--shimmer-offset": `${shimmerOffset()}%` } as React.CSSProperties}
      >
        <div className="panel-heading">
          <div>
            <h2>Invoice register</h2>
            <p className="helper-text">Current activity for your tenant.</p>
          </div>
          <span className="record-count">{invoices.length} records</span>
        </div>
        {loading && <p className="helper-text">Loading invoices…</p>}
        {unauthorized && (
          <p className="error-message">
            Your session has expired. <Link href="/login">Sign in again</Link>.
          </p>
        )}
        {error && <p className="error-message">{error}</p>}
        {!loading && !unauthorized && !error && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <Link className="invoice-link" href={`/invoices/${invoice.id}`}>
                        {invoice.number}
                      </Link>
                    </td>
                    <td>{invoice.customer_name}</td>
                    <td>
                      {(invoice.amount_cents / 100).toLocaleString("en-US", {
                        style: "currency",
                        currency: invoice.currency,
                      })}
                    </td>
                    <td>
                      <span className={`status-pill ${invoice.status}`}>{invoice.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
