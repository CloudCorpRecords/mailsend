# mailsend — Build Report

MCP Rebuild 100, Tier B. Clean-room rebuild of the community Resend
MCP server, built from the public Resend API / MCP documentation
captured in `harness/fixtures/resend-tools-original.json`. The
original target's `source_repo` is null in TARGETS.json and no stable
published tool list exists for the community server, so — per the task
rule for ambiguous surfaces — the fixture defines a coherent
documented core of **15 tools** mapped 1:1 onto documented Resend REST
endpoints, and is marked `"_source": core-subset, docs-derived ...`
with the omitted platform groups listed (broadcasts, templates,
webhooks, segments, topics, contact properties, batch sending, and
received/inbound email). Parity below is claimed only against that
15-tool subset. Local build only — nothing pushed or published, and
no live network call was made or claimed at any point.

Identity: repo `mailsend`, npm `@reneturcios/mailsend`,
MCP name `io.github.CloudCorpRecords/mailsend`, version `0.1.0`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json` — bin `mailsend: dist/cli.js`, `mcpName` set,
  scripts build=`tsc` / dev=`tsx src/cli.ts` / test=`tsx --test test/*.test.ts`
- `server.json` — description "Send and manage email, domains,
  audiences, and API keys through the Resend API." = **79 chars**
  (≤100 ✓); npm entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/mailsend:0.1.0` carries **no** `version`
  field (verified programmatically)
- `Dockerfile` — node:20-alpine two-stage, ENTRYPOINT
  `node /app/dist/cli.js`, CMD `mcp`, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/mailsend"`
- `tsconfig.json` (identical to the fleet template), `.gitignore`,
  `LICENSE` (MIT, Copyright (c) 2026 Rene Turcios), `README.md`
  (fresh text), `CHANGELOG.md` (single 0.1.0 entry, 2026-10-26)
- `src/index.ts`, `src/cli.ts` (`send`, `list-emails`, `list-domains`,
  `list-audiences`, `mcp`, `--version`; exit 2 usage / 1 API error),
  `src/mcp.ts`, `src/types.ts`, `src/mail.ts` (core logic,
  `VERSION = "0.1.0"`)
- `test/mail.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (from the fleet template; image name and smoke-test server name
  changed to mailsend)

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with explicit
  inputSchema literals, per the standing fleet rule: `McpServer`'s
  zod-to-JSON-Schema conversion injects `$schema` /
  `additionalProperties` keys that are absent from the public spec and
  break exact schema parity. Zod still validates every `tools/call`.
- The 15 tools map to Resend REST endpoints under
  `https://api.resend.com` (`POST/GET /emails`, `GET /emails/:id`,
  `POST/GET /domains`, `GET/DELETE /domains/:id`,
  `POST /domains/:id/verify`, `POST/GET /api-keys`,
  `DELETE /api-keys/:id`, `POST/GET /audiences`,
  `POST/GET /audiences/:id/contacts`). The key from `RESEND_API_KEY`
  is sent as `Authorization: Bearer <key>`; bodies are JSON, with
  undefined optional fields omitted rather than sent as nulls.
- A missing key throws before any request, with an error naming
  `RESEND_API_KEY`; over MCP this surfaces as an `isError` result
  (verified live over stdio, see below). Resend error bodies
  (`{message}`) are surfaced in the thrown error text.
- All HTTP flows through an injectable `FetchFn` (types.ts). The test
  suite uses a fake fetch returning hand-written Resend-shaped JSON
  fixtures — **no live call was performed during this build**.

## Verification (exact outputs)

### 1. Build
```
$ ./node_modules/.bin/tsc ; echo exit=$?
tsc exit=0
```
`dist/` produced, including `dist/cli.js` with the
`#!/usr/bin/env node` shebang.

### 2. Tests
```
$ ./node_modules/.bin/tsx --test test/*.test.ts
ℹ tests 16
ℹ pass 16
ℹ fail 0
```
Covers: missing/blank key error naming RESEND_API_KEY (and no request
made without a key), send_email JSON body + Bearer header + JSON
content type, optional cc/bcc/reply_to inclusion and omission,
empty-`to` rejection, list/get email paths and limit query, domain
create/list/verify/delete methods and paths, API-key create body and
delete path, contact create/list under the audience path, HTTP error
propagation with the API message, and empty-required-field rejection.

### 3. CLI / MCP smoke
`--version` → `0.1.0`; unknown command exits 2 with Usage. MCP
`initialize` over stdio → `serverInfo: {"name":"mailsend",
"version":"0.1.0"}`. A `tools/call` for `send_email` with
`RESEND_API_KEY` unset returned `isError: true` with text
"RESEND_API_KEY environment variable is required: set RESEND_API_KEY
to a Resend API key and retry". CLI calls against the live API were
**not** run (offline build rule for this wave).

### 4. Parity (harness, from ~/workspace/mcp-rebuild-100/harness/)
```
$ python3 parity.py --original fixtures/resend-tools-original.json \
    --rebuild "stdio:node /home/hatch/workspace/mcp-rebuild-100/builds/mailsend/dist/cli.js mcp" \
    --out .../builds/mailsend/parity-out
verdict=PASS parity_pct=100.0 original_tools=15 rebuild_tools=15 missing=[] extra=[] schema_diffs=[]
(exit 0)
```
Parity is 100.0% **against the labelled 15-tool core subset** (see
fixture `_source`), not against the full hosted Resend MCP surface.
Original side is tools-file mode, so `fixture_results` records
`SKIPPED-TOOLS-FILE-MODE` — expected harness semantics, not an error.

## Lockfile status

`package-lock.json` was copied from searchport's and edited with the
file edit tool: top-level `name`, root package `name`, and root
package `bin` key changed searchport -> mailsend (dependency ranges
are identical, so the tree is unchanged). **Clean lockfile regen
required before publish** (regenerate with no `node_modules`
present); do not publish from this lockfile as-is. `node_modules` here
is a `cp -a` copy of searchport's (ownership-preservation warnings
during the copy were cosmetic; `.bin/tsc` / `.bin/tsx` verified
working).

## Gaps / honest notes

- Core subset by design: the hosted/official Resend MCP documents a
  much larger surface (broadcasts, templates, webhooks, segments,
  topics, contact properties, batch sending, received/inbound email
  and attachments). None of those groups are implemented; the fixture
  records them as omitted and parity is subset-only.
- No live Resend API call was made (VM egress is blocked and no key is
  available in this environment). Request construction and response
  handling are written against the documented endpoint paths and
  payload shapes as captured in the hand-written test fixtures; live
  payload drift (for example the newer list-emails pagination shape)
  is unverified until the publish wave.
- `send_email`'s `to`/`cc`/`bcc` are arrays of addresses, matching the
  Resend API; a single-string recipient shape some community servers
  expose is not reproduced.
- Container build not exercised locally; the publish-container
  workflow smoke-tests the image at publish time.
