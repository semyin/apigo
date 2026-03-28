import type { TreeNode } from '../api/types'

export function TreeView({
  nodes,
  collapsed,
  onToggleFolder,
  selectedRequestId,
  onSelectRequest,
}: {
  nodes: TreeNode[]
  collapsed: Record<string, boolean>
  onToggleFolder: (id: string) => void
  selectedRequestId: string
  onSelectRequest: (requestId: string) => void
}) {
  return (
    <div className="space-y-0.5">
      {nodes.map((n) => (
        <TreeNodeRow
          key={n.id}
          node={n}
          depth={0}
          collapsed={collapsed}
          onToggleFolder={onToggleFolder}
          selectedRequestId={selectedRequestId}
          onSelectRequest={onSelectRequest}
        />
      ))}
    </div>
  )
}

function TreeNodeRow({
  node,
  depth,
  collapsed,
  onToggleFolder,
  selectedRequestId,
  onSelectRequest,
}: {
  node: TreeNode
  depth: number
  collapsed: Record<string, boolean>
  onToggleFolder: (id: string) => void
  selectedRequestId: string
  onSelectRequest: (requestId: string) => void
}) {
  const isFolder = node.type === 'folder'
  const isCollapsed = collapsed[node.id] ?? false

  if (isFolder) {
    return (
      <div>
        <div
          data-folder-row
          data-folder-name={node.name}
          className="group flex items-center px-2 py-1.5 hover:bg-surface-200 dark:hover:bg-surface-800/60 cursor-pointer rounded-md text-gray-700 dark:text-gray-200 transition-colors"
          onClick={() => onToggleFolder(node.id)}
          style={{ marginLeft: depth * 12 }}
        >
          <div className="flex items-center min-w-0">
            <i
              className={[
                'fa-solid',
                isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down',
                'text-[10px] text-gray-400 mr-1.5',
                'group-hover:text-gray-600 dark:group-hover:text-gray-300',
              ].join(' ')}
            />
            <i className="fa-regular fa-folder text-yellow-500 mr-2 text-[12px]" />
            <span className="font-medium truncate">{node.name}</span>
          </div>
        </div>

        {!isCollapsed && node.children?.length ? (
          <div className="mt-0.5 space-y-0.5">
            {node.children.map((c) => (
              <TreeNodeRow
                key={c.id}
                node={c}
                depth={depth + 1}
                collapsed={collapsed}
                onToggleFolder={onToggleFolder}
                selectedRequestId={selectedRequestId}
                onSelectRequest={onSelectRequest}
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  const { toneClass, short } = methodTone(node.method || 'GET')
  const isSelected = node.requestId === selectedRequestId

  return (
    <div
      data-request-row
      data-request-name={node.name}
      className={[
        'pl-7 pr-2 py-1 flex items-center cursor-pointer rounded-md mt-0.5 transition-colors relative',
        isSelected
          ? 'bg-blue-50 dark:bg-blue-900/20 text-ui-primary dark:text-blue-400 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:bg-ui-primary before:rounded-r'
          : 'hover:bg-surface-200 dark:hover:bg-surface-800/60 text-gray-600 dark:text-gray-400',
      ].join(' ')}
      style={{ marginLeft: depth * 12 }}
      onClick={() => {
        if (node.requestId) onSelectRequest(node.requestId)
      }}
    >
      <span className={[toneClass, 'font-mono font-semibold text-[10px] w-8'].join(' ')}>
        {short}
      </span>
      <span className={isSelected ? 'truncate font-medium' : 'truncate'}>{node.name}</span>
    </div>
  )
}

function methodTone(method: string): { toneClass: string; short: string } {
  const m = method.toUpperCase()
  if (m === 'POST') return { toneClass: 'text-http-post', short: 'POST' }
  if (m === 'PUT') return { toneClass: 'text-http-put', short: 'PUT' }
  if (m === 'DELETE') return { toneClass: 'text-http-delete', short: 'DEL' }
  if (m === 'PATCH') return { toneClass: 'text-http-patch', short: 'PATCH' }
  return { toneClass: 'text-http-get', short: 'GET' }
}

