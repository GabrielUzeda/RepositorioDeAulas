import { randomUUID } from 'node:crypto';
import { callAi, resolveConfig, type AiChatOptions, type AiChatResult, type AiTask } from './aiProvider';
import { registrarTelemetriaAi } from './aiTelemetria';

export type EstadoExecucaoAi = 'running' | 'completed' | 'provider_failed' | 'repair_exhausted' | 'timeout' | 'cancelled' | 'call_limit' | 'context_limit';

export class ErroExecucaoAi extends Error {
  constructor(public readonly codigo: EstadoExecucaoAi, mensagem: string) {
    super(mensagem);
    this.name = 'ErroExecucaoAi';
  }
}

export interface ResumoExecucaoAi {
  id: string;
  tarefa: AiTask;
  estado: EstadoExecucaoAi;
  chamadas: number;
  reparos: number;
  duracao_ms: number;
  tokens_prompt: number | null;
  tokens_completion: number | null;
}

type EtapaAi = Pick<AiChatOptions, 'messages' | 'temperature' | 'maxTokens' | 'timeoutMs' | 'diagnose'>;

export class ExecucaoAi {
  private readonly id = randomUUID();
  private readonly inicio = performance.now();
  private readonly config;
  private readonly prazoMs: number;
  private readonly maxReparos: number;
  private readonly maxChamadas: number;
  private readonly controller = new AbortController();
  private chamadas = 0;
  private reparos = 0;
  private estado: EstadoExecucaoAi = 'running';
  private erro?: ErroExecucaoAi;
  private tokensPrompt: number | null = 0;
  private tokensCompletion: number | null = 0;
  private fim?: number;

  constructor(
    readonly tarefa: AiTask,
    private readonly options: {
      prazoMs?: number;
      maxReparos?: number;
      maxChamadas?: number;
      maxPromptChars?: number;
      isCancelled?: () => boolean;
    } = {}
  ) {
    this.prazoMs = options.prazoMs ?? 900000;
    this.maxReparos = options.maxReparos ?? 2;
    this.maxChamadas = options.maxChamadas ?? 3;
    if (!Number.isInteger(this.maxReparos) || this.maxReparos < 0 || this.maxReparos > 2) {
      throw new Error('O orçamento global deve permitir de zero a dois reparos.');
    }
    if (!Number.isFinite(this.prazoMs) || this.prazoMs <= 0 || !Number.isInteger(this.maxChamadas) || this.maxChamadas < 1) {
      throw new Error('Prazo e limite de chamadas devem ser positivos.');
    }
    if (!Number.isInteger(options.maxPromptChars ?? 60000) || (options.maxPromptChars ?? 60000) < 1) {
      throw new Error('O limite de contexto deve ser positivo.');
    }
    this.config = resolveConfig(tarefa);
  }

  private falhar(codigo: EstadoExecucaoAi, mensagem: string): ErroExecucaoAi {
    if (!this.erro) {
      this.erro = new ErroExecucaoAi(codigo, mensagem);
      this.estado = codigo;
      this.fim = performance.now();
      this.controller.abort(this.erro);
    }
    return this.erro;
  }

  verificar(): void {
    if (this.erro) throw this.erro;
    if (this.estado === 'completed') throw new Error('Execução de IA já concluída.');
    if (this.options.isCancelled?.()) throw this.falhar('cancelled', 'Job cancelado pelo usuário');
    if (performance.now() - this.inicio >= this.prazoMs) {
      throw this.falhar('timeout', 'Prazo global da geração por IA esgotado.');
    }
  }

  resumo(): ResumoExecucaoAi {
    return {
      id: this.id,
      tarefa: this.tarefa,
      estado: this.estado,
      chamadas: this.chamadas,
      reparos: this.reparos,
      duracao_ms: Math.round((this.fim ?? performance.now()) - this.inicio),
      tokens_prompt: this.chamadas === 0 ? null : this.tokensPrompt,
      tokens_completion: this.chamadas === 0 ? null : this.tokensCompletion,
    };
  }

  concluir(): ResumoExecucaoAi {
    if (!this.erro) {
      this.verificar();
      this.estado = 'completed';
      this.fim = performance.now();
    }
    return this.resumo();
  }

  async executar(options: EtapaAi): Promise<AiChatResult> {
    let messages = options.messages.slice();
    let reparosEtapa = 0;
    while (true) {
      this.verificar();
      const promptChars = messages.reduce((total, message) => total + message.content.length, 0);
      if (promptChars > (this.options.maxPromptChars ?? 60000)) {
        throw this.falhar('context_limit', 'O contexto excedeu o limite da execução; reduza as referências ou o tamanho do lote.');
      }
      if (this.chamadas >= this.maxChamadas) {
        throw this.falhar('call_limit', 'Limite global de chamadas de IA esgotado.');
      }
      this.chamadas += 1;
      const inicioChamada = performance.now();
      const restante = this.prazoMs - (inicioChamada - this.inicio);
      const timeoutMs = Math.max(1, Math.floor(Math.min(options.timeoutMs ?? this.config.timeoutMs, restante)));
      const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(timeoutMs)]);
      const monitor = setInterval(() => {
        try {
          this.verificar();
        } catch {
          clearInterval(monitor);
        }
      }, 100);
      let tokensPrompt: number | undefined;
      let tokensCompletion: number | undefined;
      let valido = false;
      let result: AiChatResult;
      let erros: string[];
      try {
        result = await callAi({
          messages,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          timeoutMs,
          task: this.tarefa,
          config: this.config,
          signal,
          allowFallback: false,
          maxRetries: 0,
          maxRepairs: 0,
          recordTelemetry: false,
          onUsage: (usage) => {
            tokensPrompt = usage.prompt_tokens;
            tokensCompletion = usage.completion_tokens;
          },
        });
        if (signal.aborted) throw signal.reason;
        this.verificar();
        try {
          erros = options.diagnose?.(result.content) ?? [];
        } catch {
          erros = ['A resposta não pôde ser interpretada no formato solicitado.'];
        }
        valido = erros.length === 0;
      } catch (error) {
        if (this.erro) throw this.erro;
        if (signal.aborted) throw this.falhar('timeout', 'A chamada de IA excedeu o prazo permitido.');
        if (error instanceof ErroExecucaoAi) throw error;
        throw this.falhar('provider_failed', 'O provedor de IA falhou. Nenhum modelo substituto foi acionado; tente novamente ou selecione outro modelo explicitamente.');
      } finally {
        clearInterval(monitor);
        this.tokensPrompt = this.tokensPrompt === null || tokensPrompt === undefined ? null : this.tokensPrompt + tokensPrompt;
        this.tokensCompletion = this.tokensCompletion === null || tokensCompletion === undefined ? null : this.tokensCompletion + tokensCompletion;
        registrarTelemetriaAi({
          tarefa: this.tarefa,
          modelo: this.config.model,
          prompt_chars: messages.reduce((total, message) => total + message.content.length, 0),
          tokens_prompt: tokensPrompt,
          tokens_completion: tokensCompletion,
          duracao_ms: Math.round(performance.now() - inicioChamada),
          valido,
          reparos: reparosEtapa,
        });
      }
      if (valido) return { ...result, repaired: reparosEtapa };
      this.verificar();
      if (this.reparos >= this.maxReparos) {
        throw this.falhar('repair_exhausted', `Orçamento global de reparos esgotado: ${erros.join(' ')}`);
      }
      this.reparos += 1;
      reparosEtapa += 1;
      messages = [
        ...messages,
        { role: 'assistant', content: result.content },
        { role: 'user', content: `Corrija somente os problemas diagnosticados e devolva o conteúdo completo no formato solicitado:\n- ${erros.join('\n- ')}` },
      ];
    }
  }
}

export function interpretarObjetoAi(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim());
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function diagnosticarAvaliacaoAi(content: string, campoNota = 'nota'): string[] {
  const parsed = interpretarObjetoAi(content);
  if (!parsed) return ['Retorne um objeto JSON de avaliação.'];
  const erros: string[] = [];
  const nota = parsed[campoNota];
  if (typeof nota !== 'number' || !Number.isFinite(nota) || nota < 0 || nota > 100) {
    erros.push(`${campoNota} deve ser um número finito entre 0 e 100.`);
  }
  if (typeof parsed.feedback !== 'string' || !parsed.feedback.trim()) {
    erros.push('feedback deve ser um texto não vazio.');
  }
  if (parsed.justificativa !== undefined && typeof parsed.justificativa !== 'string') {
    erros.push('justificativa deve ser um texto.');
  }
  return erros;
}
