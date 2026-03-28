export function HeadersView({ headers }: { headers: Record<string, string[]> }) {
  const keys = Object.keys(headers || {}).sort((a, b) => a.localeCompare(b))
  if (keys.length === 0) {
    return <div className="text-[12px] text-gray-500 dark:text-gray-400">Empty</div>
  }

  return (
    <div className="space-y-2">
      {keys.map((k) => (
        <div
          key={k}
          className="rounded-md border border-ui-border dark:border-ui-borderDark p-2"
        >
          <div className="font-mono text-[12px] text-gray-800 dark:text-gray-200">{k}</div>
          <div className="mt-1 font-mono text-[12px] text-gray-600 dark:text-gray-300 break-all">
            {(headers[k] ?? []).join(', ')}
          </div>
        </div>
      ))}
    </div>
  )
}

