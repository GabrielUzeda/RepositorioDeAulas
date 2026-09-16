export interface AiMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface AiConfig {
  provider: string;
  model: string;
  fallbackModel: string;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxTokens: number;
  anthropicVersion: string;
}

type AiRequestBody = OpenAiChatBody | AnthropicChatBody;

export interface AiProvider {
  readonly name: string;
  readonly chatPath: string;
  readonly modelsPath: string;
  buildHeaders(apiKey: string): Record<string, string>;
  buildBody(model: string, messages: AiMessage[], temperature: number, maxTokens: number): AiRequestBody;
  extractContent(data: unknown): string;
  extractError(data: unknown): string;
}

export interface AiChatOptions {
  messages: AiMessage[];
  temperature?: number;
  timeoutMs?: number;
  validate?: (content: string) => boolean;
}

export interface AiChatResult { content: string; modelUsed: string }

const VALID_PROVIDERS = ['opencode', '9router', 'openai', 'anthropic'];
const DEFAULT_MODEL = 'deepseek-v4.1-flash';
const DEFAULT_OPENCODE_BASE_URL = 'https://opencode.ai/zen/go/v1';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const DEFAULT_NINE_ROUTER_URL = 'http://127.0.0.1:20128/v1';
const DEFAULT_NINE_ROUTER_KEY = 'sk_local_9r';
const DEFAULT_UA = 'opencode/1.18.30';

function envNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function trimmed(value: string | undefined): string {
  return value ? value.trim() : '';
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function pickString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function parseJson(raw: string): JsonValue | undefined {
  try {
    return JSON.parse(raw) as JsonValue;
  } catch {
    return undefined;
  }
}

export function resolveConfig(): AiConfig {
  const provider = trimmed(process.env.AI_PROVIDER) || 'opencode';
  const explicitBaseUrl = trimmed(process.env.AI_BASE_URL);
  const explicitApiKey = trimmed(process.env.AI_API_KEY);
  const explicitModel = trimmed(process.env.AI_MODEL);
  const fallbackModel = trimmed(process.env.AI_FALLBACK_MODEL);
  const timeoutMs = envNumber(process.env.AI_TIMEOUT_MS, 180000);
  const maxTokens = envNumber(process.env.AI_MAX_TOKENS, 8192);
  const anthropicVersion = trimmed(process.env.AI_ANTHROPIC_VERSION) || '2023-06-01';

  let baseUrl: string;
  let apiKey: string;
  let model: string;

  if (provider === '9router') {
    baseUrl = explicitBaseUrl || trimmed(process.env.NINE_ROUTER_URL) || DEFAULT_NINE_ROUTER_URL;
    apiKey = explicitApiKey || trimmed(process.env.NINE_ROUTER_API_KEY) || DEFAULT_NINE_ROUTER_KEY;
    model = explicitModel || DEFAULT_MODEL;
  } else if (provider === 'openai') {
    baseUrl = explicitBaseUrl || DEFAULT_OPENAI_BASE_URL;
    apiKey = explicitApiKey;
    model = explicitModel || DEFAULT_MODEL;
  } else if (provider === 'anthropic') {
    baseUrl = explicitBaseUrl || DEFAULT_ANTHROPIC_BASE_URL;
    apiKey = explicitApiKey;
    model = explicitModel || DEFAULT_MODEL;
  } else if (provider === 'opencode') {
    baseUrl = explicitBaseUrl || trimmed(process.env.OPENCODE_BASE_URL) || DEFAULT_OPENCODE_BASE_URL;
    apiKey = explicitApiKey || trimmed(process.env.OPENCODE_API_KEY);
    model = explicitModel || trimmed(process.env.OPENCODE_MODEL) || DEFAULT_MODEL;
  } else {
    throw new Error(`Provider de IA desconhecido: ${provider}. Validos: ${VALID_PROVIDERS.join(', ')}`);
  }

  return {
    provider,
    model,
    fallbackModel,
    baseUrl: stripTrailingSlashes(baseUrl),
    apiKey,
    timeoutMs,
    maxTokens,
    anthropicVersion,
  };
}

interface OpenAiChatBody {
  model: string;
  messages: AiMessage[];
  temperature: number;
  max_tokens: number;
  stream: boolean;
}

interface AnthropicChatBody {
  model: string;
  system?: string;
  messages: { role: AiMessage['role']; content: string }[];
  temperature: number;
  max_tokens: number;
}

function extractErrorValue(data: unknown): string {
  const root = asRecord(data);
  if (!root) return typeof data === 'string' ? data : '';
  const error = root.error;
  const errorRecord = asRecord(error);
  if (errorRecord) return pickString(errorRecord.message);
  if (typeof error === 'string') return error;
  return '';
}

function extractRawBodyError(raw: string, provider: AiProvider): string {
  const parsed = parseJson(raw);
  if (parsed === undefined) return '';
  const root = asRecord(parsed);
  if (!root || !root.error) return '';
  return provider.extractError(parsed);
}

function createOpenAiProvider(name: string): AiProvider {
  return {
    name,
    chatPath: '/chat/completions',
    modelsPath: '/models',
    buildHeaders(apiKey: string): Record<string, string> {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      if (name === 'opencode') {
        const rid = crypto.randomUUID().replace(/-/g, '');
        headers['User-Agent'] = trimmed(process.env.OPENCODE_UA) || DEFAULT_UA;
        headers['x-opencode-client'] = 'cli';
        headers['x-opencode-project'] = 'global';
        headers['x-opencode-session'] = `ses_${rid}`;
        headers['x-opencode-request'] = `msg_${rid}`;
        headers['x-request-id'] = `req_${rid}`;
      }
      return headers;
    },
    buildBody(model: string, messages: AiMessage[], temperature: number, maxTokens: number): OpenAiChatBody {
      return {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      };
    },
    extractContent(data: unknown): string {
      const root = asRecord(data);
      const choices = root ? root.choices : undefined;
      if (!Array.isArray(choices) || choices.length === 0) return '';
      const first = asRecord(choices[0]);
      if (!first) return '';
      const message = asRecord(first.message);
      if (!message) return '';
      return pickString(message.content);
    },
    extractError(data: unknown): string {
      return extractErrorValue(data);
    },
  };
}

function createAnthropicProvider(anthropicVersion: string): AiProvider {
  return {
    name: 'anthropic',
    chatPath: '/messages',
    modelsPath: '/models',
    buildHeaders(apiKey: string): Record<string, string> {
      return {
        'x-api-key': apiKey,
        'anthropic-version': anthropicVersion,
        'Content-Type': 'application/json',
      };
    },
    buildBody(model: string, messages: AiMessage[], temperature: number, maxTokens: number): AnthropicChatBody {
      const systemParts: string[] = [];
      const rest: { role: AiMessage['role']; content: string }[] = [];
      for (const message of messages) {
        if (message.role === 'system') {
          systemParts.push(message.content);
        } else {
          rest.push({ role: message.role, content: message.content });
        }
      }
      const system = systemParts.join('\n\n');
      const payload: AnthropicChatBody = {
        model,
        messages: rest,
        temperature,
        max_tokens: maxTokens,
      };
      if (system) payload.system = system;
      return payload;
    },
    extractContent(data: unknown): string {
      const root = asRecord(data);
      const content = root ? root.content : undefined;
      if (!Array.isArray(content) || content.length === 0) return '';
      for (const item of content) {
        const record = asRecord(item);
        if (record && record.type === 'text') return pickString(record.text);
      }
      const first = asRecord(content[0]);
      return first ? pickString(first.text) : '';
    },
    extractError(data: unknown): string {
      return extractErrorValue(data);
    },
  };
}

export function resolveProvider(config?: AiConfig): AiProvider {
  const resolved = config ?? resolveConfig();
  if (resolved.provider === 'anthropic') return createAnthropicProvider(resolved.anthropicVersion);
  if (resolved.provider === 'opencode' || resolved.provider === '9router' || resolved.provider === 'openai') {
    return createOpenAiProvider(resolved.provider);
  }
  throw new Error(`Provider de IA desconhecido: ${resolved.provider}. Validos: ${VALID_PROVIDERS.join(', ')}`);
}

export function modelsUrl(config: AiConfig): string {
  const provider = resolveProvider(config);
  return `${stripTrailingSlashes(config.baseUrl)}${provider.modelsPath}`;
}

export function extractText(raw: string, provider: AiProvider): string {
  const direct = parseJson(raw);
  if (direct !== undefined) {
    const root = asRecord(direct);
    if (root && root.error) return '';
    const content = provider.extractContent(direct);
    if (content) return content;
  }

  const streamed: string[] = [];
  const lines = raw.split('\n');
  for (const line of lines) {
    const line_ = line.trim();
    if (!line_.startsWith('data:') || line_.includes('[DONE]')) continue;
    const payload = line_.replace(/^data:\s*/, '');
    const chunk = parseJson(payload);
    if (chunk === undefined) continue;
    let piece = provider.extractContent(chunk);
    if (!piece) {
      const choices = asRecord(chunk)?.choices;
      if (Array.isArray(choices) && choices.length > 0) {
        const delta = asRecord(asRecord(choices[0])?.delta);
        piece = delta ? pickString(delta.content) : '';
      }
    }
    if (!piece) {
      const delta = asRecord(asRecord(chunk)?.delta);
      piece = delta ? pickString(delta.text) : '';
    }
    if (piece) streamed.push(piece);
  }
  if (streamed.length > 0) return streamed.join('');

  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    const parsed = parseJson(match[0]);
    if (parsed !== undefined) {
      const content = provider.extractContent(parsed);
      if (content) return content;
    }
  }

  return '';
}

async function fetchNineRouter(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const customUrl = trimmed(process.env.NINE_ROUTER_URL);
  const isDefaultLocal = !customUrl && url.includes('127.0.0.1:20128');
  if (!isDefaultLocal) {
    return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  }
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(1500) });
  } catch {
    const fallbackUrl = url.replace('127.0.0.1:20128', 'host.docker.internal:20128');
    return fetch(fallbackUrl, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  }
}

export async function callAi(options: AiChatOptions): Promise<AiChatResult> {
  const config = resolveConfig();
  if (!config.apiKey) {
    throw new Error(`AI_API_KEY nao configurada para o provider ${config.provider}`);
  }

  const provider = resolveProvider(config);
  const models: string[] = [config.model];
  if (config.fallbackModel) models.push(config.fallbackModel);

  const endpoint = `${stripTrailingSlashes(config.baseUrl)}${provider.chatPath}`;
  const attemptTimeoutMs = options.timeoutMs ?? config.timeoutMs;
  let lastError = 'falha desconhecida';

  for (const model of models) {
    const body = JSON.stringify(
      provider.buildBody(model, options.messages, options.temperature ?? 0.3, config.maxTokens),
    );
    const headers = provider.buildHeaders(config.apiKey);
    try {
      const response = provider.name === '9router'
        ? await fetchNineRouter(endpoint, { method: 'POST', headers, body }, attemptTimeoutMs)
        : await fetch(endpoint, { method: 'POST', headers, body, signal: AbortSignal.timeout(attemptTimeoutMs) });

      if (response.ok) {
        const raw = await response.text();
        const content = extractText(raw, provider);
        if (content) {
          if (options.validate && !options.validate(content)) {
            lastError = `[${model}] resposta com formato invalido`;
            continue;
          }
          return { content, modelUsed: model };
        }
        const bodyError = extractRawBodyError(raw, provider);
        lastError = bodyError
          ? `[${model}] resposta sem conteudo: ${bodyError.slice(0, 200)}`
          : `[${model}] resposta sem conteudo`;
        continue;
      }

      const detail = await response.text().catch(() => '');
      const extracted = provider.extractError(parseJson(detail));
      const message = extracted || detail;
      lastError = `[${model}] HTTP ${response.status}: ${message.slice(0, 200)}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = `[${model}] ${message}`;
    }
  }

  throw new Error(`Falha na IA (${config.provider}/${config.model}): ${lastError}`);
}
