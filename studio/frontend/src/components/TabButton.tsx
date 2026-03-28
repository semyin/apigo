import clsx from 'clsx'

export function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      className={clsx(
        'pb-2 pt-1 font-medium relative',
        'after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px]',
        'after:rounded-t-sm transition-colors',
        active
          ? 'text-ui-primary after:bg-ui-primary'
          : [
              'text-gray-500 hover:text-gray-800',
              'dark:text-gray-400 dark:hover:text-gray-200',
              'after:bg-transparent',
            ]
      )}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
