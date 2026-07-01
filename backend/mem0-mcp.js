#!/usr/bin/env node
/**
 * mem0 MCP Server — wraps self-hosted mem0 REST API
 * Protocol: Model Context Protocol (stdio JSON-RPC 2.0)
 */
import { createInterface } from 'node:readline';

const MEM0_BASE = process.env.MEM0_API_URL || 'http://192.168.15.59:8888';
const MEM0_KEY = process.env.MEM0_API_KEY || 'm0sk_42eVsnRK8B07oL19u6c5iZZqS2ldDl9bqBtotpGyY0s';
const USER_ID = 'opencode';

function reply(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function error(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

async function mem0Call(method, path, body) {
  const url = `${MEM0_BASE}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': MEM0_KEY }
  };
  if (body) opts.body = JSON.stringify(body);

  let attempts = 0;
  while (attempts < 3) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${errBody}`);
      }
      return await res.json();
    } catch (e) {
      attempts++;
      if (attempts >= 3) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

const handlers = {
  async initialize(params) {
    return {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'mem0-mcp', version: '1.0.0' },
      capabilities: { tools: {} }
    };
  },

  'tools/list': async () => ({
    tools: [
      {
        name: 'mem0_add',
        description: 'Store a memory in mem0. Use this to remember facts, decisions, patterns, and context across sessions.',
        inputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'The text content to store as a memory' },
            user_id: { type: 'string', description: 'User/agent identifier', default: USER_ID }
          },
          required: ['content']
        }
      },
      {
        name: 'mem0_search',
        description: 'Search memories in mem0 using semantic search. Use this to recall past context, decisions, and patterns.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query to find relevant memories' },
            user_id: { type: 'string', description: 'User/agent identifier', default: USER_ID }
          },
          required: ['query']
        }
      }
    ]
  }),

  'tools/call': async (params) => {
    const { name, arguments: args } = params;
    if (name === 'mem0_add') {
      const r = await mem0Call('POST', '/memories', {
        messages: [{ role: 'user', content: args.content }],
        user_id: args.user_id || USER_ID
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(r.results?.map(m => m.memory) || r) }]
      };
    }
    if (name === 'mem0_search') {
      const r = await mem0Call('POST', '/search', {
        query: args.query,
        user_id: args.user_id || USER_ID
      });
      const memories = (r.results || []).map(m => `- ${m.memory}`).join('\n');
      return {
        content: [{ type: 'text', text: memories || 'No memories found.' }]
      };
    }
    throw new Error(`Unknown tool: ${name}`);
  }
};

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on('line', async (line) => {
  try {
    const msg = JSON.parse(line);
    const handler = handlers[msg.method];
    if (!handler) {
      error(msg.id, -32601, `Method not found: ${msg.method}`);
      return;
    }
    const result = await handler(msg.params);
    reply(msg.id, result);
  } catch (e) {
    error(null, -32603, e.message);
  }
});

// Signal readiness
process.stderr.write('[mem0-mcp] Ready on ' + MEM0_BASE + '\n');
