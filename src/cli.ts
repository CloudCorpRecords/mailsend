#!/usr/bin/env node
/**
 * mailsend CLI.
 *
 *   mailsend send --from <addr> --to <addr> --subject <text> [--text <body>] [--html <body>] [--json]
 *   mailsend list-emails [--limit n] [--json]
 *   mailsend list-domains [--json]
 *   mailsend list-audiences [--json]
 *   mailsend mcp
 *
 * Reads the Resend API key from RESEND_API_KEY.
 * Exit codes: 0 success, 1 API error, 2 usage error.
 */
import {
  API_KEY_ENV,
  formatResult,
  listAudiences,
  listDomains,
  listEmails,
  sendEmail,
  VERSION,
} from "./mail.js";
import type { FetchFn } from "./types.js";

function usage(): never {
  console.error(`Usage:
  mailsend send --from <addr> --to <addr> --subject <text> [--text <body>] [--html <body>] [--json]
  mailsend list-emails [--limit n] [--json]
  mailsend list-domains [--json]
  mailsend list-audiences [--json]
  mailsend mcp
  mailsend --version`);
  process.exit(2);
}

function flagValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx < 0 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function numFlag(args: string[], name: string): number | undefined {
  const raw = flagValue(args, name);
  if (raw === undefined) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (!cmd) usage();
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const apiKey = process.env[API_KEY_ENV];
  const known = ["send", "list-emails", "list-domains", "list-audiences"];
  if (!known.includes(cmd)) usage();
  try {
    let out: unknown;
    if (cmd === "send") {
      const from = flagValue(rest, "--from");
      const to = flagValue(rest, "--to");
      const subject = flagValue(rest, "--subject");
      if (!from || !to || !subject) usage();
      out = await sendEmail(fetchFn, apiKey, {
        from,
        to: [to],
        subject,
        text: flagValue(rest, "--text"),
        html: flagValue(rest, "--html"),
      });
    } else if (cmd === "list-emails") {
      out = await listEmails(fetchFn, apiKey, { limit: numFlag(rest, "--limit") });
    } else if (cmd === "list-domains") {
      out = await listDomains(fetchFn, apiKey);
    } else {
      out = await listAudiences(fetchFn, apiKey);
    }
    console.log(formatResult(out));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
