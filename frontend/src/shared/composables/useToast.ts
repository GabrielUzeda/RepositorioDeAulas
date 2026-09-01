import { reactive, readonly } from 'vue'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
  title?: string
  persistent: boolean
  duration: number
  remaining: number
  startedAt: number
  action?: { label: string; onClick: () => void }
}

export interface ToastOptions {
  title?: string
  persistent?: boolean
  duration?: number
  action?: { label: string; onClick: () => void }
}

const DEFAULT_DURATION = 3500
const ERROR_DEFAULT_DURATION = 10500 // ~3x da duração de sucesso

const state = reactive<{ toasts: ToastItem[] }>({ toasts: [] })
const timers = new Map<number, { timer: ReturnType<typeof setTimeout>; endTime: number; remaining?: number }>()
let counter = 0

function dismiss(id: number): void {
  const timerData = timers.get(id)
  if (timerData) {
    clearTimeout(timerData.timer)
    timers.delete(id)
  }
  const idx = state.toasts.findIndex((t) => t.id === id)
  if (idx !== -1) state.toasts.splice(idx, 1)
}

function clearAll(): void {
  for (const id of timers.keys()) clearTimeout(timers.get(id)!.timer)
  timers.clear()
  state.toasts.splice(0, state.toasts.length)
}

function pause(id: number): void {
  const timerData = timers.get(id)
  if (timerData) {
    clearTimeout(timerData.timer)
    timerData.remaining = Math.max(0, timerData.endTime - Date.now())
  }
}

function resume(id: number): void {
  const toast = state.toasts.find((t) => t.id === id)
  if (toast && !toast.persistent) {
    const remaining = toast.remaining ?? toast.duration
    toast.startedAt = Date.now()
    const timer = setTimeout(() => dismiss(id), remaining)
    timers.set(id, { timer, endTime: Date.now() + remaining })
  }
}

function push(type: ToastType, message: string, opts?: ToastOptions): number {
  const id = ++counter
  const duration = opts?.duration ?? (type === 'error' ? ERROR_DEFAULT_DURATION : DEFAULT_DURATION)
  const persistent = opts?.persistent ?? false
  
  const toast: ToastItem = { 
    id, type, message, title: opts?.title, persistent, duration, 
    remaining: duration, startedAt: Date.now(), action: opts?.action 
  }
  state.toasts.push(toast)
  
  if (!persistent) {
    const timer = setTimeout(() => dismiss(id), duration)
    timers.set(id, { timer, endTime: Date.now() + duration })
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

function warning(message: string, opts?: ToastOptions): number {
  return push('warning', message, opts)
}

export function useToast() {
  return {
    toasts: readonly(state).toasts,
    success,
    error,
    info,
    warning,
    dismiss,
    clearAll,
    pause,
    resume
  }
}
