import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <nav className="top-nav" aria-label="Primary navigation">
        <Link href="/">Helios Pay</Link>
        <div>
          <Link href="/login">Sign in</Link>
          <Link href="/invoices">Invoices</Link>
        </div>
      </nav>
      <p className="eyebrow">HELIOS PAY</p>
      <h1>Payments operations, at a glance.</h1>
      <p className="lede">
        Monitor invoices, partner activity, and ledger settlement from one
        operator console.
      </p>
      <section className="cards" aria-label="Platform status">
        <article>
          <span>Invoices</span>
          <strong>201</strong>
          <small>Seeded for the demo</small>
        </article>
        <article>
          <span>Tenants</span>
          <strong>3</strong>
          <small>Acme, Globex, Initech</small>
        </article>
        <article>
          <span>Environment</span>
          <strong>Local</strong>
          <small>Workshop sandbox</small>
        </article>
      </section>
    </main>
  );
}
