import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import type { Auth } from '../api/types'

export function AuthEditor({
  auth,
  onChange,
}: {
  auth: Auth
  onChange: (auth: Auth) => void
}) {
  const { t } = useTranslation()
  const a = normalizeAuth(auth)

  return (
    <div className="space-y-3 max-w-[720px]">
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
          value={a.type}
          onChange={(e) => onChange(normalizeAuth({ ...a, type: e.target.value as any }))}
        >
          <option value="none">{t('noAuth')}</option>
          <option value="bearer">{t('bearerToken')}</option>
          <option value="basic">{t('basicAuth')}</option>
          <option value="apikey">{t('apiKey')}</option>
        </select>
      </div>

      {a.type === 'bearer' ? (
        <div className="grid grid-cols-[110px_1fr] items-center gap-2">
          <div className="text-[12px] text-gray-500 dark:text-gray-400">
            {t('bearerToken')}
          </div>
          <input
            className={clsx(
              'h-9 px-3 rounded-md border font-mono',
              'bg-surface-50 dark:bg-surface-900',
              'border-ui-border dark:border-ui-borderDark'
            )}
            value={a.bearerToken ?? ''}
            onChange={(e) => onChange({ ...a, bearerToken: e.target.value })}
            placeholder="{{TOKEN}}"
          />
        </div>
      ) : null}

      {a.type === 'basic' ? (
        <div className="grid grid-cols-[110px_1fr] gap-2">
          <div className="text-[12px] text-gray-500 dark:text-gray-400 self-center">
            Username
          </div>
          <input
            className={clsx(
              'h-9 px-3 rounded-md border font-mono',
              'bg-surface-50 dark:bg-surface-900',
              'border-ui-border dark:border-ui-borderDark'
            )}
            value={a.basicUser ?? ''}
            onChange={(e) => onChange({ ...a, basicUser: e.target.value })}
          />
          <div className="text-[12px] text-gray-500 dark:text-gray-400 self-center">
            Password
          </div>
          <input
            className={clsx(
              'h-9 px-3 rounded-md border font-mono',
              'bg-surface-50 dark:bg-surface-900',
              'border-ui-border dark:border-ui-borderDark'
            )}
            value={a.basicPass ?? ''}
            onChange={(e) => onChange({ ...a, basicPass: e.target.value })}
            type="password"
          />
        </div>
      ) : null}

      {a.type === 'apikey' ? (
        <div className="space-y-2">
          <div className="grid grid-cols-[110px_1fr] items-center gap-2">
            <div className="text-[12px] text-gray-500 dark:text-gray-400">
              {t('apiKeyIn')}
            </div>
            <select
              className={clsx(
                'h-9 px-3 rounded-md border',
                'bg-surface-50 dark:bg-surface-900',
                'border-ui-border dark:border-ui-borderDark'
              )}
              value={a.apiKeyIn ?? 'header'}
              onChange={(e) => onChange({ ...a, apiKeyIn: e.target.value as any })}
            >
              <option value="header">{t('header')}</option>
              <option value="query">{t('query')}</option>
            </select>
          </div>

          <div className="grid grid-cols-[110px_1fr] items-center gap-2">
            <div className="text-[12px] text-gray-500 dark:text-gray-400">Name</div>
            <input
              className={clsx(
                'h-9 px-3 rounded-md border font-mono',
                'bg-surface-50 dark:bg-surface-900',
                'border-ui-border dark:border-ui-borderDark'
              )}
              value={a.apiKeyName ?? ''}
              onChange={(e) => onChange({ ...a, apiKeyName: e.target.value })}
              placeholder="X-API-Key"
            />
          </div>

          <div className="grid grid-cols-[110px_1fr] items-center gap-2">
            <div className="text-[12px] text-gray-500 dark:text-gray-400">Value</div>
            <input
              className={clsx(
                'h-9 px-3 rounded-md border font-mono',
                'bg-surface-50 dark:bg-surface-900',
                'border-ui-border dark:border-ui-borderDark'
              )}
              value={a.apiKeyValue ?? ''}
              onChange={(e) => onChange({ ...a, apiKeyValue: e.target.value })}
              placeholder="{{API_KEY}}"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function normalizeAuth(auth: Auth): Auth {
  const a = auth || { type: 'none' }
  if (!a.type) return { type: 'none' }
  return a
}
