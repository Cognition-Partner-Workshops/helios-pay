"use client";

import { useEffect, useState } from "react";

import { sanitizeHtml } from "../lib/sanitize";

type InvoiceMemoProps = {
  html: string | null | undefined;
};

export function InvoiceMemo({ html }: InvoiceMemoProps) {
  const [cleanHtml, setCleanHtml] = useState("");

  useEffect(() => {
    setCleanHtml(sanitizeHtml(html));
  }, [html]);

  return (
    <section className="memo-card">
      <div className="section-heading">
        <p className="eyebrow">Customer memo</p>
        <span className="status-pill safe">Sanitized</span>
      </div>
      <div className="memo-content" dangerouslySetInnerHTML={{ __html: cleanHtml }} />
    </section>
  );
}
