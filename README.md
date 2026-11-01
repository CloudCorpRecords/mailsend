# mailsend

mailsend lets an agent run the sending side of a Resend account: send a
message and look it back up, set up a sending domain and start its DNS
verification, mint or retire API keys, and keep audiences and their
contacts in order. Each operation is one call against the Resend REST
API, and the API's JSON answer comes back as-is. It runs from the
command line or as an MCP server for agents.

A Resend API key is required. Put it in the `RESEND_API_KEY`
environment variable; the key is sent to the API as a Bearer token and
never appears in output. When the variable is missing, every operation
fails with an error that names it.

## Install

```bash
npx @reneturcios/mailsend list-domains
```

Or run the container image:

```bash
docker run -i -e RESEND_API_KEY ghcr.io/cloudcorprecords/mailsend
```

The container defaults to the MCP server (see below). Pass CLI
arguments to use it as a CLI instead.

## CLI

```bash
export RESEND_API_KEY="your API key"

mailsend send --from "Acme <hello@acme.example>" --to user@example.com \
  --subject "Welcome" --text "Hello there"
mailsend list-emails --limit 10
mailsend list-domains
mailsend list-audiences

mailsend --version
```

Exit codes: `0` on success, `1` when an API call fails (including a
missing `RESEND_API_KEY`), `2` for usage errors.

## MCP server

One bin serves both faces. The `mcp` subcommand starts a stdio MCP
server:

```bash
npx -y @reneturcios/mailsend mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "mailsend": {
      "command": "npx",
      "args": ["-y", "@reneturcios/mailsend", "mcp"],
      "env": { "RESEND_API_KEY": "your API key" }
    }
  }
}
```

### Tools

| Tool | Input | What it does |
| --- | --- | --- |
| `send_email` | `from`, `to` (array), `subject` (required); `html`, `text`, `cc`, `bcc`, `reply_to` (optional) | Send an email. |
| `list_emails` | `limit` (integer, optional) | List sent emails. |
| `get_email` | `id` (required) | Get one sent email by ID. |
| `create_domain` | `name` (required), `region` (optional) | Create a sending domain. |
| `list_domains` | — | List sending domains. |
| `get_domain` | `id` (required) | Get one domain, including its DNS records. |
| `verify_domain` | `id` (required) | Start DNS verification for a domain. |
| `delete_domain` | `id` (required) | Delete a sending domain. |
| `create_api_key` | `name` (required), `permission`, `domain_id` (optional) | Create an API key. |
| `list_api_keys` | — | List API keys. |
| `delete_api_key` | `id` (required) | Delete an API key. |
| `create_audience` | `name` (required) | Create an audience. |
| `list_audiences` | — | List audiences. |
| `create_contact` | `audience_id`, `email` (required); `first_name`, `last_name`, `unsubscribed` (optional) | Add a contact to an audience. |
| `list_contacts` | `audience_id` (required), `limit` (optional) | List contacts in an audience. |

This is a documented core subset of the Resend platform surface. The
hosted Resend MCP also covers broadcasts, templates, webhooks,
segments, topics, contact properties, batch sending, and received
(inbound) email; those groups are not implemented here.

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # node test runner over test/*.test.ts, no network (fake fetch fixtures)
npm run dev     # run the CLI from source via tsx
```

## License

MIT — see `LICENSE`.
