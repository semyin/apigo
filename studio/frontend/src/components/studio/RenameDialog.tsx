import clsx from 'clsx'
import type { RefObject } from 'react'

export type RenameDialogProps = {
  open: boolean
  value: string
  inputRef: RefObject<HTMLInputElement>
  t: (key: string) => string
  onChange: (next: string) => void
  onClose: () => void
  onConfirm: () => void
}

export function RenameDialog({ open, value, inputRef, t, onChange, onClose, onConfirm }: RenameDialogProps) {
  return (
    <div
      className={clsx(
        'fixed inset-0 bg-gray-900/20 dark:bg-black/40 backdrop-blur-none z-[160] flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-200',
        open ? 'opacity-100 pointer-events-auto backdrop-blur-sm' : 'opacity-0 pointer-events-none backdrop-blur-none'
      )}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={clsx(
          'bg-white dark:bg-[#1e1e1e] w-full max-w-md rounded-xl shadow-float dark:shadow-floatDark border border-ui-border dark:border-[#333] flex flex-col overflow-hidden transform scale-95 transition-transform duration-200',
          open ? 'scale-100' : 'scale-95'
        )}
      >
        <div className="flex justify-between items-center px-5 py-3 border-b border-ui-border dark:border-ui-borderDark bg-surface-50 dark:bg-surface-900">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">{t('rename')}</h2>
          <button
            className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            onClick={onClose}
            type="button"
            title="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-5">
          <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1.5 text-[12px]">{t('name')}</label>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm()
            }}
            className="w-full bg-surface-50 dark:bg-surface-900 border border-ui-border dark:border-[#333] rounded-md px-3 py-2 text-gray-800 dark:text-gray-200 focus:border-ui-primary dark:focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 transition-all outline-none"
            placeholder={t('enterName')}
          />
        </div>

        <div className="px-5 py-3 border-t border-ui-border dark:border-ui-borderDark flex justify-end bg-surface-50 dark:bg-surface-900 gap-2">
          <button
            className="px-4 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-surface-200 dark:hover:bg-surface-800 rounded-md transition-colors font-medium"
            onClick={onClose}
            type="button"
          >
            {t('cancel')}
          </button>
          <button
            className="px-4 py-1.5 bg-ui-primary hover:bg-ui-primaryHover text-white rounded-md transition-colors shadow-sm font-medium"
            type="button"
            onClick={onConfirm}
          >
            {t('rename')}
          </button>
        </div>
      </div>
    </div>
  )
}
