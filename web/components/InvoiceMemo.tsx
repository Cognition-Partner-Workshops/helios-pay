type InvoiceMemoProps = {
  html: string | null | undefined;
};

export function InvoiceMemo({ html }: InvoiceMemoProps) {
  return (
    <section className="memo-card">
      <div className="section-heading">
        <p className="eyebrow">Customer memo</p>
        <span className="status-pill">Unfiltered source</span>
      </div>
      <div className="memo-content" dangerouslySetInnerHTML={{ __html: html ?? "" }} />
    </section>
  );
}
