import clsx from 'clsx'
import { useTranslation } from 'react-i18next'

import type { Body } from '../../api/types'
import { useDropdown } from './DropdownContext'

export function BodyTemplateEditor({
  body,
  onChange,
}: {
  body: Body | undefined
  onChange: (body: Body) => void
}) {
  const { t } = useTranslation()
  const b: Body = body ?? { type: 'none' }
  const isRaw = b.type !== 'none'
  const formatLabel = b.type === 'text' ? 'Text' : 'JSON'
  const dd = useDropdown()
  const ddId = 'dd-body-format'
  const formatOpen = dd.isOpen(ddId)

  const value = b.type === 'text' ? b.text ?? '' : b.jsonText ?? ''
  const lines = Math.max(1, value.split('\n').length)
  const lineNums = Array.from({ length: lines }, (_, i) => i + 1).join('\n')

  return (
    <div>
      <div className="flex items-center space-x-3 mb-3 text-[12px]">
        <label className="flex items-center text-gray-500 dark:text-gray-400 cursor-pointer">
          <input
            type="radio"
            name="body"
            className="mr-1.5 accent-ui-primary"
            checked={!isRaw}
            onChange={() => onChange({ ...b, type: 'none' })}
          />{' '}
          none
        </label>
        <label className="flex items-center text-gray-900 dark:text-gray-200 font-medium cursor-pointer">
          <input
            type="radio"
            name="body"
            className="mr-1.5 accent-ui-primary"
            checked={isRaw}
            onChange={() => onChange({ ...b, type: b.type === 'none' ? 'json' : b.type })}
          />{' '}
          raw
        </label>
        <div className="h-3 w-[1px] bg-ui-border dark:bg-ui-borderDark mx-1" />
        <div id={ddId} className="relative">
          <button
            type="button"
            className="flex items-center text-ui-primary font-medium cursor-pointer transition-colors hover:text-ui-primaryHover"
            onClick={() => dd.toggle(ddId)}
            disabled={!isRaw}
          >
            <span>{formatLabel}</span>
            <i
              className={clsx(
                'fa-solid fa-chevron-down ml-2 text-[10px] text-gray-400 transition-transform duration-200',
                formatOpen ? 'rotate-180' : ''
              )}
            />
          </button>
          <div className={clsx('custom-dropdown-menu w-full', formatOpen ? '' : 'hidden')}>
            {(['JSON', 'Text'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                className="custom-dropdown-item"
                onClick={() => {
                  dd.close()
                  if (opt === 'Text') onChange({ ...b, type: 'text', text: value })
                  else onChange({ ...b, type: 'json', jsonText: value })
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 rounded-md bg-surface-50 dark:bg-surface-900 border border-ui-border dark:border-ui-borderDark flex overflow-hidden">
        <pre className="w-10 bg-surface-100 dark:bg-surface-950 border-r border-ui-border dark:border-ui-borderDark text-right pr-2 py-2 text-gray-400 font-mono text-[12px] select-none whitespace-pre">
          {lineNums}
        </pre>
        <textarea
          className="flex-1 bg-transparent text-gray-800 dark:text-gray-300 font-mono text-[13px] p-2 resize-none whitespace-pre leading-relaxed"
          spellCheck={false}
          value={isRaw ? value : ''}
          onChange={(e) => {
            const v = e.target.value
            if (!isRaw) return
            if (b.type === 'text') onChange({ ...b, type: 'text', text: v })
            else onChange({ ...b, type: 'json', jsonText: v })
          }}
          placeholder={isRaw ? '' : t('noBody')}
          disabled={!isRaw}
        />
      </div>
    </div>
  )
}
