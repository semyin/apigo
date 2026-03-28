import clsx from 'clsx'
import { useState } from 'react'

import type { Auth, AuthType } from '../../api/types'

export function AuthTemplateEditor({
  auth,
  onChange,
}: {
  auth: Auth | undefined
  onChange: (auth: Auth) => void
}) {
  const a: Auth = auth ?? { type: 'none' }
  const [typeOpen, setTypeOpen] = useState(false)

  return (
    <div className="flex flex-col text-[13px]">
      <div className="flex text-gray-500 dark:text-gray-400 py-1.5 border-b border-ui-border dark:border-ui-borderDark font-medium">
        <div className="w-[220px] flex-shrink-0 px-2">Type</div>
        <div className="flex-1 px-2">Value</div>
      </div>

      <div className="flex items-center border-b border-surface-100 dark:border-surface-800/50 hover:bg-surface-50 dark:hover:bg-surface-800/30 py-1">
        <div className="w-[220px] flex-shrink-0 px-1">
          <div className="relative">
            <button
              type="button"
              className="data-input w-full flex items-center bg-transparent px-1.5 py-1 rounded text-gray-800 dark:text-gray-200 hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer"
              onClick={() => setTypeOpen((v) => !v)}
            >
              <span>{authLabel(a.type)}</span>
              <i
                className={clsx(
                  'fa-solid fa-chevron-down ml-auto text-[10px] text-gray-400 transition-transform duration-200',
                  typeOpen ? 'rotate-180' : ''
                )}
              />
            </button>
            <div className={clsx('custom-dropdown-menu w-full', typeOpen ? '' : 'hidden')}>
              {([
                { label: 'No Auth', value: 'none' },
                { label: 'Bearer Token', value: 'bearer' },
                { label: 'API Key', value: 'apikey' },
                { label: 'Basic Auth', value: 'basic' },
                { label: 'OAuth 2.0', value: 'oauth2' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="custom-dropdown-item"
                  onClick={() => {
                    setTypeOpen(false)
                    onChange({ ...a, type: opt.value as AuthType })
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 px-1 relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[1px] before:bg-ui-border dark:before:bg-ui-borderDark">
          <input
            type="text"
            value={authValue(a)}
            placeholder="Paste token or credential"
            className="data-input font-mono w-full bg-transparent px-1.5 py-1 rounded text-gray-800 dark:text-gray-200 hover:bg-surface-100 dark:hover:bg-surface-800"
            onChange={(e) => onChange(setAuthValue(a, e.target.value))}
          />
        </div>
      </div>
    </div>
  )
}

function authLabel(t: AuthType): string {
  if (t === 'bearer') return 'Bearer Token'
  if (t === 'apikey') return 'API Key'
  if (t === 'basic') return 'Basic Auth'
  if (t === 'oauth2') return 'OAuth 2.0'
  return 'No Auth'
}

function authValue(a: Auth): string {
  switch (a.type) {
    case 'bearer':
      return a.bearerToken ?? ''
    case 'apikey':
      return a.apiKeyValue ?? ''
    case 'basic':
      return [a.basicUser ?? '', a.basicPass ?? ''].filter(Boolean).join(':')
    default:
      return ''
  }
}

function setAuthValue(a: Auth, v: string): Auth {
  switch (a.type) {
    case 'bearer':
      return { ...a, bearerToken: v }
    case 'apikey':
      return {
        ...a,
        apiKeyIn: a.apiKeyIn ?? 'header',
        apiKeyName: a.apiKeyName ?? 'X-API-Key',
        apiKeyValue: v,
      }
    case 'basic': {
      const idx = v.indexOf(':')
      if (idx >= 0) return { ...a, basicUser: v.slice(0, idx), basicPass: v.slice(idx + 1) }
      return { ...a, basicUser: v }
    }
    default:
      return a
  }
}

