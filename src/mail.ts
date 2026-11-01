/**
 * mailsend core: Resend operations against the Resend REST API.
 *
 * Requests go to https://api.resend.com with the API key from
 * RESEND_API_KEY sent as a Bearer token. The API is JSON in both
 * directions: writes are POSTs (and DELETEs for removals) with JSON
 * bodies, reads are GETs, and responses are returned to the caller as
 * parsed JSON values.
 *
 * A missing key is an error before any request is made, and the error
 * names the RESEND_API_KEY variable so a misconfigured client is easy
 * to fix. All HTTP goes through an injected FetchFn so request building
 * and response handling are fully testable offline.
 */
import type {
  ApiKeyIdOptions,
  CreateApiKeyOptions,
  CreateAudienceOptions,
  CreateContactOptions,
  CreateDomainOptions,
  DomainIdOptions,
  FetchFn,
  GetEmailOptions,
  ListContactsOptions,
  ListEmailsOptions,
  SendEmailOptions,
} from "./types.js";

export const VERSION = "0.1.0";

export const API_BASE = "https://api.resend.com";

export const API_KEY_ENV = "RESEND_API_KEY";

/** The honest missing-key error. Names the variable, never a value. */
export function requireApiKey(apiKey: string | undefined): string {
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key) {
    throw new Error(
      "RESEND_API_KEY environment variable is required: set RESEND_API_KEY to a Resend API key and retry",
    );
  }
  return key;
}

function requireString(value: unknown, field: string): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) throw new Error(`${field} must be a non-empty string`);
  return v;
}

function clean<T extends Record<string, unknown>>(fields: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) out[k] = v;
  return out;
}

async function callResend(
  fetchFn: FetchFn,
  apiKey: string | undefined,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const key = requireApiKey(apiKey);
  let response;
  try {
    response = await fetchFn(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    throw new Error(
      `Resend API request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!response.ok) {
    let detail = "";
    try {
      const parsed: unknown = await response.json();
      if (parsed && typeof parsed === "object" && "message" in parsed) {
        const m = (parsed as { message?: unknown }).message;
        if (typeof m === "string") detail = `: ${m}`;
      }
    } catch {
      // Keep the status-only error when the body is not JSON.
    }
    throw new Error(
      `Resend API request failed: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}${detail}`,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new Error("Resend API returned a response that was not valid JSON");
  }
}

export async function sendEmail(
  fetchFn: FetchFn,
  apiKey: string | undefined,
  options: SendEmailOptions,
): Promise<unknown> {
  if (!Array.isArray(options.to) || options.to.length === 0) {
    throw new Error("to must be a non-empty array of email addresses");
  }
  return callResend(
    fetchFn,
    apiKey,
    "POST",
    "/emails",
    clean({
      from: requireString(options.from, "from"),
      to: options.to,
      subject: requireString(options.subject, "subject"),
      html: options.html,
      text: options.text,
      cc: options.cc,
      bcc: options.bcc,
      reply_to: options.reply_to,
    }),
  );
}

export async function listEmails(
  fetchFn: FetchFn,
  apiKey: string | undefined,
  options: ListEmailsOptions,
): Promise<unknown> {
  const qs = options.limit !== undefined ? `?limit=${options.limit}` : "";
  return callResend(fetchFn, apiKey, "GET", `/emails${qs}`);
}

export async function getEmail(
  fetchFn: FetchFn,
  apiKey: string | undefined,
  options: GetEmailOptions,
): Promise<unknown> {
  const id = encodeURIComponent(requireString(options.id, "id"));
  return callResend(fetchFn, apiKey, "GET", `/emails/${id}`);
}

export async function createDomain(
  fetchFn: FetchFn,
  apiKey: string | undefined,
  options: CreateDomainOptions,
): Promise<unknown> {
  return callResend(
    fetchFn,
    apiKey,
    "POST",
    "/domains",
    clean({ name: requireString(options.name, "name"), region: options.region }),
  );
}

export async function listDomains(
  fetchFn: FetchFn,
  apiKey: string | undefined,
): Promise<unknown> {
  return callResend(fetchFn, apiKey, "GET", "/domains");
}

export async function getDomain(
  fetchFn: FetchFn,
  apiKey: string | undefined,
  options: DomainIdOptions,
): Promise<unknown> {
  const id = encodeURIComponent(requireString(options.id, "id"));
  return callResend(fetchFn, apiKey, "GET", `/domains/${id}`);
}

export async function verifyDomain(
  fetchFn: FetchFn,
  apiKey: string | undefined,
  options: DomainIdOptions,
): Promise<unknown> {
  const id = encodeURIComponent(requireString(options.id, "id"));
  return callResend(fetchFn, apiKey, "POST", `/domains/${id}/verify`, {});
}

export async function deleteDomain(
  fetchFn: FetchFn,
  apiKey: string | undefined,
  options: DomainIdOptions,
): Promise<unknown> {
  const id = encodeURIComponent(requireString(options.id, "id"));
  return callResend(fetchFn, apiKey, "DELETE", `/domains/${id}`);
}

export async function createApiKey(
  fetchFn: FetchFn,
  apiKey: string | undefined,
  options: CreateApiKeyOptions,
): Promise<unknown> {
  return callResend(
    fetchFn,
    apiKey,
    "POST",
    "/api-keys",
    clean({
      name: requireString(options.name, "name"),
      permission: options.permission,
      domain_id: options.domain_id,
    }),
  );
}

export async function listApiKeys(
  fetchFn: FetchFn,
  apiKey: string | undefined,
): Promise<unknown> {
  return callResend(fetchFn, apiKey, "GET", "/api-keys");
}

export async function deleteApiKey(
  fetchFn: FetchFn,
  apiKey: string | undefined,
  options: ApiKeyIdOptions,
): Promise<unknown> {
  const id = encodeURIComponent(requireString(options.id, "id"));
  return callResend(fetchFn, apiKey, "DELETE", `/api-keys/${id}`);
}

export async function createAudience(
  fetchFn: FetchFn,
  apiKey: string | undefined,
  options: CreateAudienceOptions,
): Promise<unknown> {
  return callResend(fetchFn, apiKey, "POST", "/audiences", {
    name: requireString(options.name, "name"),
  });
}

export async function listAudiences(
  fetchFn: FetchFn,
  apiKey: string | undefined,
): Promise<unknown> {
  return callResend(fetchFn, apiKey, "GET", "/audiences");
}

export async function createContact(
  fetchFn: FetchFn,
  apiKey: string | undefined,
  options: CreateContactOptions,
): Promise<unknown> {
  const audience = encodeURIComponent(requireString(options.audience_id, "audience_id"));
  return callResend(
    fetchFn,
    apiKey,
    "POST",
    `/audiences/${audience}/contacts`,
    clean({
      email: requireString(options.email, "email"),
      first_name: options.first_name,
      last_name: options.last_name,
      unsubscribed: options.unsubscribed,
    }),
  );
}

export async function listContacts(
  fetchFn: FetchFn,
  apiKey: string | undefined,
  options: ListContactsOptions,
): Promise<unknown> {
  const audience = encodeURIComponent(requireString(options.audience_id, "audience_id"));
  const qs = options.limit !== undefined ? `?limit=${options.limit}` : "";
  return callResend(fetchFn, apiKey, "GET", `/audiences/${audience}/contacts${qs}`);
}

/** Render an API result as the JSON text block MCP clients display. */
export function formatResult(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
