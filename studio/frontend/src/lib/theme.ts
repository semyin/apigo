export type Theme = 'light' | 'dark' | 'system'

const storageKey = 'api-studio-theme'

export function getStoredTheme(): Theme | null {
  const v = localStorage.getItem(storageKey)
  if (v === 'light' || v === 'dark' || v === 'system') return v
  return null
}

export function storeTheme(t: Theme) {
  localStorage.setItem(storageKey, t)
}

export function resolveTheme(t: Theme): 'light' | 'dark' {
  if (t === 'system') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return t
}

export function applyThemeClass(resolved: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

