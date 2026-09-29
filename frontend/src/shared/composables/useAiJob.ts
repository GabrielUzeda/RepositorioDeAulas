import { ref, computed, onBeforeUnmount, type Ref } from 'vue';
import { apiClient } from '@/shared/api/client';

export type AiJobStatus =
  | 'idle'
  | 'running'
  | 'polling'
  | 'reconnecting'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AiJobProgress {
  current?: number;
  total?: number;
  percentage?: number;
  stepMessage?: string;
}

export interface AiJobResponse<T = unknown> {
  success?: boolean;
  status?: 'queued' | 'processing' | 'running' | 'completed' | 'failed';
  progress?: number | AiJobProgress;
  step?: string;
  step_message?: string;
  message?: string;
  result?: T;
  data?: T;
  error?: string;
  job_id?: string;
  jobId?: string;
}

export interface AiJobOptions<TResult = unknown> {
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  onProgress?: (progress: number, stepMessage: string) => void;
  onSuccess?: (result: TResult) => void;
  onError?: (errorMessage: string) => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
}

const BACKOFF_DELAYS = [1500, 3000, 6000, 10000];

export function useAiJob<TResult = unknown>() {
  const status: Ref<AiJobStatus> = ref('idle');
  const progress = ref<number>(0);
  const result = ref<TResult | null>(null);
  const error = ref<string | null>(null);
  const isReconnecting = ref<boolean>(false);
  const stepMessage = ref<string>('');
  const currentJobId = ref<string | null>(null);

  let isCancelledFlag = false;
  let activeResolve: ((res: TResult | null) => void) | null = null;

  const isRunning = computed<boolean>(() => {
    return (
      status.value === 'running' ||
      status.value === 'polling' ||
      status.value === 'reconnecting'
    );
  });

  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let progressEstimatorTimer: ReturnType<typeof setInterval> | null = null;
  let backoffIndex = 0;
  let pollAttempts = 0;
  let pendingAction: (() => Promise<void>) | null = null;

  function clearAllTimers() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    stopProgressEstimator();
  }

  function startProgressEstimator() {
    stopProgressEstimator();
    const startTime = Date.now();
    progressEstimatorTimer = setInterval(() => {
      if (!isRunning.value || isReconnecting.value) return;
      const elapsed = Date.now() - startTime;
      if (elapsed < 2500) {
        progress.value = Math.max(progress.value, 20);
        stepMessage.value = 'Enviando e estruturando solicitação...';
      } else if (elapsed < 7000) {
        progress.value = Math.max(progress.value, 35);
        stepMessage.value = 'Analisando diretrizes, documentos e contexto pedagógico...';
      } else if (elapsed < 16000) {
        progress.value = Math.max(progress.value, 55);
        stepMessage.value = 'Processando e redigindo com DeepSeek v4.1 Flash...';
      } else if (elapsed < 28000) {
        progress.value = Math.max(progress.value, 75);
        stepMessage.value = 'Construindo estruturas, formatações e recursos...';
      } else if (elapsed < 50000) {
        progress.value = Math.max(progress.value, 88);
        stepMessage.value = 'Finalizando validação e revisão de qualidade...';
      } else {
        progress.value = Math.min(96, Math.max(progress.value, 90));
        stepMessage.value = 'Concluindo geração detalhada com a IA...';
      }
    }, 1200);
  }

  function stopProgressEstimator() {
    if (progressEstimatorTimer) {
      clearInterval(progressEstimatorTimer);
      progressEstimatorTimer = null;
    }
  }

  function handleOnline() {
    if (isReconnecting.value || status.value === 'reconnecting') {
      isReconnecting.value = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      backoffIndex = 0;
      stepMessage.value = 'Conexão restabelecida. Retomando processamento...';
      if (pendingAction && !isCancelledFlag) {
        pendingAction();
      }
    }
  }

  function handleOffline() {
    if (isRunning.value && !isCancelledFlag) {
      enterReconnectingMode('Conexão de rede perdida. Aguardando sinal para continuar...');
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  function enterReconnectingMode(customMessage?: string) {
    status.value = 'reconnecting';
    isReconnecting.value = true;
    const delay = BACKOFF_DELAYS[Math.min(backoffIndex, BACKOFF_DELAYS.length - 1)];
    backoffIndex++;

    stepMessage.value =
      customMessage ||
      `Aguardando conexão de rede... (tentativa em ${Math.round(delay / 1000)}s)`;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }

    reconnectTimer = setTimeout(() => {
      if (pendingAction && (status.value === 'reconnecting' || isReconnecting.value) && !isCancelledFlag) {
        pendingAction();
      }
    }, delay);
  }

  function reset() {
    clearAllTimers();
    if (activeResolve) {
      activeResolve(null);
      activeResolve = null;
    }
    isCancelledFlag = false;
    status.value = 'idle';
    progress.value = 0;
    result.value = null;
    error.value = null;
    isReconnecting.value = false;
    stepMessage.value = '';
    currentJobId.value = null;
    backoffIndex = 0;
    pollAttempts = 0;
    pendingAction = null;
  }

  function cancelJob() {
    clearAllTimers();
    isCancelledFlag = true;
    status.value = 'cancelled';
    isReconnecting.value = false;
    stepMessage.value = 'Operação cancelada pelo usuário.';
    pendingAction = null;
    if (activeResolve) {
      activeResolve(null);
      activeResolve = null;
    }
  }

  async function pollJob(
    jobId: string,
    options?: AiJobOptions<TResult>
  ): Promise<TResult | null> {
    currentJobId.value = jobId;
    status.value = 'polling';
    isReconnecting.value = false;
    isCancelledFlag = false;

    const interval = options?.pollIntervalMs ?? 1500;
    const maxAttempts = options?.maxPollAttempts ?? 120;

    return new Promise((resolve) => {
      activeResolve = resolve;

      const executePoll = async () => {
        if (isCancelledFlag) {
          activeResolve = null;
          resolve(null);
          return;
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          pendingAction = executePoll;
          enterReconnectingMode();
          return;
        }

        pollAttempts++;
        if (pollAttempts > maxAttempts) {
          status.value = 'failed';
          error.value = 'Tempo limite de processamento atingido.';
          stepMessage.value = 'Tempo limite excedido.';
          if (options?.onError) options.onError(error.value);
          activeResolve = null;
          resolve(null);
          return;
        }

        try {
          const res = await apiClient.get<AiJobResponse<TResult>>(`/ai/jobs/${jobId}`);

          if (isCancelledFlag) {
            activeResolve = null;
            resolve(null);
            return;
          }

          if (!res.success && res.status === 0) {
            pendingAction = executePoll;
            enterReconnectingMode();
            return;
          }

          if (isReconnecting.value) {
            isReconnecting.value = false;
            backoffIndex = 0;
            if (options?.onReconnected) options.onReconnected();
          }

          if (!res.success) {
            status.value = 'failed';
            error.value = res.error || 'Erro ao consultar status da IA.';
            stepMessage.value = error.value;
            if (options?.onError) options.onError(error.value);
            activeResolve = null;
            resolve(null);
            return;
          }

          const jobData = res.data;
          const jobStatus = jobData?.status;

          let extractedProgress = 0;
          if (typeof jobData?.progress === 'number' && jobData.progress > 0) {
            extractedProgress = jobData.progress;
          } else if (
            typeof jobData?.progress === 'object' &&
            jobData.progress !== null &&
            typeof jobData.progress.percentage === 'number'
          ) {
            extractedProgress = jobData.progress.percentage;
          }

          const messageToCheck =
            jobData?.step_message ||
            (jobData as any)?.progresso ||
            jobData?.step ||
            jobData?.message ||
            '';
          const match = messageToCheck.match(/^(\d+)%/);
          if (match) {
            const parsedPct = parseInt(match[1], 10);
            if (!isNaN(parsedPct)) {
              extractedProgress = Math.max(extractedProgress, parsedPct);
            }
          }
          if (jobStatus === 'completed') {
            extractedProgress = 100;
          }
          progress.value = Math.min(100, Math.max(0, extractedProgress));

          if (messageToCheck) {
            stepMessage.value = messageToCheck;
          }

          if (options?.onProgress) {
            options.onProgress(progress.value, stepMessage.value);
          }

          if (jobStatus === 'completed') {
            // SAFETY: O payload recebido da API de IA foi validado com status completed
            const finalResult = (jobData?.result ?? jobData?.data ?? jobData ?? {}) as unknown as TResult;
            status.value = 'completed';
            progress.value = 100;
            result.value = finalResult;
            stepMessage.value = 'Concluído com sucesso.';
            if (options?.onSuccess) options.onSuccess(finalResult);
            activeResolve = null;
            resolve(finalResult);
            return;
          }

          if (jobStatus === 'failed') {
            status.value = 'failed';
            error.value = jobData?.error || 'O processamento da IA falhou.';
            stepMessage.value = error.value;
            if (options?.onError) options.onError(error.value);
            activeResolve = null;
            resolve(null);
            return;
          }

          status.value = 'polling';
          pollTimer = setTimeout(() => {
            executePoll();
          }, interval);
        } catch (err: unknown) {
          const errMessage = err instanceof Error ? err.message : 'Erro de rede';
          pendingAction = executePoll;
          enterReconnectingMode(`Erro de conexão (${errMessage}). Tentando reconectar...`);
        }
      };

      pendingAction = executePoll;
      executePoll();
    });
  }

  async function startJob(
    endpoint: string,
    payload?: unknown,
    options?: AiJobOptions<TResult>
  ): Promise<TResult | null> {
    reset();
    status.value = 'running';
    progress.value = 10;
    stepMessage.value = 'Enviando solicitação para IA...';
    startProgressEstimator();

    return new Promise((resolve) => {
      activeResolve = (res) => {
        stopProgressEstimator();
        resolve(res);
      };

      const executeRequest = async () => {
        if (isCancelledFlag) {
          stopProgressEstimator();
          activeResolve = null;
          resolve(null);
          return;
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          pendingAction = executeRequest;
          enterReconnectingMode();
          return;
        }

        try {
          const res = await apiClient.post<AiJobResponse<TResult> | TResult>(
            endpoint,
            payload
          );

          if (isCancelledFlag) {
            stopProgressEstimator();
            activeResolve = null;
            resolve(null);
            return;
          }

          if (!res.success && res.status === 0) {
            pendingAction = executeRequest;
            enterReconnectingMode();
            return;
          }

          if (isReconnecting.value) {
            isReconnecting.value = false;
            backoffIndex = 0;
            if (options?.onReconnected) options.onReconnected();
          }

          if (!res.success) {
            stopProgressEstimator();
            status.value = 'failed';
            error.value = res.error || 'Erro ao processar solicitação de IA.';
            stepMessage.value = error.value;
            if (options?.onError) options.onError(error.value);
            activeResolve = null;
            resolve(null);
            return;
          }

          const data = res.data as AiJobResponse<TResult> | undefined;

          const jobId = data?.job_id || data?.jobId;
          if (jobId) {
            stopProgressEstimator();
            progress.value = 25;
            stepMessage.value = 'Processando na fila de IA...';
            const pollRes = await pollJob(jobId, options);
            activeResolve = null;
            resolve(pollRes);
            return;
          }

          stopProgressEstimator();
          // SAFETY: O payload retornado diretamente pelo endpoint HTTP de IA é compatível com TResult
          const finalResult = (data?.result ?? data?.data ?? data ?? {}) as unknown as TResult;
          status.value = 'completed';
          progress.value = 100;
          result.value = finalResult;
          stepMessage.value = 'Concluído com sucesso.';
          if (options?.onSuccess) options.onSuccess(finalResult);
          activeResolve = null;
          resolve(finalResult);
        } catch (err: unknown) {
          const errMessage = err instanceof Error ? err.message : 'Erro de rede';
          pendingAction = executeRequest;
          enterReconnectingMode(`Erro de conexão (${errMessage}). Tentando reconectar...`);
        }
      };

      pendingAction = executeRequest;
      executeRequest();
    });
  }

  onBeforeUnmount(() => {
    clearAllTimers();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  });

  return {
    status,
    progress,
    result,
    error,
    isRunning,
    isReconnecting,
    stepMessage,
    currentJobId,
    startJob,
    pollJob,
    cancelJob,
    reset,
  };
}
