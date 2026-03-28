import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import type { KV, KVType } from '../api/types'
import { emptyKV } from '../lib/normalize'

export function KeyValueTable({
  rows,
  onChange,
}: {
  rows: KV[]
  onChange: (rows: KV[]) => void
}) {
  const { t } = useTranslation()

  function setRow(i: number, next: KV) {
    const copy = rows.slice()
    copy[i] = next
    onChange(copy)
  }

  function addRow() {
    onChange([...rows, emptyKV()])
  }

  function removeRow(i: number) {
    const copy = rows.slice()
    copy.splice(i, 1)
    onChange(copy.length ? copy : [])
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-gray-500 dark:text-gray-400">
          {rows.length} row(s)
        </div>
        <button
          className={clsx(
            'h-8 px-3 rounded-md border',
            'bg-surface-100 dark:bg-surface-800',
            'hover:bg-surface-200 dark:hover:bg-surface-800/80',
            'border-ui-border dark:border-ui-borderDark'
          )}
          onClick={addRow}
        >
          {t('add')}
        </button>
      </div>

      <div className="rounded-lg border border-ui-border dark:border-ui-borderDark overflow-hidden">
        <div
          className={clsx(
            'grid grid-cols-[28px_1.2fr_124px_1.4fr_1.6fr_36px]',
            'bg-surface-50 dark:bg-surface-900',
            'text-[12px] text-gray-500 dark:text-gray-400 font-medium',
            'border-b border-ui-border dark:border-ui-borderDark'
          )}
        >
          <div className="px-2 py-2"> </div>
          <div className="px-2 py-2">{t('key')}</div>
          <div className="px-2 py-2 border-l border-ui-border dark:border-ui-borderDark">
            {t('type')}
          </div>
          <div className="px-2 py-2 border-l border-ui-border dark:border-ui-borderDark">
            {t('value')}
          </div>
          <div className="px-2 py-2 border-l border-ui-border dark:border-ui-borderDark">
            {t('description')}
          </div>
          <div className="px-2 py-2"> </div>
        </div>

        <div className="divide-y divide-ui-border dark:divide-ui-borderDark">
          {rows.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-gray-500 dark:text-gray-400">
              Empty
            </div>
          ) : (
            rows.map((r, i) => (
              <div
                key={i}
                className={clsx(
                  'grid grid-cols-[28px_1.2fr_124px_1.4fr_1.6fr_36px] items-center',
                  r.enabled ? '' : 'opacity-60'
                )}
              >
                <div className="px-2">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) => setRow(i, { ...r, enabled: e.target.checked })}
                  />
                </div>

                <div className="px-2">
                  <input
                    className={clsx(
                      'w-full h-8 px-2 rounded-md bg-transparent',
                      'hover:bg-surface-100 dark:hover:bg-surface-800',
                      'border border-transparent focus:border-ui-primary'
                    )}
                    value={r.key}
                    onChange={(e) => setRow(i, { ...r, key: e.target.value })}
                    placeholder="key"
                  />
                </div>

                <div className="px-2 border-l border-ui-border dark:border-ui-borderDark">
                  <select
                    className={clsx(
                      'w-full h-8 px-2 rounded-md bg-transparent',
                      'hover:bg-surface-100 dark:hover:bg-surface-800',
                      'border border-transparent focus:border-ui-primary'
                    )}
                    value={r.type}
                    onChange={(e) => setRow(i, { ...r, type: e.target.value as KVType })}
                  >
                    {(['String', 'Integer', 'Number', 'Boolean'] as KVType[]).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="px-2 border-l border-ui-border dark:border-ui-borderDark">
                  <input
                    className={clsx(
                      'w-full h-8 px-2 rounded-md bg-transparent',
                      'hover:bg-surface-100 dark:hover:bg-surface-800',
                      'border border-transparent focus:border-ui-primary'
                    )}
                    value={r.value}
                    onChange={(e) => setRow(i, { ...r, value: e.target.value })}
                    placeholder="value"
                  />
                </div>

                <div className="px-2 border-l border-ui-border dark:border-ui-borderDark">
                  <input
                    className={clsx(
                      'w-full h-8 px-2 rounded-md bg-transparent',
                      'hover:bg-surface-100 dark:hover:bg-surface-800',
                      'border border-transparent focus:border-ui-primary'
                    )}
                    value={r.description}
                    onChange={(e) => setRow(i, { ...r, description: e.target.value })}
                    placeholder="…"
                  />
                </div>

                <div className="px-2">
                  <button
                    className="w-7 h-7 rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 text-gray-500"
                    onClick={() => removeRow(i)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
