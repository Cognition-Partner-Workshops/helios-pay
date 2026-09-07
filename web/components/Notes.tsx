"use client";

import { useEffect, useState } from "react";
import DOMPurify from "dompurify";

type NotesProps = {
  html: string | null | undefined;
};

export function Notes({ html }: NotesProps) {
  const [cleanHtml, setCleanHtml] = useState("");

  useEffect(() => {
    setCleanHtml(DOMPurify.sanitize(html ?? ""));
  }, [html]);

  return (
    <section className="note-card">
      <div className="section-heading">
        <p className="eyebrow">Sanitized preview</p>
        <span className="status-pill safe">Internal note</span>
      </div>
      <div className="memo-content" dangerouslySetInnerHTML={{ __html: cleanHtml }} />
    </section>
  );
}
