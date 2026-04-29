export interface VaultItem {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: VaultItem[]
}

export type ViewMode = 'edit' | 'preview' | 'split'

export interface FileNode {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
  content?: string
}
