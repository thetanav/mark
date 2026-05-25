import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
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
import { Fragment, useEffect, useMemo, useState } from "react";

import type { EditorHandle, ViewMode } from "@/components/Editor";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
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

interface PaletteCommandItem {
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  id: string;
  label: string;
  persistOnRun?: boolean;
  run: () => void | Promise<void>;
  shortcut?: string;
}

const MARKDOWN_EXTENSION = /\.md$/;

function flattenFiles(items: VaultItem[]): VaultItem[] {
  return items.flatMap((item) => [
    item,
    ...(item.children ? flattenFiles(item.children) : []),
  ]);
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
    setInputMode(null);
    setInputValue("");
    setError("");
    window.electronAPI?.vault.getFiles().then(setFiles);
  }, [open]);

  const commands = useMemo<PaletteCommandItem[]>(
    () => [
      {
        id: "new-note",
        label: "New note",
        hint: "Create markdown file",
        icon: FilePlus2,
        shortcut: "Ctrl N",
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
        shortcut: "Ctrl F",
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
        persistOnRun: true,
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
        persistOnRun: true,
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
        shortcut: "Ctrl ,",
        run: onOpenSettings,
      },
    ],
    [
      editor,
      focusMode,
      onCreateNote,
      onFilesChanged,
      onOpenFile,
      onOpenSettings,
      onSetTheme,
      onToggleFocusMode,
      selectedDirectory,
      selectedFile,
      theme,
    ]
  );

  const fileCommands = useMemo<PaletteCommandItem[]>(
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

  const groupedItems = useMemo(
    () => [
      { items: commands, value: "Commands" },
      { items: fileCommands, value: "Files" },
    ],
    [commands, fileCommands]
  );

  const runCommand = async (item: PaletteCommandItem) => {
    await item.run();
    if (!item.persistOnRun) {
      onOpenChange(false);
    }
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

  return (
    <CommandDialog onOpenChange={onOpenChange} open={open}>
      <CommandDialogPopup>
        {inputMode ? (
          <form
            className="relative -mx-px -mb-px rounded-2xl border bg-popover bg-clip-padding"
            onSubmit={(event) => {
              event.preventDefault();
              submitInput();
            }}
          >
            <div className="flex h-12 items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                onChange={(event) => {
                  setInputValue(event.target.value);
                  setError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    setInputMode(null);
                    setError("");
                  }
                }}
                placeholder={
                  inputMode === "rename"
                    ? "New note name..."
                    : "Target folder inside vault..."
                }
                value={inputValue}
              />
              <CommandShortcut>Enter</CommandShortcut>
            </div>
            <div className="px-4 py-3 text-muted-foreground text-xs">
              {inputMode === "rename"
                ? "Rename the selected note."
                : "Move the selected note to an existing folder."}
              {error && (
                <p className="mt-2 text-destructive text-xs">{error}</p>
              )}
            </div>
          </form>
        ) : (
          <Command items={groupedItems}>
            <CommandInput placeholder="Search files and commands..." />
            <CommandPanel>
              <CommandEmpty>No matching command or file.</CommandEmpty>
              <CommandList>
                {(
                  group: { items: PaletteCommandItem[]; value: string },
                  index
                ) => (
                  <Fragment key={group.value}>
                    <CommandGroup items={group.items}>
                      <CommandGroupLabel>{group.value}</CommandGroupLabel>
                      <CommandCollection>
                        {(item: PaletteCommandItem) => {
                          const Icon = item.icon;
                          return (
                            <CommandItem
                              key={item.id}
                              onClick={() => runCommand(item)}
                              value={`${item.label} ${item.hint}`}
                            >
                              <Icon className="mr-2 h-4 w-4 opacity-70" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px]">
                                  {item.label}
                                </span>
                                <span className="block truncate text-[11px] text-muted-foreground">
                                  {item.hint}
                                </span>
                              </span>
                              {item.shortcut && (
                                <CommandShortcut>
                                  {item.shortcut}
                                </CommandShortcut>
                              )}
                            </CommandItem>
                          );
                        }}
                      </CommandCollection>
                    </CommandGroup>
                    {index < groupedItems.length - 1 && <CommandSeparator />}
                  </Fragment>
                )}
              </CommandList>
            </CommandPanel>
            <CommandFooter>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <ArrowUp className="h-3.5 w-3.5" />
                  <ArrowDown className="h-3.5 w-3.5" />
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CornerDownLeft className="h-3.5 w-3.5" />
                  <span>Open</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <CommandShortcut>Esc</CommandShortcut>
                <span>Close</span>
              </div>
            </CommandFooter>
          </Command>
        )}
      </CommandDialogPopup>
    </CommandDialog>
  );
}
