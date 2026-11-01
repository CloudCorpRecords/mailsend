import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createApiKey,
  createContact,
  createDomain,
  deleteApiKey,
  deleteDomain,
  getEmail,
  listContacts,
  listDomains,
  listEmails,
  requireApiKey,
  sendEmail,
  verifyDomain,
} from "../src/mail.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

function jsonResponse(body: unknown, status = 200, statusText = "OK"): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

interface Captured {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

function fakeFetch(captured: Captured, body: unknown = { id: "obj_123" }): FetchFn {
  return async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    captured.url = url;
    captured.method = init?.method;
    captured.headers = init?.headers;
    captured.body = init?.body;
    return jsonResponse(body);
  };
}

describe("requireApiKey", () => {
  it("rejects a missing or blank key with an error naming RESEND_API_KEY", () => {
    assert.throws(() => requireApiKey(undefined), /RESEND_API_KEY/);
    assert.throws(() => requireApiKey("  "), /RESEND_API_KEY/);
    assert.equal(requireApiKey(" re_x "), "re_x");
  });
});

describe("sendEmail", () => {
  it("POSTs a JSON body to /emails with the Bearer key", async () => {
    const captured: Captured = {};
    const out = (await sendEmail(fakeFetch(captured, { id: "em_1" }), "re_x", {
      from: "Acme <hello@acme.example>",
      to: ["user@example.com"],
      subject: "Welcome",
      text: "Hello there",
    })) as { id: string };
    assert.equal(out.id, "em_1");
    assert.equal(captured.url, "https://api.resend.com/emails");
    assert.equal(captured.method, "POST");
    assert.equal(captured.headers?.Authorization, "Bearer re_x");
    assert.equal(captured.headers?.["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(captured.body ?? "{}"), {
      from: "Acme <hello@acme.example>",
      to: ["user@example.com"],
      subject: "Welcome",
      text: "Hello there",
    });
  });

  it("includes cc, bcc and reply_to only when provided", async () => {
    const captured: Captured = {};
    await sendEmail(fakeFetch(captured), "k", {
      from: "a@b.example",
      to: ["c@d.example"],
      subject: "S",
      cc: ["e@f.example"],
      reply_to: "reply@b.example",
    });
    const body = JSON.parse(captured.body ?? "{}") as Record<string, unknown>;
    assert.deepEqual(body.cc, ["e@f.example"]);
    assert.equal(body.reply_to, "reply@b.example");
    assert.ok(!("bcc" in body));
    assert.ok(!("html" in body));
  });

  it("fails before any request when the key is missing or to is empty", async () => {
    let called = false;
    const spy: FetchFn = async () => {
      called = true;
      return jsonResponse({});
    };
    await assert.rejects(
      () => sendEmail(spy, undefined, { from: "a@b.example", to: ["c@d.example"], subject: "S" }),
      /RESEND_API_KEY/,
    );
    await assert.rejects(
      () => sendEmail(spy, "k", { from: "a@b.example", to: [], subject: "S" }),
      /non-empty array/,
    );
    assert.equal(called, false);
  });
});

describe("emails read", () => {
  it("lists emails with an optional limit query parameter", async () => {
    const captured: Captured = {};
    await listEmails(fakeFetch(captured, { data: [] }), "k", { limit: 10 });
    assert.equal(captured.url, "https://api.resend.com/emails?limit=10");
    assert.equal(captured.method, "GET");
    await listEmails(fakeFetch(captured, { data: [] }), "k", {});
    assert.equal(captured.url, "https://api.resend.com/emails");
  });

  it("gets one email by ID", async () => {
    const captured: Captured = {};
    await getEmail(fakeFetch(captured), "k", { id: "em_42" });
    assert.equal(captured.url, "https://api.resend.com/emails/em_42");
    assert.equal(captured.method, "GET");
  });
});

describe("domains", () => {
  it("creates a domain with a JSON name/region body", async () => {
    const captured: Captured = {};
    await createDomain(fakeFetch(captured), "k", { name: "acme.example", region: "us-east-1" });
    assert.equal(captured.url, "https://api.resend.com/domains");
    assert.deepEqual(JSON.parse(captured.body ?? "{}"), {
      name: "acme.example",
      region: "us-east-1",
    });
  });

  it("lists domains with a bare GET", async () => {
    const captured: Captured = {};
    await listDomains(fakeFetch(captured, { data: [] }), "k");
    assert.equal(captured.url, "https://api.resend.com/domains");
    assert.equal(captured.body, undefined);
  });

  it("verifies a domain via POST /domains/:id/verify", async () => {
    const captured: Captured = {};
    await verifyDomain(fakeFetch(captured), "k", { id: "dom_1" });
    assert.equal(captured.url, "https://api.resend.com/domains/dom_1/verify");
    assert.equal(captured.method, "POST");
  });

  it("deletes a domain with DELETE", async () => {
    const captured: Captured = {};
    await deleteDomain(fakeFetch(captured), "k", { id: "dom_1" });
    assert.equal(captured.url, "https://api.resend.com/domains/dom_1");
    assert.equal(captured.method, "DELETE");
  });
});

describe("api keys", () => {
  it("creates an API key with name, permission and domain scope", async () => {
    const captured: Captured = {};
    await createApiKey(fakeFetch(captured), "k", {
      name: "CI sender",
      permission: "sending_access",
      domain_id: "dom_1",
    });
    assert.equal(captured.url, "https://api.resend.com/api-keys");
    assert.deepEqual(JSON.parse(captured.body ?? "{}"), {
      name: "CI sender",
      permission: "sending_access",
      domain_id: "dom_1",
    });
  });

  it("deletes an API key with DELETE /api-keys/:id", async () => {
    const captured: Captured = {};
    await deleteApiKey(fakeFetch(captured), "k", { id: "key_1" });
    assert.equal(captured.url, "https://api.resend.com/api-keys/key_1");
    assert.equal(captured.method, "DELETE");
  });
});

describe("audiences and contacts", () => {
  it("creates a contact under its audience path with a JSON body", async () => {
    const captured: Captured = {};
    await createContact(fakeFetch(captured), "k", {
      audience_id: "aud_1",
      email: "user@example.com",
      first_name: "Ada",
      unsubscribed: false,
    });
    assert.equal(captured.url, "https://api.resend.com/audiences/aud_1/contacts");
    assert.deepEqual(JSON.parse(captured.body ?? "{}"), {
      email: "user@example.com",
      first_name: "Ada",
      unsubscribed: false,
    });
  });

  it("lists contacts under the audience path with a limit", async () => {
    const captured: Captured = {};
    await listContacts(fakeFetch(captured, { data: [] }), "k", { audience_id: "aud_1", limit: 25 });
    assert.equal(captured.url, "https://api.resend.com/audiences/aud_1/contacts?limit=25");
  });
});

describe("error handling", () => {
  it("propagates HTTP failures with the API message", async () => {
    const failing: FetchFn = async () =>
      jsonResponse({ message: "The domain is not verified" }, 403, "Forbidden");
    await assert.rejects(
      () =>
        sendEmail(failing, "k", { from: "a@b.example", to: ["c@d.example"], subject: "S" }),
      /HTTP 403.*domain is not verified/,
    );
  });

  it("rejects an empty required field before any request", async () => {
    let called = false;
    const spy: FetchFn = async () => {
      called = true;
      return jsonResponse({});
    };
    await assert.rejects(() => createDomain(spy, "k", { name: " " }), /non-empty/);
    assert.equal(called, false);
  });
});
