import { db } from './db';

export interface TelemetriaAiDados {
  tarefa: string;
  modelo: string;
  prompt_chars: number;
  tokens_prompt?: number;
  tokens_completion?: number;
  duracao_ms: number;
  valido: boolean;
  reparos: number;
}

export function registrarTelemetriaAi(dados: TelemetriaAiDados): void {
  try {
    db.query(
      `INSERT INTO ai_geracoes (tarefa, modelo, prompt_chars, tokens_prompt, tokens_completion, duracao_ms, valido, reparos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      dados.tarefa,
      dados.modelo,
      dados.prompt_chars,
      dados.tokens_prompt ?? null,
      dados.tokens_completion ?? null,
      dados.duracao_ms,
      dados.valido ? 1 : 0,
      dados.reparos
    );
  } catch (e) {
    console.log(`[AI-Telemetria] Falha ao registrar telemetria: ${e instanceof Error ? e.message : e}`);
  }
}
