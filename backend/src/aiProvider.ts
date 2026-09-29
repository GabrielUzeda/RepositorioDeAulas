export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

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
  buildBody(
    model: string,
    messages: AiMessage[],
    temperature: number,
    maxTokens: number
  ): AiRequestBody;
  extractContent(data: unknown): string;
  extractError(data: unknown): string;
  isTruncated?(data: unknown, rawText?: string): boolean;
}

export interface AiChatOptions {
  messages: AiMessage[];
  temperature?: number;
  timeoutMs?: number;
  maxTokens?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  validate?: (content: string) => boolean;
}

export interface AiChatResult {
  content: string;
  modelUsed: string;
}

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

function extractUsage(parsed: unknown, raw: string): { prompt_tokens: number; completion_tokens: number; reasoning_tokens: number } {
  let prompt_tokens = 0;
  let completion_tokens = 0;
  let reasoning_tokens = 0;

  const root = asRecord(parsed);
  if (root) {
    const usage = asRecord(root.usage);
    if (usage) {
      prompt_tokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
      completion_tokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
      const details = asRecord(usage.completion_tokens_details);
      reasoning_tokens = Number(details?.reasoning_tokens ?? usage.reasoning_tokens ?? 0);
    }
  }

  if (raw && typeof raw === 'string') {
    const lines = raw.split('\n');
    for (const line of lines) {
      const line_ = line.trim();
      if (line_.startsWith('data:') && !line_.includes('[DONE]')) {
        const payload = line_.replace(/^data:\s*/, '');
        const chunk = parseJson(payload);
        const chunkRoot = asRecord(chunk);
        if (chunkRoot) {
          const usage = asRecord(chunkRoot.usage);
          if (usage) {
            prompt_tokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? prompt_tokens);
            completion_tokens = Number(usage.completion_tokens ?? usage.output_tokens ?? completion_tokens);
            const details = asRecord(usage.completion_tokens_details);
            reasoning_tokens = Number(details?.reasoning_tokens ?? usage.reasoning_tokens ?? reasoning_tokens);
          }
        }
      }
    }
  }

  return { prompt_tokens, completion_tokens, reasoning_tokens };
}

function extractFinishReason(parsed: unknown, raw: string): string {
  const root = asRecord(parsed);
  if (root) {
    const choices = root.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const ch = asRecord(choices[0]);
      if (ch && typeof ch.finish_reason === 'string') {
        return ch.finish_reason;
      }
    }
    if (typeof root.stop_reason === 'string') {
      return root.stop_reason;
    }
    if (typeof root.finish_reason === 'string') {
      return root.finish_reason;
    }
  }

  if (raw && typeof raw === 'string') {
    const match = raw.match(/["']?finish_reason["']?\s*:\s*["']([^"']+)["']/);
    if (match && match[1]) return match[1];
    const matchStop = raw.match(/["']?stop_reason["']?\s*:\s*["']([^"']+)["']/);
    if (matchStop && matchStop[1]) return matchStop[1];

    const lines = raw.split('\n');
    for (const line of lines) {
      const line_ = line.trim();
      if (line_.startsWith('data:') && !line_.includes('[DONE]')) {
        const payload = line_.replace(/^data:\s*/, '');
        const chunk = parseJson(payload);
        const chunkRoot = asRecord(chunk);
        if (chunkRoot) {
          const choices = chunkRoot.choices;
          if (Array.isArray(choices) && choices.length > 0) {
            const ch = asRecord(choices[0]);
            if (ch && typeof ch.finish_reason === 'string') {
              return ch.finish_reason;
            }
          }
          if (typeof chunkRoot.stop_reason === 'string') {
            return chunkRoot.stop_reason;
          }
        }
      }
    }
  }

  return 'stop';
}

export function isResponseTruncated(raw: string, data?: unknown): boolean {
  const parsed = data !== undefined ? data : parseJson(raw);
  const root = asRecord(parsed);

  if (root) {
    const choices = root.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      for (const choice of choices) {
        const ch = asRecord(choice);
        if (ch && (ch.finish_reason === 'length' || ch.finish_reason === 'max_tokens')) {
          return true;
        }
      }
    }
    if (root.stop_reason === 'max_tokens' || root.stop_reason === 'length') {
      return true;
    }
  }

  if (raw && typeof raw === 'string') {
    if (
      /["']?finish_reason["']?\s*:\s*["']length["']/.test(raw) ||
      /["']?stop_reason["']?\s*:\s*["']max_tokens["']/.test(raw) ||
      /["']?finish_reason["']?\s*:\s*["']max_tokens["']/.test(raw)
    ) {
      return true;
    }
    const lines = raw.split('\n');
    for (const line of lines) {
      const line_ = line.trim();
      if (line_.startsWith('data:') && !line_.includes('[DONE]')) {
        const payload = line_.replace(/^data:\s*/, '');
        const chunk = parseJson(payload);
        const chunkRoot = asRecord(chunk);
        if (chunkRoot) {
          const choices = chunkRoot.choices;
          if (Array.isArray(choices) && choices.length > 0) {
            for (const choice of choices) {
              const ch = asRecord(choice);
              if (ch && (ch.finish_reason === 'length' || ch.finish_reason === 'max_tokens')) {
                return true;
              }
            }
          }
          if (chunkRoot.stop_reason === 'max_tokens' || chunkRoot.stop_reason === 'length') {
            return true;
          }
        }
      }
    }
  }

  return false;
}

export function resolveConfig(): AiConfig {
  const provider = trimmed(process.env.AI_PROVIDER) || 'opencode';
  const explicitBaseUrl = trimmed(process.env.AI_BASE_URL);
  const explicitApiKey = trimmed(process.env.AI_API_KEY);
  const explicitModel = trimmed(process.env.AI_MODEL);
  const fallbackModel = trimmed(process.env.AI_FALLBACK_MODEL);
  const timeoutMs = envNumber(process.env.AI_TIMEOUT_MS, 180000);
  const defaultMaxTokens = provider === 'opencode' || provider === '9router' ? 16384 : 8192;
  const maxTokens = envNumber(process.env.AI_MAX_TOKENS, defaultMaxTokens);
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
    baseUrl =
      explicitBaseUrl || trimmed(process.env.OPENCODE_BASE_URL) || DEFAULT_OPENCODE_BASE_URL;
    apiKey = explicitApiKey || trimmed(process.env.OPENCODE_API_KEY);
    model = explicitModel || trimmed(process.env.OPENCODE_MODEL) || DEFAULT_MODEL;
  } else {
    throw new Error(
      `Provider de IA desconhecido: ${provider}. Validos: ${VALID_PROVIDERS.join(', ')}`
    );
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
    buildBody(
      model: string,
      messages: AiMessage[],
      temperature: number,
      maxTokens: number
    ): OpenAiChatBody {
      return {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      };
    },
    extractContent(data: unknown): string {
      const root = asRecord(data);
      const choices = root ? root.choices : undefined;
      if (!Array.isArray(choices) || choices.length === 0) return '';
      const first = asRecord(choices[0]);
      if (!first) return '';
      const message = asRecord(first.message);
      if (message) {
        return pickString(message.content);
      }
      const delta = asRecord(first.delta);
      if (delta) {
        return pickString(delta.content) || pickString(delta.text);
      }
      return '';
    },
    extractError(data: unknown): string {
      return extractErrorValue(data);
    },
    isTruncated(data: unknown, rawText?: string): boolean {
      const root = asRecord(data);
      const choices = root ? root.choices : undefined;
      if (Array.isArray(choices) && choices.length > 0) {
        for (const ch of choices) {
          const record = asRecord(ch);
          if (record && (record.finish_reason === 'length' || record.finish_reason === 'max_tokens')) return true;
        }
      }
      if (rawText) {
        if (/["']?finish_reason["']?\s*:\s*["']length["']/.test(rawText) || /["']?finish_reason["']?\s*:\s*["']max_tokens["']/.test(rawText)) {
          return true;
        }
        const lines = rawText.split('\n');
        for (const line of lines) {
          const line_ = line.trim();
          if (line_.startsWith('data:') && !line_.includes('[DONE]')) {
            const payload = line_.replace(/^data:\s*/, '');
            const chunk = parseJson(payload);
            const chunkRoot = asRecord(chunk);
            const chs = chunkRoot?.choices;
            if (Array.isArray(chs) && chs.length > 0) {
              for (const c of chs) {
                const rec = asRecord(c);
                if (rec && (rec.finish_reason === 'length' || rec.finish_reason === 'max_tokens')) return true;
              }
            }
          }
        }
      }
      return false;
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
    buildBody(
      model: string,
      messages: AiMessage[],
      temperature: number,
      maxTokens: number
    ): AnthropicChatBody {
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
    isTruncated(data: unknown, rawText?: string): boolean {
      const root = asRecord(data);
      if (root && (root.stop_reason === 'max_tokens' || root.stop_reason === 'length')) return true;
      if (rawText && (/["']?stop_reason["']?\s*:\s*["']max_tokens["']/.test(rawText) || /["']?stop_reason["']?\s*:\s*["']length["']/.test(rawText))) {
        return true;
      }
      return false;
    },
  };
}

export function resolveProvider(config?: AiConfig): AiProvider {
  const resolved = config ?? resolveConfig();
  if (resolved.provider === 'anthropic') return createAnthropicProvider(resolved.anthropicVersion);
  if (
    resolved.provider === 'opencode' ||
    resolved.provider === '9router' ||
    resolved.provider === 'openai'
  ) {
    return createOpenAiProvider(resolved.provider);
  }
  throw new Error(
    `Provider de IA desconhecido: ${resolved.provider}. Validos: ${VALID_PROVIDERS.join(', ')}`
  );
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
  let hasDataLines = false;
  let hasDoneOrFinishReason = false;

  for (const line of lines) {
    const line_ = line.trim();
    if (line_.startsWith('data:')) {
      hasDataLines = true;
      if (line_.includes('[DONE]')) {
        hasDoneOrFinishReason = true;
        continue;
      }
      const payload = line_.replace(/^data:\s*/, '');
      const chunk = parseJson(payload);
      if (chunk === undefined) continue;

      const rootChunk = asRecord(chunk);
      if (rootChunk) {
        const choices = rootChunk.choices;
        if (Array.isArray(choices) && choices.length > 0) {
          const ch = asRecord(choices[0]);
          if (ch && typeof ch.finish_reason === 'string' && ch.finish_reason !== null) {
            hasDoneOrFinishReason = true;
          }
        }
        if (typeof rootChunk.stop_reason === 'string' && rootChunk.stop_reason !== null) {
          hasDoneOrFinishReason = true;
        }
      }

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
  }

  if (hasDataLines && !hasDoneOrFinishReason && streamed.length > 0) {
    console.log('[AI-Provider] ALERTA: Stream SSE cortado prematuramente sem [DONE] ou finish_reason');
    return '';
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

async function fetchNineRouter(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
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

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransientHttpStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

export function isTransientNetworkError(error: unknown): boolean {
  if (!error) return false;
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const name = error instanceof Error ? error.name : '';
  if (name === 'AbortError' || name === 'TimeoutError') return true;
  return (
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('econnrefused') ||
    msg.includes('fetch failed') ||
    msg.includes('socket hang up') ||
    msg.includes('network error') ||
    msg.includes('timeout') ||
    msg.includes('aborterror') ||
    msg.includes('connection reset') ||
    msg.includes('undici')
  );
}

export function calculateBackoffWithJitter(
  attempt: number,
  baseMs: number = 1000,
  maxDelayMs: number = 15000
): number {
  const expDelay = Math.min(maxDelayMs, baseMs * Math.pow(2, attempt));
  const jitter = Math.random() * (baseMs * 0.5);
  return Math.floor(expDelay + jitter);
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
  const maxRetries = options.maxRetries ?? envNumber(process.env.AI_MAX_RETRIES, 3);
  const baseRetryMs = options.retryBaseMs ?? envNumber(process.env.AI_RETRY_BASE_MS, 1000);
  let lastError = 'falha desconhecida';

  for (const model of models) {
    const callMaxTokens = options.maxTokens ?? config.maxTokens;
    const promptChars = options.messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);

    for (let retryAttempt = 0; retryAttempt <= maxRetries; retryAttempt++) {
      if (retryAttempt > 0) {
        const delay = calculateBackoffWithJitter(retryAttempt - 1, baseRetryMs);
        console.log(
          `[AI-Provider] Aguardando backoff (${delay}ms) antes da tentativa ${retryAttempt + 1}/${maxRetries + 1} para o modelo ${model}...`
        );
        await sleep(delay);
      }

      const startTime = performance.now();
      console.log(
        `[AI-Provider] Início da chamada | provider: ${config.provider} | model: ${model} | tentativa: ${retryAttempt + 1}/${maxRetries + 1} | mensagens: ${options.messages.length} | prompt_chars: ${promptChars} | timeout_ms: ${attemptTimeoutMs} | max_tokens: ${callMaxTokens}`
      );

      const body = JSON.stringify(
        provider.buildBody(model, options.messages, options.temperature ?? 0.3, callMaxTokens)
      );
      const headers = provider.buildHeaders(config.apiKey);
      try {
        const response =
          provider.name === '9router'
            ? await fetchNineRouter(endpoint, { method: 'POST', headers, body }, attemptTimeoutMs)
            : await fetch(endpoint, {
                method: 'POST',
                headers,
                body,
                signal: AbortSignal.timeout(attemptTimeoutMs),
              });

        const elapsedSec = Number(((performance.now() - startTime) / 1000).toFixed(2));

        if (response.ok) {
          const raw = await response.text();
          const parsedJson = parseJson(raw);
          const truncated = provider.isTruncated
            ? provider.isTruncated(parsedJson, raw)
            : isResponseTruncated(raw, parsedJson);

          if (truncated) {
            const finishReason = extractFinishReason(parsedJson, raw) || 'length';
            console.log(
              `[AI-Provider] ALERTA: Resposta truncada | model: ${model} | tempo_s: ${elapsedSec} | finish_reason: ${finishReason}`
            );
            lastError = `[${model}] resposta truncada por limite de tokens (max_tokens atingido)`;
            break;
          }

          const content = extractText(raw, provider);
          const contentChars = content.length;
          const usage = extractUsage(parsedJson, raw);
          const finishReason = extractFinishReason(parsedJson, raw) || 'stop';

          if (content) {
            if (options.validate && !options.validate(content)) {
              console.log(
                `[AI-Provider] ALERTA: Validação reprovada | model: ${model} | tempo_s: ${elapsedSec} | content_chars: ${contentChars}`
              );
              lastError = `[${model}] resposta com formato invalido`;
              break;
            }
            console.log(
              `[AI-Provider] Sucesso | model: ${model} | tempo_s: ${elapsedSec} | status: ${response.status} | tokens_prompt: ${usage.prompt_tokens} | tokens_completion: ${usage.completion_tokens} | tokens_reasoning: ${usage.reasoning_tokens} | finish_reason: ${finishReason} | content_chars: ${contentChars}`
            );
            return { content, modelUsed: model };
          }

          const bodyError = extractRawBodyError(raw, provider);
          console.log(
            `[AI-Provider] ERRO: Resposta sem conteúdo | model: ${model} | tempo_s: ${elapsedSec} | status: ${response.status} | body_error: ${(bodyError || raw).slice(0, 100)}`
          );
          lastError = bodyError
            ? `[${model}] resposta sem conteudo: ${bodyError.slice(0, 200)}`
            : `[${model}] resposta sem conteudo`;
          break;
        }

        const detail = await response.text().catch(() => '');
        const extracted = provider.extractError(parseJson(detail));
        const message = extracted || detail;
        console.log(
          `[AI-Provider] ERRO: HTTP ${response.status} | model: ${model} | tempo_s: ${elapsedSec} | mensagem: ${message.slice(0, 200)}`
        );
        lastError = `[${model}] HTTP ${response.status}: ${message.slice(0, 200)}`;

        if (isTransientHttpStatus(response.status) && retryAttempt < maxRetries) {
          console.log(
            `[AI-Provider] Erro transitório HTTP ${response.status} detectado. Programando retry...`
          );
          continue;
        }
        break;
      } catch (error) {
        const elapsedSec = Number(((performance.now() - startTime) / 1000).toFixed(2));
        const message = error instanceof Error ? error.message : String(error);
        console.log(
          `[AI-Provider] ERRO: Exceção de rede | model: ${model} | tempo_s: ${elapsedSec} | mensagem: ${message}`
        );
        lastError = `[${model}] ${message}`;

        if (isTransientNetworkError(error) && retryAttempt < maxRetries) {
          console.log(
            `[AI-Provider] Exceção de rede transitória detectada (${message}). Programando retry...`
          );
          continue;
        }
        break;
      }
    }
  }

  throw new Error(`Falha na IA (${config.provider}/${config.model}): ${lastError}`);
}

