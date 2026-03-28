import clsx from 'clsx'
import type { RefObject } from 'react'

import type { FolderOption } from '../../lib/studioUtils'

type DropdownController = {
  toggle: (id: string) => void
  isOpen: (id: string) => boolean
  close: () => void
}

export type SaveRequestDialogProps = {
  open: boolean
  mode: 'save' | 'saveAs'
  busy: boolean
  name: string
  parentId: string | null
  folderOptions: FolderOption[]
  nameInputRef: RefObject<HTMLInputElement>
  dd: DropdownController
  t: (key: string) => string
  onChangeName: (next: string) => void
  onChangeParentId: (next: string | null) => void
  onClose: () => void
  onConfirm: () => void
}

export function SaveRequestDialog({
  open,
  mode,
  busy,
  name,
  parentId,
  folderOptions,
  nameInputRef,
  dd,
  t,
  onChangeName,
  onChangeParentId,
  onClose,
  onConfirm,
}: SaveRequestDialogProps) {
  return (
    <div
      className={clsx(
        'fixed inset-0 bg-gray-900/20 dark:bg-black/40 backdrop-blur-sm z-[160] items-center justify-center opacity-0 transition-opacity duration-200',
        open ? 'flex opacity-100' : 'hidden opacity-0'
      )}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white dark:bg-[#1e1e1e] w-full max-w-lg rounded-xl shadow-float dark:shadow-floatDark border border-ui-border dark:border-[#333] flex flex-col overflow-visible">
        <div className="flex justify-between items-center px-5 py-3 border-b border-ui-border dark:border-ui-borderDark bg-surface-50 dark:bg-surface-900">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">{mode === 'saveAs' ? t('saveAs') : t('saveRequest')}</h2>
          <button
            className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            onClick={onClose}
            type="button"
            title="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1.5 text-[12px]">{t('name')}</label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => onChangeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirm()
              }}
              className="w-full bg-surface-50 dark:bg-surface-900 border border-ui-border dark:border-[#333] rounded-md px-3 py-2 text-gray-800 dark:text-gray-200 focus:border-ui-primary dark:focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 transition-all outline-none"
              placeholder={t('enterName')}
              disabled={busy}
            />
          </div>

          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1.5 text-[12px]">{t('location')}</label>
            <div id="dd-save-parent" className="relative">
              <button
                type="button"
                className="w-full flex items-center bg-surface-50 dark:bg-surface-900 border border-ui-border dark:border-[#333] rounded-md px-3 py-2 text-gray-800 dark:text-gray-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                onClick={() => dd.toggle('dd-save-parent')}
                disabled={busy}
              >
                <i className="fa-regular fa-folder text-yellow-500 mr-2 text-[12px]" />
                <span className="truncate">
                  {parentId ? folderOptions.find((f) => f.id === parentId)?.name ?? t('folder') : t('root')}
                </span>
                <i
                  className={clsx(
                    'fa-solid fa-chevron-down ml-auto text-[10px] text-gray-400 transition-transform duration-200',
                    dd.isOpen('dd-save-parent') ? 'rotate-180' : ''
                  )}
                />
              </button>
              <div
                className={clsx(
                  'custom-dropdown-menu w-full max-h-[260px] overflow-auto',
                  dd.isOpen('dd-save-parent') ? '' : 'hidden'
                )}
              >
                <button
                  type="button"
                  className="custom-dropdown-item"
                  onClick={() => {
                    dd.close()
                    onChangeParentId(null)
                  }}
                >
                  <i className="fa-solid fa-layer-group mr-2 text-[11px] text-gray-400" /> {t('root')}
                </button>
                {folderOptions.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="custom-dropdown-item"
                    style={{ paddingLeft: 12 + f.depth * 12 }}
                    onClick={() => {
                      dd.close()
                      onChangeParentId(f.id)
                    }}
                  >
                    <i className="fa-regular fa-folder text-yellow-500 mr-2 text-[12px]" /> {f.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-ui-border dark:border-ui-borderDark flex justify-end bg-surface-50 dark:bg-surface-900 gap-2">
          <button
            className="px-4 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-surface-200 dark:hover:bg-surface-800 rounded-md transition-colors font-medium"
            onClick={onClose}
            type="button"
            disabled={busy}
          >
            {t('cancel')}
          </button>
          <button
            className={clsx(
              'px-4 py-1.5 bg-ui-primary hover:bg-ui-primaryHover text-white rounded-md transition-colors shadow-sm font-medium',
              busy ? 'opacity-70 cursor-not-allowed' : ''
            )}
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {mode === 'saveAs' ? t('saveAs') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
