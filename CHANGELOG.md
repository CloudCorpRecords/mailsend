# Changelog

## 0.1.0 (2026-10-26)

- Initial release.
- MCP server (`mailsend mcp`, stdio) with 15 tools covering the
  documented Resend core: sending and reading email, sending domains
  (create, list, get, verify, delete), API keys (create, list,
  delete), audiences, and contacts.
- CLI: `mailsend send`, `list-emails`, `list-domains`, and
  `list-audiences`; the Resend API key is read from `RESEND_API_KEY`.
- Calls go to `https://api.resend.com` with the key sent as a Bearer
  token and JSON request bodies.
- A missing `RESEND_API_KEY` fails honestly with an error naming the
  variable, before any request is made.
- All HTTP goes through an injectable fetch function, so the test suite
  runs entirely on hand-written fixtures with no network access.
