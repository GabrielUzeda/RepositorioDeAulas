import { reactive, readonly } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
  persistent: boolean
}

export interface ToastOptions {
  persistent?: boolean
}

const AUTO_DISMISS_MS = 3500

const state = reactive<{ toasts: ToastItem[] }>({ toasts: [] })
const timers = new Map<number, ReturnType<typeof setTimeout>>()
let counter = 0

function dismiss(id: number): void {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
  const idx = state.toasts.findIndex((t) => t.id === id)
  if (idx !== -1) {
    state.toasts.splice(idx, 1)
  }
}

function push(type: ToastType, message: string, opts?: ToastOptions): number {
  const id = ++counter
  const persistent = opts?.persistent ?? type === 'error'
  state.toasts.push({ id, type, message, persistent })
  if (!persistent) {
    const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    timers.set(id, timer)
  }
  return id
}

function success(message: string, opts?: ToastOptions): number {
  return push('success', message, opts)
}

function error(message: string, opts?: ToastOptions): number {
  return push('error', message, opts)
}

function info(message: string, opts?: ToastOptions): number {
  return push('info', message, opts)
}

export function useToast() {
  return {
    toasts: readonly(state).toasts,
    success,
    error,
    info,
    dismiss,
  }
}
