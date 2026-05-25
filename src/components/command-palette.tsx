import {
  FilePlus2,
  FileSearch,
  FolderInput,
  Moon,
  PanelTopClose,
  PanelTopOpen,
  Search,
  Settings,
  SplitSquareHorizontal,
  Sun,
} from "lucide-react";
import type * as React from "react";
import { useEffect, useMemo, useState } from "react";

import type { EditorHandle, ViewMode } from "@/components/Editor";
import { Button } from "@/components/ui/button";
import type { VaultItem } from "@/types";

interface CommandPaletteProps {
  editor: React.RefObject<EditorHandle | null>;
  focusMode: boolean;
  onCreateNote: () => Promise<void>;
  onFilesChanged: () => void;
  onMoveSelected: (targetFolder: string) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
  onOpenFile: (path: string) => void;
  onOpenSettings: () => void;
  onRenameSelected: (name: string) => Promise<boolean>;
  onSetTheme: (theme: "light" | "dark") => void;
  onToggleFocusMode: () => void;
  open: boolean;
  selectedDirectory: string | null;
  selectedFile: string | null;
  theme: "light" | "dark";
}

interface CommandItem {
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  id: string;
  label: string;
  run: () => void | Promise<void>;
}

const QUERY_PART_SEPARATOR = /\s+/;
const MARKDOWN_EXTENSION = /\.md$/;

function flattenFiles(items: VaultItem[]): VaultItem[] {
  return items.flatMap((item) => [
    item,
    ...(item.children ? flattenFiles(item.children) : []),
  ]);
}

function matchesQuery(item: CommandItem, query: string) {
  const value = `${item.label} ${item.hint}`.toLowerCase();
  return query
    .toLowerCase()
    .split(QUERY_PART_SEPARATOR)
    .filter(Boolean)
    .every((part) => value.includes(part));
}

export function CommandPalette({
  open,
  onOpenChange,
  selectedFile,
  selectedDirectory,
  editor,
  theme,
  focusMode,
  onCreateNote,
  onFilesChanged,
  onOpenFile,
  onOpenSettings,
  onRenameSelected,
  onMoveSelected,
  onSetTheme,
  onToggleFocusMode,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [files, setFiles] = useState<VaultItem[]>([]);
  const [inputMode, setInputMode] = useState<"move" | "rename" | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        onOpenChange(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setActiveIndex(0);
    setInputMode(null);
    setError("");
    window.electronAPI?.vault.getFiles().then(setFiles);
  }, [open]);

  const commands = useMemo<CommandItem[]>(
    () => [
      {
        id: "new-note",
        label: "New note",
        hint: "Create markdown file",
        icon: FilePlus2,
        run: onCreateNote,
      },
      {
        id: "open-md",
        label: "Open .md from filesystem",
        hint: "Import markdown file into vault",
        icon: FolderInput,
        run: async () => {
          const result = await window.electronAPI?.vault.importMarkdownFile();
          if (!result || result.canceled) {
            return;
          }
          onFilesChanged();
          onOpenFile(result.path);
        },
      },
      {
        id: "search-editor",
        label: "Search current note",
        hint: "Find text in editor",
        icon: Search,
        run: () => editor.current?.openSearch(),
      },
      {
        id: "toggle-preview",
        label: "Toggle preview",
        hint: "Switch between split and preview",
        icon: SplitSquareHorizontal,
        run: () => {
          const nextMode: ViewMode = selectedFile ? "preview" : "split";
          editor.current?.setViewMode(nextMode);
        },
      },
      {
        id: "export-pdf",
        label: "Export PDF",
        hint: "Download current note",
        icon: FileSearch,
        run: () => editor.current?.exportAs("pdf"),
      },
      {
        id: "export-html",
        label: "Export HTML",
        hint: "Download rendered HTML",
        icon: FileSearch,
        run: () => editor.current?.exportAs("html"),
      },
      {
        id: "rename",
        label: "Rename selected note",
        hint: "Change file name",
        icon: FileSearch,
        run: () => {
          const currentName =
            selectedFile?.split("/").pop()?.replace(MARKDOWN_EXTENSION, "") ??
            "";
          setInputValue(currentName);
          setInputMode("rename");
          setError("");
        },
      },
      {
        id: "move",
        label: "Move selected note",
        hint: "Move to folder path",
        icon: FolderInput,
        run: () => {
          setInputValue(selectedDirectory ?? "");
          setInputMode("move");
          setError("");
        },
      },
      {
        id: "focus",
        label: focusMode ? "Exit focus mode" : "Enter focus mode",
        hint: "Hide chrome and center editor",
        icon: focusMode ? PanelTopOpen : PanelTopClose,
        run: onToggleFocusMode,
      },
      {
        id: "theme",
        label:
          theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        hint: "Toggle app theme",
        icon: theme === "dark" ? Sun : Moon,
        run: () => onSetTheme(theme === "dark" ? "light" : "dark"),
      },
      {
        id: "settings",
        label: "Settings",
        hint: "Open app settings",
        icon: Settings,
        run: onOpenSettings,
      },
    ],
    [
      editor,
      focusMode,
      onCreateNote,
      onFilesChanged,
      onMoveSelected,
      onOpenFile,
      onOpenSettings,
      onRenameSelected,
      onSetTheme,
      onToggleFocusMode,
      selectedFile,
      theme,
    ]
  );

  const fileCommands = useMemo<CommandItem[]>(
    () =>
      flattenFiles(files)
        .filter((item) => item.type === "file")
        .map((item) => ({
          id: `file:${item.path}`,
          label: item.name,
          hint: item.path,
          icon: FileSearch,
          run: () => onOpenFile(item.path),
        })),
    [files, onOpenFile]
  );

  const results = [...commands, ...fileCommands].filter((item) =>
    matchesQuery(item, query)
  );

  const runActive = async () => {
    const item = results[activeIndex];
    if (!item) {
      return;
    }
    await item.run();
    onOpenChange(false);
  };

  const submitInput = async () => {
    if (!inputMode) {
      return;
    }

    const value = inputValue.trim();
    const success =
      inputMode === "rename"
        ? await onRenameSelected(value)
        : await onMoveSelected(value);

    if (!success) {
      setError(
        inputMode === "rename"
          ? "Choose a valid note name."
          : "Target folder does not exist."
      );
      return;
    }

    onOpenChange(false);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      <button
        aria-label="Close command palette"
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-[min(680px,calc(100vw-32px))] overflow-hidden rounded-xl border border-border/80 bg-popover shadow-2xl">
        <div className="flex h-12 items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onChange={(event) => {
              if (inputMode) {
                setInputValue(event.target.value);
                return;
              }

              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                if (inputMode) {
                  setInputMode(null);
                  setError("");
                } else {
                  onOpenChange(false);
                }
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex(
                  (index) => (index + 1) % Math.max(results.length, 1)
                );
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex(
                  (index) =>
                    (index - 1 + Math.max(results.length, 1)) %
                    Math.max(results.length, 1)
                );
              }
              if (event.key === "Enter") {
                event.preventDefault();
                if (inputMode) {
                  submitInput();
                } else {
                  runActive();
                }
              }
            }}
            placeholder={
              inputMode === "rename"
                ? "New note name..."
                : inputMode === "move"
                  ? "Target folder inside vault..."
                  : "Search files and commands..."
            }
            value={inputMode ? inputValue : query}
          />
          <span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Ctrl P
          </span>
        </div>

        {inputMode ? (
          <div className="p-3">
            <p className="mb-2 text-muted-foreground text-xs">
              {inputMode === "rename"
                ? "Press Enter to rename the selected note."
                : "Press Enter to move the selected note."}
            </p>
            {error && <p className="text-destructive text-xs">{error}</p>}
          </div>
        ) : (
          <div className="max-h-[420px] overflow-auto p-1.5">
            {results.length === 0 ? (
              <div className="px-3 py-8 text-center text-muted-foreground text-sm">
                No matching command or file
              </div>
            ) : (
              results.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Button
                    className={`h-11 w-full justify-start rounded-md px-2 ${
                      activeIndex === index ? "bg-accent" : ""
                    }`}
                    key={item.id}
                    onClick={runActive}
                    onMouseEnter={() => setActiveIndex(index)}
                    variant="ghost"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[13px]">
                        {item.label}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {item.hint}
                      </span>
                    </span>
                  </Button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
