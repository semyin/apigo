import React, { createContext, useContext, useMemo, useState } from 'react'

type ToastKind = 'info' | 'success' | 'error'

type Toast = {
  id: string
  kind: ToastKind
  message: string
}

type ToastApi = {
  show: (message: string, kind?: ToastKind) => void
}

const Ctx = createContext<ToastApi | null>(null)

function makeId(): string {
  const c = (globalThis as any).crypto
  if (c?.randomUUID) return c.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const api = useMemo<ToastApi>(
    () => ({
      show: (message: string, kind: ToastKind = 'info') => {
        const id = makeId()
        const t: Toast = { id, kind, message }
        setToasts((prev) => [...prev, t])
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== id))
        }, 1800)
      },
    }),
    []
  )

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 pointer-events-none items-center">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              'pointer-events-none',
              'w-fit max-w-[80vw]',
              'rounded-lg border shadow-float dark:shadow-floatDark',
              'px-3 py-2 text-[12px] font-medium text-center',
              'bg-white dark:bg-surface-800',
              'border-ui-border dark:border-ui-borderDark',
              t.kind === 'success'
                ? 'text-green-700 dark:text-green-300'
                : t.kind === 'error'
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-gray-700 dark:text-gray-200',
            ].join(' ')}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('ToastProvider missing')
  return ctx
}
