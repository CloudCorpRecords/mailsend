/**
 * mailsend types.
 *
 * Every operation takes the small set of fields the Resend API
 * documents for it and returns the API's JSON answer as parsed. The
 * Resend API is JSON in both directions, so the core module owns the
 * request shaping and the response handling.
 *
 * HTTP access is described by a minimal response surface so tests can
 * inject a fake fetch and never touch the network.
 */

export interface SendEmailOptions {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  reply_to?: string;
}

export interface ListEmailsOptions {
  limit?: number;
}

export interface GetEmailOptions {
  id: string;
}

export interface CreateDomainOptions {
  name: string;
  region?: string;
}

export interface DomainIdOptions {
  id: string;
}

export interface CreateApiKeyOptions {
  name: string;
  permission?: string;
  domain_id?: string;
}

export interface ApiKeyIdOptions {
  id: string;
}

export interface CreateAudienceOptions {
  name: string;
}

export interface CreateContactOptions {
  audience_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  unsubscribed?: boolean;
}

export interface ListContactsOptions {
  audience_id: string;
  limit?: number;
}

/** Minimal HTTP response surface so tests can inject fixtures. */
export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;
