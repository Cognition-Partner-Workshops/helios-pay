# V10 stored XSS

1. Log in as `operator@acme.example`.
2. Create an invoice with `memo_html` set to `<img src=x onerror=alert(document.cookie)>`.
3. Open the invoice in the web console at `/invoices/{id}`.
4. Confirm the `Customer memo` section executes the event handler, while the `Sanitized preview` removes it.
