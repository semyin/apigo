import clsx from 'clsx'
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { KV, KVType } from '../../api/types'
import { emptyKV } from '../../lib/normalize'
import { useDropdown } from './DropdownContext'

export function KVFlexTable({
  idPrefix,
  resetKey,
  rows,
  onChange,
}: {
  idPrefix: 'params' | 'headers'
  resetKey: string
  rows: KV[]
  onChange: (rows: KV[]) => void
}) {
  const safeRows = rows ?? []
  const [draft, setDraft] = useState<KV>(() => emptyKV())
  const draftRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const shouldScrollToBottomRef = useRef(false)
  const dd = useDropdown()
  const { t } = useTranslation()

  useEffect(() => {
    setDraft(emptyKV())
  }, [resetKey, idPrefix])

  useEffect(() => {
    if (!shouldScrollToBottomRef.current) return
    shouldScrollToBottomRef.current = false
    const el = containerRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
  }, [safeRows.length, idPrefix, resetKey])

  function setRow(i: number, next: KV) {
    const copy = safeRows.slice()
    copy[i] = next
    onChange(copy)
  }

  function removeRow(i: number) {
    const copy = safeRows.slice()
    copy.splice(i, 1)
    onChange(copy)
  }

  function commitDraft() {
    const k = (draft.key || '').trim()
    const v = (draft.value || '').trim()
    const d = (draft.description || '').trim()
    if (!k && !v && !d) return
    shouldScrollToBottomRef.current = true
    onChange([...safeRows, { ...draft, enabled: true }])
    setDraft(emptyKV())
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-[13px]">
      <div
        id={`${idPrefix}-header`}
        className="flex text-gray-500 dark:text-gray-400 py-1.5 border-b border-ui-border dark:border-ui-borderDark font-medium relative"
      >
        <div className="w-8 flex-shrink-0" />
        <div className="w-[var(--w-key)] flex-shrink-0 px-2 relative group">
          {t('key')}
          <div className="resizer" onMouseDown={(e) => beginResizeCols(e, idPrefix, '--w-key')} />
        </div>
        <div className="w-[var(--w-val)] flex-shrink-0 px-2 relative group">
          {t('value')}
          <div className="resizer" onMouseDown={(e) => beginResizeCols(e, idPrefix, '--w-val')} />
        </div>
        <div className="table-type-col px-2 table-divider-left">{t('type')}</div>
        <div className="flex-1 px-2 table-divider-left">{t('description')}</div>
      </div>

      <div ref={containerRef} id={`${idPrefix}-container`} className="flex-1 min-h-0 overflow-y-auto pr-1">
        {safeRows.map((r, i) => (
          <div
            key={i}
            className="flex items-center border-b border-surface-100 dark:border-surface-800/50 hover:bg-surface-50 dark:hover:bg-surface-800/30 group py-1"
          >
            <div className="w-8 flex-shrink-0 flex justify-center">
              <input
                type="checkbox"
                checked={!!r.enabled}
                className="accent-ui-primary w-3.5 h-3.5 rounded-sm border-gray-300"
                onChange={(e) => setRow(i, { ...r, enabled: e.target.checked })}
              />
            </div>
            <div className="w-[var(--w-key)] flex-shrink-0 px-1">
              <input
                type="text"
                value={r.key}
                onChange={(e) => setRow(i, { ...r, key: e.target.value })}
                className="data-input font-mono w-full bg-transparent px-1.5 py-1 rounded text-gray-800 dark:text-gray-200 hover:bg-surface-100 dark:hover:bg-surface-800"
              />
            </div>
            <div className="w-[var(--w-val)] flex-shrink-0 px-1 relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[1px] before:bg-ui-border dark:before:bg-ui-borderDark">
              <input
                type="text"
                value={r.value}
                onChange={(e) => setRow(i, { ...r, value: e.target.value })}
                className="data-input font-mono w-full bg-transparent px-1.5 py-1 rounded text-gray-800 dark:text-gray-200 hover:bg-surface-100 dark:hover:bg-surface-800"
              />
            </div>
            <div className="table-type-col px-1 table-divider-left">
              <div id={`dd-${idPrefix}-type-${resetKey}-${i}`} className="relative">
                <button
                  type="button"
                  className="data-input w-full flex items-center bg-transparent px-1.5 py-1 rounded text-gray-800 dark:text-gray-200 hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer"
                  onClick={() => dd.toggle(`dd-${idPrefix}-type-${resetKey}-${i}`)}
                >
                  <span>{r.type}</span>
                  <i
                    className={clsx(
                      'fa-solid fa-chevron-down ml-auto text-[10px] text-gray-400 transition-transform duration-200',
                      dd.isOpen(`dd-${idPrefix}-type-${resetKey}-${i}`) ? 'rotate-180' : ''
                    )}
                  />
                </button>
                <div
                  className={clsx(
                    'custom-dropdown-menu w-full',
                    dd.isOpen(`dd-${idPrefix}-type-${resetKey}-${i}`) ? '' : 'hidden'
                  )}
                >
                  {(['String', 'Integer', 'Number', 'Boolean', 'Array', 'Object'] as KVType[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="custom-dropdown-item"
                      onClick={() => {
                        dd.close()
                        setRow(i, { ...r, type: v })
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex-1 flex items-center px-1 pr-2 relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[1px] before:bg-ui-border dark:before:bg-ui-borderDark">
              <input
                type="text"
                value={r.description}
                onChange={(e) => setRow(i, { ...r, description: e.target.value })}
                placeholder="Description"
                className="data-input flex-1 bg-transparent px-1.5 py-1 rounded text-gray-500 dark:text-gray-400 hover:bg-surface-100 dark:hover:bg-surface-800"
              />
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 px-1 transition-opacity"
                onClick={() => removeRow(i)}
                title="Remove"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          </div>
        ))}

        <div
          ref={draftRef}
          className="flex items-center group py-1 hover:bg-surface-50 dark:hover:bg-surface-800/30"
          onBlurCapture={() => {
            requestAnimationFrame(() => {
              if (!draftRef.current) return
              if (draftRef.current.contains(document.activeElement)) return
              commitDraft()
            })
          }}
        >
          <div className="w-8 flex-shrink-0" />
          <div className="w-[var(--w-key)] flex-shrink-0 px-1">
            <input
              type="text"
              placeholder={t('key')}
              value={draft.key}
              onChange={(e) => setDraft((p) => ({ ...p, key: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitDraft()
              }}
              className="data-input font-mono w-full bg-transparent px-1.5 py-1 rounded text-gray-500 hover:bg-surface-100 dark:hover:bg-surface-800"
            />
          </div>
          <div className="w-[var(--w-val)] flex-shrink-0 px-1 relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[1px] before:bg-ui-border dark:before:bg-ui-borderDark">
            <input
              type="text"
              placeholder={t('value')}
              value={draft.value}
              onChange={(e) => setDraft((p) => ({ ...p, value: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitDraft()
              }}
              className="data-input font-mono w-full bg-transparent px-1.5 py-1 rounded text-gray-500 hover:bg-surface-100 dark:hover:bg-surface-800"
            />
          </div>
          <div className="table-type-col px-1 table-divider-left">
            <div id={`dd-${idPrefix}-type-${resetKey}-draft`} className="relative">
              <button
                type="button"
                className="data-input w-full flex items-center bg-transparent px-1.5 py-1 rounded text-gray-500 dark:text-gray-400 hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer"
                onClick={() => dd.toggle(`dd-${idPrefix}-type-${resetKey}-draft`)}
              >
                <span>{draft.type}</span>
                <i
                  className={clsx(
                    'fa-solid fa-chevron-down ml-auto text-[10px] text-gray-400 transition-transform duration-200',
                    dd.isOpen(`dd-${idPrefix}-type-${resetKey}-draft`) ? 'rotate-180' : ''
                  )}
                />
              </button>
              <div
                className={clsx(
                  'custom-dropdown-menu w-full',
                  dd.isOpen(`dd-${idPrefix}-type-${resetKey}-draft`) ? '' : 'hidden'
                )}
              >
                {(['String', 'Integer', 'Number', 'Boolean', 'Array', 'Object'] as KVType[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="custom-dropdown-item"
                    onClick={() => {
                      dd.close()
                      setDraft((p) => ({ ...p, type: v }))
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 px-1 relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[1px] before:bg-ui-border dark:before:bg-ui-borderDark">
            <input
              type="text"
              placeholder={t('description')}
              value={draft.description}
              onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitDraft()
              }}
              className="data-input w-full bg-transparent px-1.5 py-1 rounded text-gray-500 hover:bg-surface-100 dark:hover:bg-surface-800"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function beginResizeCols(
  e: ReactMouseEvent<HTMLDivElement>,
  target: 'params' | 'headers',
  colVarName: '--w-key' | '--w-val'
) {
  const resizer = e.currentTarget as HTMLDivElement
  const targetContainer = document.getElementById(`${target}-container`)
  const targetHeader = document.getElementById(`${target}-header`)
  if (!targetContainer || !targetHeader) return
  const containerEl = targetContainer
  const headerEl = targetHeader

  const parentCell = resizer.parentElement
  if (!parentCell) return

  const startX = e.pageX
  const startWidth = parentCell.getBoundingClientRect().width
  const containerWidth = headerEl.getBoundingClientRect().width

  const headerStyles = getComputedStyle(headerEl)
  const otherVarName = colVarName === '--w-key' ? '--w-val' : '--w-key'
  const otherPercentage = parseFloat(headerStyles.getPropertyValue(otherVarName)) || 0
  const typeWidth = parseFloat(headerStyles.getPropertyValue('--w-type')) || 0
  const checkboxWidth = 32
  const minDescriptionWidth = 220
  const availableWidth = containerWidth - checkboxWidth - typeWidth - minDescriptionWidth
  const availablePercentage = (availableWidth / containerWidth) * 100

  const minPercentage = 16
  const maxPercentage = Math.max(minPercentage, Math.min(60, availablePercentage - otherPercentage))

  resizer.classList.add('active')
  document.body.classList.add('resizing-cols')
  e.preventDefault()

  function onMove(ev: MouseEvent) {
    const deltaX = ev.pageX - startX
    const newWidth = startWidth + deltaX
    let percentage = (newWidth / containerWidth) * 100
    percentage = Math.max(minPercentage, Math.min(percentage, maxPercentage))
    containerEl.style.setProperty(colVarName, `${percentage}%`)
    headerEl.style.setProperty(colVarName, `${percentage}%`)
  }

  function onUp() {
    resizer.classList.remove('active')
    document.body.classList.remove('resizing-cols')
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
