import clsx from 'clsx'
import type { Dispatch, SetStateAction } from 'react'

import type { Environment, Settings } from '../../api/types'
import { useDropdown } from '../template/DropdownContext'
import type { Theme } from '../../lib/theme'
import { envToneDot } from '../../lib/studioUtils'

export type SettingsDialogProps = {
  open: boolean
  t: (key: string) => string
  settings: Settings | null
  settingsDraft: Settings | null
  setSettingsDraft: Dispatch<SetStateAction<Settings | null>>
  envDrafts: Environment[] | null
  setEnvDrafts: Dispatch<SetStateAction<Environment[] | null>>
  displayEnvs: Environment[]
  activeProjectId: string
  addEnvironmentDraft: () => void
  requestDeleteEnvironmentDraft: (envId: string) => void
  importPostman: () => Promise<void> | void
  exportPostman: () => Promise<void> | void
  exportOpenAPI: () => Promise<void> | void
  errorMsg: string
  onClose: () => void
  onSave: () => Promise<void> | void
}

export function SettingsDialog({
  open,
  t,
  settings,
  settingsDraft,
  setSettingsDraft,
  envDrafts,
  setEnvDrafts,
  displayEnvs,
  activeProjectId,
  addEnvironmentDraft,
  requestDeleteEnvironmentDraft,
  importPostman,
  exportPostman,
  exportOpenAPI,
  errorMsg,
  onClose,
  onSave,
}: SettingsDialogProps) {
  const dd = useDropdown()
  const themeValue = (settingsDraft?.theme ?? settings?.theme ?? 'system') as Theme
  const themeLabel = themeValue === 'system' ? 'System' : themeValue === 'light' ? 'Light' : 'Dark'
  const languageValue = (settingsDraft?.language ?? settings?.language ?? 'zh') as 'zh' | 'en'
  const languageLabel = languageValue === 'zh' ? '中文' : 'English'

  return (
    <div
      id="settingsModalOverlay"
      className={clsx(
        'fixed inset-0 bg-gray-900/20 dark:bg-black/40 backdrop-blur-none z-[160] flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-200',
        open ? 'opacity-100 pointer-events-auto backdrop-blur-sm' : 'opacity-0 pointer-events-none backdrop-blur-none'
      )}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        id="settingsModalBox"
        className={clsx(
          'bg-white dark:bg-[#1e1e1e] w-full max-w-2xl rounded-xl shadow-float dark:shadow-floatDark border border-ui-border dark:border-[#333] flex flex-col overflow-hidden transform scale-95 transition-transform duration-200',
          open ? 'scale-100' : 'scale-95'
        )}
      >
        <div className="flex justify-between items-center px-5 py-3 border-b border-ui-border dark:border-ui-borderDark bg-surface-50 dark:bg-surface-900">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">{t('preferences')}</h2>
          <button
            id="closeSettingsBtn"
            className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            onClick={onClose}
            type="button"
            title="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="flex min-h-0">
          <div className="w-52 border-r border-ui-border dark:border-ui-borderDark p-4 bg-surface-50 dark:bg-surface-900">
            <div className="flex flex-col space-y-1">
              <div className="px-3 py-1.5 text-ui-primary font-medium bg-ui-primary/10 rounded-md cursor-pointer text-[13px]">
                {t('general')}
              </div>
              <div className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-surface-200 dark:hover:bg-surface-800 rounded-md cursor-pointer text-[13px]">
                {t('appearance')}
              </div>
              <div className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-surface-200 dark:hover:bg-surface-800 rounded-md cursor-pointer text-[13px]">
                Data
              </div>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            <div className="mb-5">
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1.5 text-[12px]">
                {t('timeout')}
              </label>
              <input
                type="number"
                value={settingsDraft?.requestTimeoutMs ?? settings?.requestTimeoutMs ?? 10000}
                onChange={(e) =>
                  setSettingsDraft((prev) => {
                    const base = prev ?? (settings ? { ...settings } : null)
                    if (!base) return prev
                    return { ...base, requestTimeoutMs: Number(e.target.value || 0) }
                  })
                }
                className="w-full bg-surface-50 dark:bg-surface-900 border border-ui-border dark:border-[#333] rounded-md px-3 py-1.5 text-gray-800 dark:text-gray-200 focus:border-ui-primary dark:focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 transition-all outline-none font-mono"
              />
            </div>

            <div className="mb-5">
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1.5 text-[12px]">{t('theme')}</label>
              <div id="dd-settings-theme" className="relative">
                <button
                  type="button"
                  className="w-full flex items-center bg-surface-50 dark:bg-surface-900 border border-ui-border dark:border-[#333] rounded-md px-3 py-1.5 text-gray-800 dark:text-gray-200 cursor-pointer transition-all hover:bg-surface-100 dark:hover:bg-surface-800"
                  onClick={() => dd.toggle('dd-settings-theme')}
                >
                  <span className="truncate">{themeLabel}</span>
                  <i
                    className={clsx(
                      'fa-solid fa-chevron-down ml-auto text-[10px] text-gray-400 transition-transform duration-200',
                      dd.isOpen('dd-settings-theme') ? 'rotate-180' : ''
                    )}
                  />
                </button>
                <div className={clsx('custom-dropdown-menu w-full', dd.isOpen('dd-settings-theme') ? '' : 'hidden')}>
                  {(['system', 'light', 'dark'] as Theme[]).map((val) => (
                    <button
                      key={val}
                      type="button"
                      className="custom-dropdown-item"
                      onClick={() => {
                        dd.close()
                        setSettingsDraft((prev) => {
                          const base = prev ?? (settings ? { ...settings } : null)
                          if (!base) return prev
                          return { ...base, theme: val }
                        })
                      }}
                    >
                      {val === 'system' ? 'System' : val === 'light' ? 'Light' : 'Dark'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1.5 text-[12px]">
                {t('language')}
              </label>
              <div id="dd-settings-language" className="relative">
                <button
                  type="button"
                  className="w-full flex items-center bg-surface-50 dark:bg-surface-900 border border-ui-border dark:border-[#333] rounded-md px-3 py-1.5 text-gray-800 dark:text-gray-200 cursor-pointer transition-all hover:bg-surface-100 dark:hover:bg-surface-800"
                  onClick={() => dd.toggle('dd-settings-language')}
                >
                  <span className="truncate">{languageLabel}</span>
                  <i
                    className={clsx(
                      'fa-solid fa-chevron-down ml-auto text-[10px] text-gray-400 transition-transform duration-200',
                      dd.isOpen('dd-settings-language') ? 'rotate-180' : ''
                    )}
                  />
                </button>
                <div className={clsx('custom-dropdown-menu w-full', dd.isOpen('dd-settings-language') ? '' : 'hidden')}>
                  <button
                    type="button"
                    className="custom-dropdown-item"
                    onClick={() => {
                      dd.close()
                      setSettingsDraft((prev) => {
                        const base = prev ?? (settings ? { ...settings } : null)
                        if (!base) return prev
                        return { ...base, language: 'zh' }
                      })
                    }}
                  >
                    中文
                  </button>
                  <button
                    type="button"
                    className="custom-dropdown-item"
                    onClick={() => {
                      dd.close()
                      setSettingsDraft((prev) => {
                        const base = prev ?? (settings ? { ...settings } : null)
                        if (!base) return prev
                        return { ...base, language: 'en' }
                      })
                    }}
                  >
                    English
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-gray-700 dark:text-gray-300 font-medium text-[12px]">{t('environments')}</label>
                <button
                  type="button"
                  className="h-7 px-2.5 rounded-md border border-ui-border dark:border-ui-borderDark bg-surface-50 dark:bg-surface-900 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors text-[12px] font-medium text-gray-700 dark:text-gray-200"
                  onClick={addEnvironmentDraft}
                  disabled={!activeProjectId}
                  title={t('addEnvironment')}
                >
                  <i className="fa-solid fa-plus mr-1.5 text-[10px] text-gray-400" />
                  {t('addEnvironment')}
                </button>
              </div>
              <div className="space-y-2">
                {(envDrafts ?? displayEnvs).map((e) => (
                  <div key={e.id} className="flex items-center gap-2">
                    <div className="w-36 shrink-0 flex items-center gap-2">
                      <span className={clsx('w-2 h-2 rounded-full', envToneDot(e.name))} />
                      <input
                        type="text"
                        value={e.name ?? ''}
                        onChange={(ev) => {
                          const v = ev.target.value
                          setEnvDrafts((prev) => {
                            const base = (prev ?? displayEnvs).map((x) => ({ ...x, vars: { ...(x.vars ?? {}) } }))
                            const i = base.findIndex((x) => x.id === e.id)
                            if (i >= 0) base[i] = { ...base[i], name: v }
                            return base
                          })
                        }}
                        placeholder={t('envName')}
                        className="w-full min-w-0 bg-surface-50 dark:bg-surface-900 border border-ui-border dark:border-[#333] rounded-md px-2.5 py-1.5 text-gray-800 dark:text-gray-200 focus:border-ui-primary dark:focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 transition-all outline-none text-[12px] font-medium"
                      />
                    </div>
                    <input
                      type="text"
                      value={e.baseUrl ?? ''}
                      onChange={(ev) => {
                        const v = ev.target.value
                        setEnvDrafts((prev) => {
                          const base = (prev ?? displayEnvs).map((x) => ({ ...x, vars: { ...(x.vars ?? {}) } }))
                          const i = base.findIndex((x) => x.id === e.id)
                          if (i >= 0) base[i] = { ...base[i], baseUrl: v }
                          return base
                        })
                      }}
                      placeholder={t('baseUrlOptional')}
                      className="flex-1 min-w-0 bg-surface-50 dark:bg-surface-900 border border-ui-border dark:border-[#333] rounded-md px-3 py-1.5 text-gray-800 dark:text-gray-200 focus:border-ui-primary dark:focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 transition-all outline-none font-mono text-[12px]"
                    />
                    <button
                      type="button"
                      className={clsx(
                        'w-9 h-9 rounded-md border border-ui-border dark:border-ui-borderDark flex items-center justify-center transition-colors',
                        (envDrafts ?? displayEnvs).length <= 1
                          ? 'opacity-50 cursor-not-allowed bg-surface-50 dark:bg-surface-900 text-gray-400'
                          : 'bg-surface-50 dark:bg-surface-900 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400'
                      )}
                      onClick={() => requestDeleteEnvironmentDraft(e.id)}
                      disabled={(envDrafts ?? displayEnvs).length <= 1}
                      title={t('delete')}
                      aria-label={t('delete')}
                    >
                      <i className="fa-solid fa-trash text-[12px]" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{t('baseUrlHelp')}</div>
            </div>

            <div className="mb-5">
              <label className="flex items-center cursor-pointer group">
                <div className="relative flex items-center justify-center w-4 h-4 mr-2">
                  <input
                    type="checkbox"
                    checked={settingsDraft?.autoSave ?? settings?.autoSave ?? true}
                    onChange={(e) =>
                      setSettingsDraft((prev) => {
                        const base = prev ?? (settings ? { ...settings } : null)
                        if (!base) return prev
                        return { ...base, autoSave: e.target.checked }
                      })
                    }
                    className="peer appearance-none w-4 h-4 border border-gray-300 dark:border-[#555] rounded-[3px] checked:bg-ui-primary checked:border-ui-primary transition-colors cursor-pointer"
                  />
                  <i className="fa-solid fa-check absolute text-white text-[10px] opacity-0 peer-checked:opacity-100 pointer-events-none" />
                </div>
                <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                  {t('autoSave')}
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-ui-border dark:border-ui-borderDark">
              <button
                type="button"
                className="px-3 py-1.5 border border-ui-border dark:border-ui-borderDark rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors font-medium"
                onClick={importPostman}
              >
                {t('importPostman')}
              </button>
              <button
                type="button"
                className="px-3 py-1.5 border border-ui-border dark:border-ui-borderDark rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors font-medium"
                onClick={exportPostman}
                disabled={!activeProjectId}
              >
                {t('exportPostman')}
              </button>
              <button
                type="button"
                className="px-3 py-1.5 border border-ui-border dark:border-ui-borderDark rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors font-medium"
                onClick={exportOpenAPI}
                disabled={!activeProjectId}
              >
                {t('exportOpenapi')}
              </button>
            </div>

            {errorMsg ? <div className="mt-4 text-[12px] text-red-600 dark:text-red-300">{errorMsg}</div> : null}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-ui-border dark:border-ui-borderDark flex justify-end bg-surface-50 dark:bg-surface-900 gap-2">
          <button
            id="cancelSettingsBtn"
            className="px-4 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-surface-200 dark:hover:bg-surface-800 rounded-md transition-colors font-medium"
            onClick={onClose}
            type="button"
          >
            {t('cancel')}
          </button>
          <button
            className="px-4 py-1.5 bg-ui-primary hover:bg-ui-primaryHover text-white rounded-md transition-colors shadow-sm font-medium"
            type="button"
            onClick={onSave}
          >
            {t('saveChanges')}
          </button>
        </div>
      </div>
    </div>
  )
}
