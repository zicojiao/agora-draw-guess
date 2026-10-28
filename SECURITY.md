# Security

Server credentials must never appear in Git, browser code, URLs, or logs.

- `OPENAI_API_KEY`, `DATABASE_SERVICE_KEY`, `AGORA_APP_CERTIFICATE`, whiteboard
  secrets, and `ACCESS_COOKIE_SECRET` are server-only. Do not prefix them with
  `VITE_`.
- The database Worker checks a shared secret before it runs SQL. Browsers cannot
  call it.
- Room seats use random bearer tokens stored as hashes. Room reads and drawing
  writes require that seat. Only the current artist may upload a drawing.
- Vision requests receive the drawing and earlier AI guesses. They do not receive
  the selected topic, drink name, or wish.
- `ACCESS_PASSWORD` is optional. When it is set, `ACCESS_COOKIE_SECRET` must also
  be set. The access page must not reveal the password. A signed HttpOnly cookie
  keeps a successful login for seven days. Changing either value invalidates old
  cookies.
- `infrastructure/d1/wrangler.jsonc` is ignored. Commit only
  `wrangler.example.jsonc`.

Do not put credentials in issue reports. Email the maintainers privately if you
believe you found a vulnerability.
