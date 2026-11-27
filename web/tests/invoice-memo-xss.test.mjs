// Regression test for V10: invoice memo HTML must be sanitized before it is rendered.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { JSDOM } from "jsdom";

globalThis.window = new JSDOM("").window;
const { sanitizeHtml } = await import("../lib/sanitize.ts");

function render(html) {
  const dom = new JSDOM(`<div id="memo">${sanitizeHtml(html)}</div>`);
  return dom.window.document.getElementById("memo");
}

test("strips event handlers and script tags from memo HTML", () => {
  const memo = render(
    '<p>Net 30</p><img src=x onerror="alert(document.cookie)"><script>alert(1)</script><a href="javascript:alert(1)">pay</a>',
  );
  assert.equal(memo.querySelector("script"), null);
  assert.equal(memo.querySelector("[onerror]"), null);
  assert.equal(memo.querySelector('a[href^="javascript:"]'), null);
  assert.equal(memo.querySelector("p").textContent, "Net 30");
});

test("keeps harmless formatting and tolerates empty memos", () => {
  assert.equal(sanitizeHtml("<p>Net <b>30</b></p>"), "<p>Net <b>30</b></p>");
  assert.equal(sanitizeHtml(null), "");
  assert.equal(sanitizeHtml(undefined), "");
});

test("InvoiceMemo renders only sanitized HTML", () => {
  const source = readFileSync(new URL("../components/InvoiceMemo.tsx", import.meta.url), "utf8");
  assert.match(source, /sanitizeHtml\(html\)/);
  assert.doesNotMatch(source, /__html:\s*html\b/);
});
