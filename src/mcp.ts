/**
 * mailsend MCP server. Tools (15, a documented Resend core subset):
 * send_email, list_emails, get_email, create_domain, list_domains,
 * get_domain, verify_domain, delete_domain, create_api_key,
 * list_api_keys, delete_api_key, create_audience, list_audiences,
 * create_contact, list_contacts.
 *
 * Why the low-level Server instead of McpServer: the high-level helper
 * converts zod schemas to JSON Schema and injects keys that are not in
 * this tool's public spec ("$schema" and "additionalProperties"), which
 * breaks exact tool-list/schema parity with the spec. This file serves
 * tools/list with the spec's exact input schemas as explicit literals,
 * while zod still validates every tools/call argument set.
 *
 * The Resend API key is read from RESEND_API_KEY at call time; a
 * missing key returns an honest isError result naming the variable
 * instead of failing the handshake.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  createApiKey,
  createAudience,
  createContact,
  createDomain,
  deleteApiKey,
  deleteDomain,
  formatResult,
  getDomain,
  getEmail,
  listApiKeys,
  listAudiences,
  listContacts,
  listDomains,
  listEmails,
  sendEmail,
  verifyDomain,
  VERSION,
} from "./mail.js";
import type { FetchFn } from "./types.js";

const SendEmailArgs = z.object({
  from: z.string(),
  to: z.array(z.string()),
  subject: z.string(),
  html: z.string().optional(),
  text: z.string().optional(),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
  reply_to: z.string().optional(),
});
const ListEmailsArgs = z.object({ limit: z.number().int().optional() });
const IdArgs = z.object({ id: z.string() });
const EmptyArgs = z.object({});
const CreateDomainArgs = z.object({ name: z.string(), region: z.string().optional() });
const CreateApiKeyArgs = z.object({
  name: z.string(),
  permission: z.string().optional(),
  domain_id: z.string().optional(),
});
const CreateAudienceArgs = z.object({ name: z.string() });
const CreateContactArgs = z.object({
  audience_id: z.string(),
  email: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  unsubscribed: z.boolean().optional(),
});
const ListContactsArgs = z.object({
  audience_id: z.string(),
  limit: z.number().int().optional(),
});

const STR = { type: "string" } as const;
const INT = { type: "integer" } as const;
const STR_ARRAY = { type: "array", items: { type: "string" } } as const;

const TOOLS = [
  {
    name: "send_email",
    description: "Send an email through Resend.",
    inputSchema: {
      type: "object" as const,
      properties: {
        from: { type: "string", description: "The sender email address, optionally in 'Name <email@example.com>' format." },
        to: { type: "array", items: { type: "string" }, description: "The recipient email addresses to send the email to." },
        subject: { type: "string", description: "The subject line of the email." },
        html: { type: "string", description: "The HTML body of the email." },
        text: { type: "string", description: "The plain-text body of the email." },
        cc: { type: "array", items: { type: "string" }, description: "Email addresses to copy on the email (carbon copy recipients)." },
        bcc: { type: "array", items: { type: "string" }, description: "Email addresses to blind-copy on the email (hidden recipients)." },
        reply_to: { type: "string", description: "The email address replies to this email should be sent to." },
      },
      required: ["from", "to", "subject"],
    },
  },
  {
    name: "list_emails",
    description: "List emails sent through Resend.",
    inputSchema: {
      type: "object" as const,
      properties: { limit: { type: "integer", description: "The maximum number of sent emails to return." } },
      required: [] as string[],
    },
  },
  {
    name: "get_email",
    description: "Get one sent email by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: { id: { type: "string", description: "The ID of the sent email to retrieve." } },
      required: ["id"],
    },
  },
  {
    name: "create_domain",
    description: "Create a sending domain in Resend.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "The domain name to create as a sending domain." },
        region: { type: "string", description: "The region to create the domain in, such as 'us-east-1'." },
      },
      required: ["name"],
    },
  },
  {
    name: "list_domains",
    description: "List sending domains in Resend.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_domain",
    description: "Get one sending domain by its ID, including its DNS records.",
    inputSchema: {
      type: "object" as const,
      properties: { id: { type: "string", description: "The ID of the sending domain to retrieve." } },
      required: ["id"],
    },
  },
  {
    name: "verify_domain",
    description: "Start verification of a sending domain's DNS records.",
    inputSchema: {
      type: "object" as const,
      properties: { id: { type: "string", description: "The ID of the sending domain to start DNS verification for." } },
      required: ["id"],
    },
  },
  {
    name: "delete_domain",
    description: "Delete a sending domain from Resend.",
    inputSchema: {
      type: "object" as const,
      properties: { id: { type: "string", description: "The ID of the sending domain to delete." } },
      required: ["id"],
    },
  },
  {
    name: "create_api_key",
    description: "Create a Resend API key, optionally scoped to one domain.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "The name for the new API key." },
        permission: { type: "string", description: "The permission level for the API key, such as 'full_access' or 'sending_access'." },
        domain_id: { type: "string", description: "The ID of the domain to scope this API key to." },
      },
      required: ["name"],
    },
  },
  {
    name: "list_api_keys",
    description: "List Resend API keys.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "delete_api_key",
    description: "Delete a Resend API key.",
    inputSchema: {
      type: "object" as const,
      properties: { id: { type: "string", description: "The ID of the API key to delete." } },
      required: ["id"],
    },
  },
  {
    name: "create_audience",
    description: "Create an audience in Resend.",
    inputSchema: {
      type: "object" as const,
      properties: { name: { type: "string", description: "The name for the new audience." } },
      required: ["name"],
    },
  },
  {
    name: "list_audiences",
    description: "List audiences in Resend.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "create_contact",
    description: "Add a contact to an audience in Resend.",
    inputSchema: {
      type: "object" as const,
      properties: {
        audience_id: { type: "string", description: "The ID of the audience to add the contact to." },
        email: { type: "string", description: "The contact's email address." },
        first_name: { type: "string", description: "The contact's first name." },
        last_name: { type: "string", description: "The contact's last name." },
        unsubscribed: { type: "boolean", description: "Whether the contact is unsubscribed from the audience." },
      },
      required: ["audience_id", "email"],
    },
  },
  {
    name: "list_contacts",
    description: "List contacts in an audience in Resend.",
    inputSchema: {
      type: "object" as const,
      properties: {
        audience_id: { type: "string", description: "The ID of the audience whose contacts to list." },
        limit: { type: "integer", description: "The maximum number of contacts to return." },
      },
      required: ["audience_id"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "mailsend", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const apiKey = process.env.RESEND_API_KEY;
  try {
    let out: unknown;
    if (name === "send_email") {
      out = await sendEmail(fetchFn, apiKey, SendEmailArgs.parse(args ?? {}));
    } else if (name === "list_emails") {
      out = await listEmails(fetchFn, apiKey, ListEmailsArgs.parse(args ?? {}));
    } else if (name === "get_email") {
      out = await getEmail(fetchFn, apiKey, IdArgs.parse(args ?? {}));
    } else if (name === "create_domain") {
      out = await createDomain(fetchFn, apiKey, CreateDomainArgs.parse(args ?? {}));
    } else if (name === "list_domains") {
      EmptyArgs.parse(args ?? {});
      out = await listDomains(fetchFn, apiKey);
    } else if (name === "get_domain") {
      out = await getDomain(fetchFn, apiKey, IdArgs.parse(args ?? {}));
    } else if (name === "verify_domain") {
      out = await verifyDomain(fetchFn, apiKey, IdArgs.parse(args ?? {}));
    } else if (name === "delete_domain") {
      out = await deleteDomain(fetchFn, apiKey, IdArgs.parse(args ?? {}));
    } else if (name === "create_api_key") {
      out = await createApiKey(fetchFn, apiKey, CreateApiKeyArgs.parse(args ?? {}));
    } else if (name === "list_api_keys") {
      EmptyArgs.parse(args ?? {});
      out = await listApiKeys(fetchFn, apiKey);
    } else if (name === "delete_api_key") {
      out = await deleteApiKey(fetchFn, apiKey, IdArgs.parse(args ?? {}));
    } else if (name === "create_audience") {
      out = await createAudience(fetchFn, apiKey, CreateAudienceArgs.parse(args ?? {}));
    } else if (name === "list_audiences") {
      EmptyArgs.parse(args ?? {});
      out = await listAudiences(fetchFn, apiKey);
    } else if (name === "create_contact") {
      out = await createContact(fetchFn, apiKey, CreateContactArgs.parse(args ?? {}));
    } else if (name === "list_contacts") {
      out = await listContacts(fetchFn, apiKey, ListContactsArgs.parse(args ?? {}));
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatResult(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
