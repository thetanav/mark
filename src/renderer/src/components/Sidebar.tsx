import React, { useState, useEffect } from "react";
import {
  FileText,
  Folder,
  FolderOpen,
  Plus,
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
  onSelectFile: (path: string) => void;
  selectedFile: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onSelectFile,
  selectedFile,
}) => {
  const [files, setFiles] = useState<VaultItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [creating, setCreating] = useState<"file" | "folder" | null>(null);
  const [newItemName, setNewItemName] = useState("");

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

  const handleCreate = async (type: "file" | "folder") => {
    if (!newItemName || !window.electronAPI) return;
    const ext = type === "file" && !newItemName.endsWith(".md") ? ".md" : "";
    const path = newItemName + ext;
    if (type === "file") {
      await window.electronAPI.vault.createFile(path);
    } else {
      await window.electronAPI.vault.createFolder(path);
    }
    setCreating(null);
    setNewItemName("");
    loadFiles();
  };

  const handleDelete = async (path: string) => {
    if (!window.electronAPI) return;
    await window.electronAPI.vault.deleteItem(path);
    loadFiles();
  };

  const renderItem = (item: VaultItem, depth: number = 0) => {
    const isFolder = item.type === "folder";
    const isExpanded = expandedFolders.has(item.path);
    const isSelected = selectedFile === item.path;

    return (
      <div key={item.path}>
        <div
          className={`group flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-sm ${
            isSelected ? "bg-accent" : ""
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (isFolder) {
              toggleFolder(item.path);
            } else {
              onSelectFile(item.path);
            }
          }}
        >
          {isFolder && (
            <span className="w-4 h-4 flex items-center justify-center">
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </span>
          )}
          {isFolder ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-primary" />
            ) : (
              <Folder className="w-4 h-4 text-primary" />
            )
          ) : (
            <FileText className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-sm flex-1 truncate">{item.name}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
      <div className="p-2 border-b flex items-center justify-between">
        <div />
        <div className="flex gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-6 w-6">
                <Plus className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setCreating("file")}>
                New File
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCreating("folder")}>
                New Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {creating && (
        <div className="px-3 py-2 border-b">
          <Input
            autoFocus
            size={1}
            placeholder={creating === "file" ? "note.md" : "folder"}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate(creating);
              if (e.key === "Escape") {
                setCreating(null);
                setNewItemName("");
              }
            }}
            onBlur={() => {
              setCreating(null);
              setNewItemName("");
            }}
            className="h-7 text-xs"
          />
        </div>
      )}

      <div className="flex-1 overflow-auto py-2">
        {files.map((item) => renderItem(item))}
      </div>
    </div>
  );
};
