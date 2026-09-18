import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import {
  callAi,
  extractText,
  modelsUrl,
  resolveProvider,
  type AiConfig,
  type AiProvider,
} from './aiProvider';

interface RecordedRequest {
  url: string;
  pathname: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

const ENV_KEYS = [
  'AI_PROVIDER',
  'AI_MODEL',
  'AI_FALLBACK_MODEL',
  'AI_BASE_URL',
  'AI_API_KEY',
  'AI_MAX_TOKENS',
  'AI_ANTHROPIC_VERSION',
] as const;

const originalEnv = new Map<string, string | undefined>();
const requests: RecordedRequest[] = [];

let server: ReturnType<typeof Bun.serve>;
let origin = '';

type MockHandler = (request: RecordedRequest) => Response;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function parseBody(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const openAiSuccess: MockHandler = () =>
  jsonResponse(200, { choices: [{ message: { content: 'resposta openai' } }] });

const anthropicSuccess: MockHandler = () =>
  jsonResponse(200, { content: [{ type: 'text', text: 'resposta anthropic' }] });

let mockHandler: MockHandler = openAiSuccess;

function applyEnv(values: Record<string, string>): void {
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
}

beforeAll(() => {
  for (const key of ENV_KEYS) originalEnv.set(key, process.env[key]);
  server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(request: Request): Promise<Response> {
      const rawBody = await request.text();
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      const recorded: RecordedRequest = {
        url: request.url,
        pathname: new URL(request.url).pathname,
        method: request.method,
        headers,
        body: parseBody(rawBody),
      };
      requests.push(recorded);
      return mockHandler(recorded);
    },
  });
  origin = `http://127.0.0.1:${server.port}`;
});

afterAll(() => {
  server.stop(true);
  for (const key of ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  requests.length = 0;
  mockHandler = openAiSuccess;
  applyEnv({});
});

describe('AI Provider Abstraction', () => {
  test('openai envia path, headers e body corretos', async () => {
    applyEnv({
      AI_PROVIDER: 'openai',
      AI_BASE_URL: `${origin}/v1`,
      AI_API_KEY: 'chave-teste',
      AI_MODEL: 'deepseek-v4.1-flash',
      AI_FALLBACK_MODEL: '',
      AI_MAX_TOKENS: '8192',
    });
    mockHandler = openAiSuccess;

    const result = await callAi({ messages: [{ role: 'user', content: 'oi' }] });

    expect(result).toEqual({ content: 'resposta openai', modelUsed: 'deepseek-v4.1-flash' });
    expect(requests).toHaveLength(1);
    const request = requests[0];
    expect(request.method).toBe('POST');
    expect(request.pathname).toBe('/v1/chat/completions');
    expect(request.headers['authorization']).toBe('Bearer chave-teste');
    expect(request.headers['content-type']).toContain('application/json');

    const body = asRecord(request.body);
    expect(body).not.toBeNull();
    if (!body) throw new Error('body ausente');
    expect(body.model).toBe('deepseek-v4.1-flash');
    expect(body.temperature).toBe(0.3);
    expect(body.max_tokens).toBe(8192);
    expect(body.stream).toBe(false);
    const messages = body.messages;
    expect(Array.isArray(messages)).toBe(true);
    if (!Array.isArray(messages)) throw new Error('messages ausente');
    expect(messages).toHaveLength(1);
    const first = asRecord(messages[0]);
    expect(first?.role).toBe('user');
    expect(first?.content).toBe('oi');
  });

  test('anthropic usa Messages API com system top-level', async () => {
    applyEnv({
      AI_PROVIDER: 'anthropic',
      AI_BASE_URL: `${origin}/v1`,
      AI_API_KEY: 'chave-teste',
      AI_MODEL: 'claude-teste',
      AI_FALLBACK_MODEL: '',
    });
    mockHandler = anthropicSuccess;

    const result = await callAi({
      messages: [
        { role: 'system', content: 'voce e um assistente' },
        { role: 'user', content: 'oi' },
      ],
    });

    expect(result.content).toBe('resposta anthropic');
    expect(result.modelUsed).toBe('claude-teste');
    expect(requests).toHaveLength(1);
    const request = requests[0];
    expect(request.method).toBe('POST');
    expect(request.pathname).toBe('/v1/messages');
    expect(request.headers['x-api-key']).toBe('chave-teste');
    expect(request.headers['anthropic-version']).toBe('2023-06-01');

    const body = asRecord(request.body);
    expect(body).not.toBeNull();
    if (!body) throw new Error('body ausente');
    expect(body.system).toBe('voce e um assistente');
    const messages = body.messages;
    expect(Array.isArray(messages)).toBe(true);
    if (!Array.isArray(messages)) throw new Error('messages ausente');
    expect(messages).toHaveLength(1);
    const first = asRecord(messages[0]);
    expect(first?.role).toBe('user');
    expect(typeof body.max_tokens).toBe('number');
  });

  test('sem API key lanca sem tocar a rede', async () => {
    applyEnv({
      AI_PROVIDER: 'anthropic',
      AI_BASE_URL: `${origin}/v1`,
      AI_API_KEY: '',
      AI_MODEL: 'claude-teste',
    });
    mockHandler = anthropicSuccess;

    await expect(callAi({ messages: [{ role: 'user', content: 'oi' }] })).rejects.toThrow(
      /AI_API_KEY/
    );
    expect(requests).toHaveLength(0);
  });

  test('faz fallback para o modelo reserva', async () => {
    applyEnv({
      AI_PROVIDER: 'openai',
      AI_BASE_URL: `${origin}/v1`,
      AI_API_KEY: 'chave-teste',
      AI_MODEL: 'modelo-primario',
      AI_FALLBACK_MODEL: 'modelo-reserva',
    });
    mockHandler = (request) => {
      const body = asRecord(request.body);
      if (body?.model === 'modelo-primario') {
        return jsonResponse(500, { error: { message: 'indisponivel' } });
      }
      return jsonResponse(200, { choices: [{ message: { content: 'veio do reserva' } }] });
    };

    const result = await callAi({ messages: [{ role: 'user', content: 'oi' }] });

    expect(result).toEqual({ content: 'veio do reserva', modelUsed: 'modelo-reserva' });
    expect(requests).toHaveLength(2);
    const first = asRecord(requests[0].body);
    const second = asRecord(requests[1].body);
    expect(first?.model).toBe('modelo-primario');
    expect(second?.model).toBe('modelo-reserva');
  });

  test('validate reprovado no modelo primario aciona o fallback', async () => {
    applyEnv({
      AI_PROVIDER: 'openai',
      AI_BASE_URL: `${origin}/v1`,
      AI_API_KEY: 'chave-teste',
      AI_MODEL: 'modelo-primario',
      AI_FALLBACK_MODEL: 'modelo-reserva',
    });
    mockHandler = (request) => {
      const body = asRecord(request.body);
      if (body?.model === 'modelo-primario') {
        return jsonResponse(200, { choices: [{ message: { content: 'isto nao e json valido' } }] });
      }
      return jsonResponse(200, { choices: [{ message: { content: '{"ok":true}' } }] });
    };

    const result = await callAi({
      messages: [{ role: 'user', content: 'oi' }],
      validate: (content) => {
        try {
          JSON.parse(content);
          return true;
        } catch {
          return false;
        }
      },
    });

    expect(result).toEqual({ content: '{"ok":true}', modelUsed: 'modelo-reserva' });
    expect(requests).toHaveLength(2);
    const first = asRecord(requests[0].body);
    const second = asRecord(requests[1].body);
    expect(first?.model).toBe('modelo-primario');
    expect(second?.model).toBe('modelo-reserva');
  });

  test('validate reprovado em todos os modelos lanca', async () => {
    applyEnv({
      AI_PROVIDER: 'openai',
      AI_BASE_URL: `${origin}/v1`,
      AI_API_KEY: 'chave-teste',
      AI_MODEL: 'modelo-primario',
      AI_FALLBACK_MODEL: 'modelo-reserva',
    });
    mockHandler = () =>
      jsonResponse(200, { choices: [{ message: { content: 'isto nao e json valido' } }] });

    await expect(
      callAi({ messages: [{ role: 'user', content: 'oi' }], validate: () => false })
    ).rejects.toThrow(/Falha na IA/);
    expect(requests).toHaveLength(2);
  });

  test('sem validate o conteudo e aceito mesmo fora do formato', async () => {
    applyEnv({
      AI_PROVIDER: 'openai',
      AI_BASE_URL: `${origin}/v1`,
      AI_API_KEY: 'chave-teste',
      AI_MODEL: 'modelo-primario',
      AI_FALLBACK_MODEL: 'modelo-reserva',
    });
    mockHandler = () =>
      jsonResponse(200, { choices: [{ message: { content: 'prosa qualquer' } }] });

    const result = await callAi({ messages: [{ role: 'user', content: 'oi' }] });

    expect(result).toEqual({ content: 'prosa qualquer', modelUsed: 'modelo-primario' });
    expect(requests).toHaveLength(1);
  });

  test('extractText le streaming SSE do anthropic', () => {
    const provider: AiProvider = resolveProvider({
      provider: 'anthropic',
      model: 'm',
      fallbackModel: '',
      baseUrl: 'http://x',
      apiKey: 'k',
      timeoutMs: 1000,
      maxTokens: 10,
      anthropicVersion: '2023-06-01',
    });
    const raw =
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"parte A"}}\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"parte B"}}\n\ndata: [DONE]\n';

    expect(extractText(raw, provider)).toBe('parte Aparte B');
  });

  test('extractText le openai nao-streaming e tolera erro', () => {
    const config: AiConfig = {
      provider: 'openai',
      model: 'm',
      fallbackModel: '',
      baseUrl: 'http://x/v1',
      apiKey: 'k',
      timeoutMs: 1000,
      maxTokens: 10,
      anthropicVersion: '2023-06-01',
    };
    const provider = resolveProvider(config);

    expect(extractText('{"choices":[{"message":{"content":"texto direto"}}]}', provider)).toBe(
      'texto direto'
    );
    expect(extractText('{"error":{"message":"quota"}}', provider)).toBe('');
  });

  test('modelsUrl nao duplica /v1', () => {
    const config: AiConfig = {
      provider: 'openai',
      model: 'm',
      fallbackModel: '',
      baseUrl: 'http://x/v1',
      apiKey: 'k',
      timeoutMs: 1000,
      maxTokens: 10,
      anthropicVersion: '2023-06-01',
    };

    const url = modelsUrl(config);
    expect(url.endsWith('/v1/models')).toBe(true);
    expect(url.includes('/v1/v1/')).toBe(false);
  });
});
