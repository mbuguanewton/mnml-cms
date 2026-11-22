import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { agentTokens } from './tokens.js';
import type { ContentService } from '../content/content.js';
import type { AgentScope, Context } from '../context.js';
import { mcpTools, type Agent, type Tool, type ToolResult } from './tools.js';

// The MCP server at <apiPath>/mcp: Streamable HTTP without sessions or streaming. Each POST carries one JSON-RPC
// message and gets one JSON response. Agents sign in with a bearer token: one from the `mcp.tokens` option, or one an
// editor created in the admin (`mcp.adminTokens`).

const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const DEFAULT_SCOPES: AgentScope[] = ['read', 'draft'];
const MIN_TOKEN_LENGTH = 32;

const INSTRUCTIONS =
  'Manages the content of this site. Call get_schema first. Writes are drafts and never change the live site; ' +
  'publish makes them live. Show the user diff_entry or get_preview_url before publishing.';

type Id = string | number | null;
const reply = (id: Id, result: unknown) => Response.json({ jsonrpc: '2.0', id, result });
const fail = (id: Id, code: number, message: string, status = 200, headers?: HeadersInit) =>
  Response.json({ jsonrpc: '2.0', id, error: { code, message } }, { status, headers });

const digest = (s: string) => createHash('sha256').update(s).digest();

const toolResult = (r: ToolResult) => ({ content: [{ type: 'text', text: JSON.stringify(r) }], isError: !r.ok });

function inputSchema(tool: Tool) {
  const { $schema: _, ...schema } = z.toJSONSchema(tool.input, { io: 'input' }) as Record<string, unknown>;
  return schema;
}

export function createMcpHandler(ctx: Context, content: ContentService) {
  const keys = Object.keys(ctx.config);
  const tokens = (ctx.options.mcp?.tokens ?? []).flatMap((t, i) => {
    if (!t.token) return [];
    if (t.token.length < MIN_TOKEN_LENGTH) {
      console.warn(`mnml-cms: MCP token ${t.name ?? i} is shorter than ${MIN_TOKEN_LENGTH} characters and is ignored.`);
      return [];
    }
    const unknown = (t.collections ?? []).filter((k) => !keys.includes(k));
    if (unknown.length) console.warn(`mnml-cms: MCP token ${t.name ?? i} names unknown content: ${unknown.join(', ')}.`);
    const agent: Agent = {
      name: t.name ?? 'agent',
      scopes: new Set(t.scopes ?? DEFAULT_SCOPES),
      keys: t.collections ? keys.filter((k) => t.collections!.includes(k)) : keys,
    };
    return [{ digest: digest(t.token), agent }];
  });

  const stored = ctx.options.mcp?.adminTokens ? agentTokens(ctx) : null;
  // No usable config token (e.g. the env value is unset) and no admin tokens: the route stays off.
  if (tokens.length === 0 && !stored) return null;

  /**
   * The agent whose token is in the Authorization header. Config tokens are all compared in constant time; then an
   * admin-created token is looked up by its hash (a high-entropy token, so the lookup reveals nothing).
   */
  async function authenticate(request: Request): Promise<Agent | null> {
    const m = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get('authorization') ?? '');
    if (!m) return null;
    const given = digest(m[1]);
    let found: Agent | null = null;
    for (const t of tokens) if (timingSafeEqual(given, t.digest) && !found) found = t.agent;
    if (found || !stored) return found;
    const hit = await stored.find(m[1]);
    if (!hit) return null;
    await stored.touch(hit.id, hit.data);
    const allowed = hit.data.collections;
    return { name: hit.data.name, scopes: new Set(hit.data.scopes), keys: allowed ? keys.filter((k) => allowed.includes(k)) : keys };
  }

  return async function handleMcp(request: Request): Promise<Response> {
    const agent = await authenticate(request);
    if (!agent) return fail(null, -32001, 'Unauthorized. Send Authorization: Bearer <agent token>.', 401, { 'WWW-Authenticate': 'Bearer realm="mnml-cms"' });

    let msg: { jsonrpc?: unknown; id?: Id; method?: unknown; params?: Record<string, unknown> };
    try {
      msg = await request.json();
    } catch {
      return fail(null, -32700, 'Parse error.', 400);
    }
    if (Array.isArray(msg)) return fail(null, -32600, 'Batches are not supported.', 400);
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0') return fail(null, -32600, 'Invalid request.', 400);
    // Notifications (no id) and responses need no answer.
    if (msg.id === undefined || typeof msg.method !== 'string') return new Response(null, { status: 202 });
    const id = msg.id;
    const params = msg.params ?? {};

    switch (msg.method) {
      case 'initialize': {
        const asked = params.protocolVersion;
        return reply(id, {
          protocolVersion: typeof asked === 'string' && PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'mnml-cms', title: 'mnml CMS', version: '1.0.0' },
          instructions: INSTRUCTIONS,
        });
      }
      case 'ping':
        return reply(id, {});
      case 'tools/list': {
        const tools = mcpTools(ctx, content, agent).filter((t) => agent.scopes.has(t.scope));
        return reply(id, {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: inputSchema(t),
            ...(t.annotations && { annotations: t.annotations }),
          })),
        });
      }
      case 'tools/call': {
        const tool = mcpTools(ctx, content, agent).find((t) => t.name === params.name);
        if (!tool) return fail(id, -32602, `Unknown tool: ${String(params.name)}.`);
        if (!agent.scopes.has(tool.scope)) {
          return reply(id, toolResult({ ok: false, message: `This token lacks the "${tool.scope}" scope, which ${tool.name} needs.` }));
        }
        const args = tool.input.safeParse(params.arguments ?? {});
        if (!args.success) {
          const errors = Object.fromEntries(args.error.issues.map((i) => [i.path.join('.') || '$', i.message]));
          return reply(id, toolResult({ ok: false, message: 'Invalid arguments.', errors }));
        }
        try {
          return reply(id, toolResult(await tool.run(args.data, { agent, origin: new URL(request.url).origin })));
        } catch (e) {
          console.error(`cms MCP tool ${tool.name} failed:`, e);
          return reply(id, toolResult({ ok: false, message: (e as Error).message }));
        }
      }
      default:
        return fail(id, -32601, `Method not found: ${msg.method}.`);
    }
  };
}
