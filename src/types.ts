export interface VaultItem {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: VaultItem[];
}

