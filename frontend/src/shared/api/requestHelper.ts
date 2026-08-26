import type { Ref } from 'vue';
import { useToast } from '@/shared/composables/useToast';
import type { ApiResponse } from '@/shared/types';

export interface ExecuteFeedbackOptions {
  successMessage?: string;
  errorMessage?: string;
  loadingRef?: Ref<boolean>;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

export async function executeWithFeedback<T>(
  action: () => Promise<ApiResponse<T>>,
  options: ExecuteFeedbackOptions = {}
): Promise<ApiResponse<T>> {
  const {
    successMessage,
    errorMessage = 'Ocorreu um erro ao processar a solicitação.',
    loadingRef,
    showSuccessToast = true,
    showErrorToast = true,
  } = options;

  const toast = useToast();

  if (loadingRef) {
    loadingRef.value = true;
  }

  try {
    const res = await action();
    if (res.success) {
      if (showSuccessToast && successMessage) {
        toast.success(successMessage);
      }
      return res;
    } else {
      const errorDetail = res.error || errorMessage;
      if (showErrorToast) {
        toast.error(errorDetail);
      }
      return res;
    }
  } catch (err: any) {
    const fallbackMsg = err?.message || errorMessage;
    if (showErrorToast) {
      toast.error(fallbackMsg);
    }
    return {
      success: false,
      error: fallbackMsg,
      status: 0,
    };
  } finally {
    if (loadingRef) {
      loadingRef.value = false;
    }
  }
}
