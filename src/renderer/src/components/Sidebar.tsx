import React, { useState, useEffect } from "react";
import {
  FileText,
  Folder,
  FolderOpen,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import { VaultItem } from "../types";

interface SidebarProps {
  onSelectFile: (path: string | null) => void;
  onSelectDirectory: (path: string | null) => void;
  selectedDirectory: string | null;
  selectedFile: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onSelectFile,
  onSelectDirectory,
  selectedDirectory,
  selectedFile,
}) => {
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

  const joinPath = (base: string | null, name: string) =>
    base ? `${base}/${name}` : name;

  const isPathInsideFolder = (path: string | null, folderPath: string) => {
    if (!path) return false;
    return path === folderPath || path.startsWith(`${folderPath}/`);
  };

  const updatePathForFolderRename = (
    path: string | null,
    oldFolderPath: string,
    newFolderPath: string,
  ) => {
    if (!path) return path;
    if (path === oldFolderPath) return newFolderPath;
    if (!path.startsWith(`${oldFolderPath}/`)) return path;
    return `${newFolderPath}${path.slice(oldFolderPath.length)}`;
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

  const renderItem = (item: VaultItem, depth: number = 0) => {
    const isFolder = item.type === "folder";
    const isExpanded = expandedFolders.has(item.path);
    const isSelected = selectedFile === item.path;
    const isDirectorySelected = selectedDirectory === item.path;
    const isRenaming = renamingPath === item.path;

    return (
      <div key={item.path}>
        <div
          className={`group flex items-center gap-1 px-2 py-[5px] cursor-pointer hover:bg-accent/40 rounded-md ${
            isSelected || isDirectorySelected ? "bg-accent" : ""
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
          {isFolder && (
            <span className="w-4 h-4 flex items-center justify-center">
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground/70" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground/70" />
              )}
            </span>
          )}
          {isFolder ? (
            isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-foreground/70" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-foreground/70" />
            )
          ) : (
            <FileText className="w-3.5 h-3.5 text-muted-foreground/70" />
          )}
          {isRenaming ? (
            <Input
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
              className="h-7 text-xs flex-1"
            />
          ) : (
            <span className="text-[13px] flex-1 truncate text-foreground/88">
              {item.name}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="w-3 h-3 text-muted-foreground/70" />
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
          <div>
            {item.children.map((child) => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="h-full border-r flex flex-col bg-background"
      style={{ minWidth: 180 }}
    >
      <div className="p-2 border-b space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            onClick={() => onSelectDirectory(null)}
          >
            Root
          </Button>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] gap-1.5 text-foreground/80"
              onClick={() => handleCreate("file")}
            >
              <FileText className="w-3 h-3" />
              New File
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] gap-1.5 text-foreground/80"
              onClick={() => handleCreate("folder")}
            >
              <Folder className="w-3 h-3" />
              New Folder
            </Button>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground/70 truncate tracking-wide">
          {selectedDirectory ? `Target: ${selectedDirectory}` : "Target: Root"}
        </div>
      </div>

      <div className="flex-1 overflow-auto py-2">
        {files.map((item) => renderItem(item))}
      </div>
    </div>
  );
};
