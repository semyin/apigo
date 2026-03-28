import CodeMirror from '@uiw/react-codemirror'
import { json as jsonLang } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'

import type { Body, BodyField, KVType } from '../api/types'
import { normalizeBody } from '../lib/normalize'

export function BodyEditor({
  theme,
  body,
  onChange,
}: {
  theme: 'light' | 'dark'
  body: Body
  onChange: (body: Body) => void
}) {
  const b = normalizeBody(body)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="text-[12px] text-gray-500 dark:text-gray-400 w-[52px]">
          Type
        </div>
        <select
          className={clsx(
            'h-8 px-2 rounded-md border',
            'bg-surface-50 dark:bg-surface-900',
            'border-ui-border dark:border-ui-borderDark'
          )}
          value={b.type}
          onChange={(e) => onChange(normalizeBody({ ...b, type: e.target.value as any }))}
        >
          <option value="none">none</option>
          <option value="json">json</option>
          <option value="text">text</option>
          <option value="urlencoded">x-www-form-urlencoded</option>
          <option value="multipart">multipart/form-data</option>
        </select>
      </div>

      {b.type === 'none' ? (
        <div className="text-[12px] text-gray-500 dark:text-gray-400">No body.</div>
      ) : null}

      {b.type === 'json' ? (
        <div className="rounded-lg overflow-hidden border border-ui-border dark:border-ui-borderDark">
          <CodeMirror
            value={b.jsonText ?? ''}
            height="260px"
            theme={theme === 'dark' ? oneDark : undefined}
            extensions={[jsonLang()]}
            onChange={(v) => onChange({ ...b, jsonText: v })}
          />
        </div>
      ) : null}

      {b.type === 'text' ? (
        <div className="rounded-lg overflow-hidden border border-ui-border dark:border-ui-borderDark">
          <CodeMirror
            value={b.text ?? ''}
            height="220px"
            theme={theme === 'dark' ? oneDark : undefined}
            onChange={(v) => onChange({ ...b, text: v })}
          />
        </div>
      ) : null}

      {b.type === 'urlencoded' ? (
        <BodyFieldsTable
          title="Fields"
          variant="urlencoded"
          rows={b.fields ?? []}
          onChange={(fields) => onChange({ ...b, fields })}
        />
      ) : null}

      {b.type === 'multipart' ? (
        <BodyFieldsTable
          title="Fields / Files"
          variant="multipart"
          rows={b.fields ?? []}
          onChange={(fields) => onChange({ ...b, fields })}
        />
      ) : null}
    </div>
  )
}

function BodyFieldsTable({
  title,
  variant,
  rows,
  onChange,
}: {
  title: string
  variant: 'urlencoded' | 'multipart'
  rows: BodyField[]
  onChange: (rows: BodyField[]) => void
}) {
  const { t } = useTranslation()
  const isMultipart = variant === 'multipart'

  function setRow(i: number, next: BodyField) {
    const copy = rows.slice()
    copy[i] = next
    onChange(copy)
  }

  function addRow() {
    onChange([
      ...rows,
      {
        enabled: true,
        key: '',
        value: '',
        description: '',
        type: 'String',
        isFile: false,
        filePath: '',
      },
    ])
  }

  function removeRow(i: number) {
    const copy = rows.slice()
    copy.splice(i, 1)
    onChange(copy.length ? copy : [])
  }

  const headerCols = isMultipart
    ? 'grid-cols-[28px_1.2fr_96px_1.6fr_1.6fr_36px]'
    : 'grid-cols-[28px_1.4fr_124px_2.2fr_36px]'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-gray-500 dark:text-gray-400">{title}</div>
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
            'grid',
            headerCols,
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
          {isMultipart ? (
            <div className="px-2 py-2 border-l border-ui-border dark:border-ui-borderDark">
              {t('description')}
            </div>
          ) : null}
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
                className={clsx('grid items-center', headerCols, r.enabled ? '' : 'opacity-60')}
              >
                <div className="px-2">
                  <input
                    type="checkbox"
                    checked={!!r.enabled}
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
                    value={r.key ?? ''}
                    onChange={(e) => setRow(i, { ...r, key: e.target.value })}
                    placeholder="key"
                  />
                </div>

                <div className="px-2 border-l border-ui-border dark:border-ui-borderDark">
                  {isMultipart ? (
                    <select
                      className={clsx(
                        'w-full h-8 px-2 rounded-md bg-transparent',
                        'hover:bg-surface-100 dark:hover:bg-surface-800',
                        'border border-transparent focus:border-ui-primary'
                      )}
                      value={r.isFile ? 'file' : 'text'}
                      onChange={(e) => setRow(i, { ...r, isFile: e.target.value === 'file' })}
                    >
                      <option value="text">text</option>
                      <option value="file">file</option>
                    </select>
                  ) : (
                    <select
                      className={clsx(
                        'w-full h-8 px-2 rounded-md bg-transparent',
                        'hover:bg-surface-100 dark:hover:bg-surface-800',
                        'border border-transparent focus:border-ui-primary'
                      )}
                      value={(r.type as KVType) ?? 'String'}
                      onChange={(e) => setRow(i, { ...r, type: e.target.value as KVType })}
                    >
                      {(['String', 'Integer', 'Number', 'Boolean'] as KVType[]).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="px-2 border-l border-ui-border dark:border-ui-borderDark">
                  {isMultipart && r.isFile ? (
                    <input
                      className={clsx(
                        'w-full h-8 px-2 rounded-md bg-transparent',
                        'hover:bg-surface-100 dark:hover:bg-surface-800',
                        'border border-transparent focus:border-ui-primary',
                        'font-mono text-[12px]'
                      )}
                      value={r.filePath ?? ''}
                      onChange={(e) => setRow(i, { ...r, filePath: e.target.value })}
                      placeholder="C:\\path\\to\\file"
                    />
                  ) : (
                    <input
                      className={clsx(
                        'w-full h-8 px-2 rounded-md bg-transparent',
                        'hover:bg-surface-100 dark:hover:bg-surface-800',
                        'border border-transparent focus:border-ui-primary'
                      )}
                      value={r.value ?? ''}
                      onChange={(e) => setRow(i, { ...r, value: e.target.value })}
                      placeholder="value"
                    />
                  )}
                </div>

                {isMultipart ? (
                  <div className="px-2 border-l border-ui-border dark:border-ui-borderDark">
                    <input
                      className={clsx(
                        'w-full h-8 px-2 rounded-md bg-transparent',
                        'hover:bg-surface-100 dark:hover:bg-surface-800',
                        'border border-transparent focus:border-ui-primary'
                      )}
                      value={r.description ?? ''}
                      onChange={(e) => setRow(i, { ...r, description: e.target.value })}
                      placeholder="…"
                    />
                  </div>
                ) : null}

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
