import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  House,
  MoreHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { VaultItem } from "@/types";

interface SidebarProps {
  onSelectFile: (path: string | null) => void;
  onSelectDirectory: (path: string | null) => void;
  selectedDirectory: string | null;
  selectedFile: string | null;
}

function joinPath(base: string | null, name: string) {
  return base ? `${base}/${name}` : name;
}

function isPathInsideFolder(path: string | null, folderPath: string) {
  if (!path) return false;
  return path === folderPath || path.startsWith(`${folderPath}/`);
}

function updatePathForFolderRename(
  path: string | null,
  oldFolderPath: string,
  newFolderPath: string,
) {
  if (!path) return path;
  if (path === oldFolderPath) return newFolderPath;
  if (!path.startsWith(`${oldFolderPath}/`)) return path;
  return `${newFolderPath}${path.slice(oldFolderPath.length)}`;
}

export function Sidebar({
  onSelectFile,
  onSelectDirectory,
  selectedDirectory,
  selectedFile,
}: SidebarProps) {
  const [files, setFiles] = useState<VaultItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const loadFiles = async () => {
    if (!window.electronAPI) return;
    const items = await window.electronAPI.vault.getFiles();
    setFiles(items);
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const getTimestampName = () => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate(),
    )}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(
      now.getSeconds(),
    )}-${String(now.getMilliseconds()).padStart(3, "0")}`;
  };

  const handleCreate = async (type: "file" | "folder") => {
    if (!window.electronAPI) return;

    const baseName = getTimestampName();
    const path =
      type === "file"
        ? joinPath(selectedDirectory, `${baseName}.md`)
        : joinPath(selectedDirectory, baseName);

    if (type === "file") {
      await window.electronAPI.vault.createFile(path);
      onSelectFile(path);
    } else {
      await window.electronAPI.vault.createFolder(path);
    }

    loadFiles();
  };

  const handleRenameStart = (item: VaultItem) => {
    setRenamingPath(item.path);
    setRenameValue(item.name);
  };

  const handleRenameCancel = () => {
    setRenamingPath(null);
    setRenameValue("");
  };

  const handleRenameCommit = async (item: VaultItem) => {
    if (!window.electronAPI) {
      handleRenameCancel();
      return;
    }

    const nextName = renameValue.trim();
    if (!nextName || nextName === item.name) {
      handleRenameCancel();
      return;
    }

    const renamedPath = await window.electronAPI.vault.renameItem(
      item.path,
      nextName,
    );

    if (typeof renamedPath === "string" && renamedPath) {
      if (item.type === "folder") {
        setExpandedFolders((prev) => {
          const next = new Set<string>();
          prev.forEach((folderPath) => {
            if (folderPath === item.path) {
              next.add(renamedPath);
            } else if (folderPath.startsWith(`${item.path}/`)) {
              next.add(`${renamedPath}${folderPath.slice(item.path.length)}`);
            } else {
              next.add(folderPath);
            }
          });
          return next;
        });
      }

      if (item.type === "file") {
        onSelectFile(
          updatePathForFolderRename(selectedFile, item.path, renamedPath),
        );
      } else {
        onSelectDirectory(
          updatePathForFolderRename(selectedDirectory, item.path, renamedPath),
        );
        onSelectFile(
          updatePathForFolderRename(selectedFile, item.path, renamedPath),
        );
      }
    }

    handleRenameCancel();
    loadFiles();
  };

  const handleDelete = async (path: string) => {
    if (!window.electronAPI) return;
    await window.electronAPI.vault.deleteItem(path);

    setExpandedFolders((prev) => {
      const next = new Set<string>();
      prev.forEach((folderPath) => {
        if (!isPathInsideFolder(folderPath, path)) {
          next.add(folderPath);
        }
      });
      return next;
    });

    if (isPathInsideFolder(selectedFile, path)) {
      onSelectFile(null);
    }
    if (isPathInsideFolder(selectedDirectory, path)) {
      onSelectDirectory(null);
    }

    loadFiles();
  };

  const renderItem = (item: VaultItem, depth = 0) => {
    const isFolder = item.type === "folder";
    const isExpanded = expandedFolders.has(item.path);
    const isSelected = selectedFile === item.path;
    const isDirectorySelected = selectedDirectory === item.path;
    const isRenaming = renamingPath === item.path;

    return (
      <div key={item.path}>
        <div
          className={`group flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-accent/40 ${
            isSelected || isDirectorySelected ? "bg-accent/30" : ""
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (isFolder) {
              onSelectDirectory(item.path);
              toggleFolder(item.path);
            } else {
              onSelectFile(item.path);
            }
          }}
        >
          {isFolder ? (
            isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 text-foreground/70" />
            ) : (
              <Folder className="h-3.5 w-3.5 text-foreground/70" />
            )
          ) : (
            <FileText className="h-3.5 w-3.5 text-muted-foreground/70" />
          )}
          {isRenaming ? (
            <input
              autoFocus
              size={1}
              value={renameValue}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleRenameCommit(item);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  handleRenameCancel();
                }
              }}
              onBlur={() => {
                if (renamingPath === item.path) {
                  handleRenameCommit(item);
                }
              }}
              className="flex-1 text-[12px] outline-none border-b"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate text-[12px] text-foreground/88">
              {item.name}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer"
                title="Item actions"
                aria-label="Item actions"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3 text-muted-foreground/70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => handleRenameStart(item)}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleDelete(item.path)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {isFolder && isExpanded && item.children && (
          <div>{item.children.map((child) => renderItem(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <aside className="flex h-full min-w-[180px] flex-col border-r bg-background/90 backdrop-blur-sm">

        <div className="h-10 border-b flex items-center w-full justify-end gap-1 px-2">
          <Button
            variant="outline"
            size="icon-sm"
            className="h-7 w-7"
            title="New file"
            aria-label="New file"
            onClick={() => handleCreate("file")}
          >
            <FilePlus2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="h-7 w-7"
            title="New folder"
            aria-label="New folder"
            onClick={() => handleCreate("folder")}
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        </div>

      <div className="flex-1 overflow-auto">
        {files.map((item) => renderItem(item))}
      </div>
    </aside>
  );
}
