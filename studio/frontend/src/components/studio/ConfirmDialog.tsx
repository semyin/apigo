import clsx from 'clsx'

export type ConfirmDialogModel = {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export type ConfirmDialogProps = {
  dialog: ConfirmDialogModel | null
  busy: boolean
  t: (key: string) => string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ dialog, busy, t, onCancel, onConfirm }: ConfirmDialogProps) {
  const open = Boolean(dialog)
  return (
    <div
      className={clsx(
        'fixed inset-0 bg-gray-900/20 dark:bg-black/40 backdrop-blur-none z-[170] flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-200',
        open ? 'opacity-100 pointer-events-auto backdrop-blur-sm' : 'opacity-0 pointer-events-none backdrop-blur-none'
      )}
      onMouseDown={(e) => {
        if (busy) return
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className={clsx(
          'bg-white dark:bg-[#1e1e1e] w-full max-w-md rounded-xl shadow-float dark:shadow-floatDark border border-ui-border dark:border-[#333] flex flex-col overflow-hidden transform scale-95 transition-transform duration-200',
          open ? 'scale-100' : 'scale-95'
        )}
      >
        <div className="flex justify-between items-center px-5 py-3 border-b border-ui-border dark:border-ui-borderDark bg-surface-50 dark:bg-surface-900">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">{dialog?.title ?? t('confirm')}</h2>
          <button
            className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            onClick={() => {
              if (busy) return
              onCancel()
            }}
            type="button"
            title="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-5 text-gray-700 dark:text-gray-200 leading-relaxed">
          <div className="text-[13px]">{dialog?.message ?? ''}</div>
        </div>

        <div className="px-5 py-3 border-t border-ui-border dark:border-ui-borderDark flex justify-end bg-surface-50 dark:bg-surface-900 gap-2">
          <button
            className="px-4 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-surface-200 dark:hover:bg-surface-800 rounded-md transition-colors font-medium"
            onClick={onCancel}
            type="button"
            disabled={busy}
          >
            {t('cancel')}
          </button>
          <button
            className={clsx(
              'px-4 py-1.5 rounded-md transition-colors shadow-sm font-medium text-white',
              dialog?.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-ui-primary hover:bg-ui-primaryHover',
              busy ? 'opacity-70 cursor-not-allowed' : ''
            )}
            type="button"
            disabled={busy}
            onClick={onConfirm}
          >
            {dialog?.confirmLabel ?? t('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
