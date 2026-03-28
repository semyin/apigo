export function HeadersTemplateView({ headers }: { headers: Record<string, string[]> }) {
  const entries = Object.entries(headers || {})
    .map(([k, v]) => [k, (v || []).join(', ')] as const)
    .sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-ui-border dark:border-ui-borderDark">
        <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,2.1fr)] border-b border-ui-border bg-surface-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:border-ui-borderDark dark:bg-surface-900 dark:text-gray-500">
          <div>Name</div>
          <div>Value</div>
        </div>
        <div className="divide-y divide-ui-border dark:divide-ui-borderDark">
          {entries.length ? (
            entries.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,2.1fr)] px-4 py-3">
                <div className="font-mono text-[12px] text-gray-600 dark:text-gray-300">{k.toLowerCase()}</div>
                <div className="font-mono text-[12px] break-all text-gray-900 dark:text-gray-100">{v}</div>
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-[12px] text-gray-500 dark:text-gray-400">No headers.</div>
          )}
        </div>
      </div>
    </div>
  )
}

