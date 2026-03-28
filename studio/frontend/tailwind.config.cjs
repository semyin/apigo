/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        surface: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          800: '#27272a',
          900: '#18181b',
          950: '#0f0f11',
        },
        ui: {
          border: '#e4e4e7',
          borderDark: '#333338',
          primary: '#2563eb',
          primaryHover: '#1d4ed8',
        },
        http: {
          get: '#10b981',
          post: '#eab308',
          put: '#3b82f6',
          delete: '#ef4444',
          patch: '#f97316',
        },
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        float: '0 4px 12px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0,0,0,0.2)',
        floatDark: '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255,255,255,0.1)',
      },
    },
  },
  plugins: [],
}

