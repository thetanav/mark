import {
  Columns,
  Download,
  Eye,
  ListTodo,
  Pencil,
  Quote,
  Save,
  Table,
  TerminalSquare,
} from "lucide-react";
import Markdown from "markdown-to-jsx";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import type * as React from "react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import "monaco-editor/min/vs/editor/editor.main.css";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker.js?worker";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type MonacoEditor = monaco.editor.IStandaloneCodeEditor;

declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker: (moduleId: string, label: string) => Worker;
    };
  }
}

if (typeof window !== "undefined" && !window.MonacoEnvironment) {
  window.MonacoEnvironment = {
    getWorker: (_moduleId, label) => {
      if (label === "editorWorkerService") {
        return new EditorWorker();
      }

      return new EditorWorker();
    },
  };
}

export type ViewMode = "edit" | "preview" | "split";

export interface EditorHandle {
  exportAs: (format: "pdf" | "docx" | "html") => Promise<void>;
  focus: () => void;
  insertSnippet: (snippet: string) => void;
  openSearch: () => void;
  setViewMode: (mode: ViewMode) => void;
}

interface EditorProps {
  content: string;
  filePath: string | null;
  focusMode?: boolean;
  isUnsaved?: boolean;
  onCloseUnsaved?: () => boolean;
  onContentChange: (content: string) => void;
  onSave?: () => void;
}

const slashCommands = [
  {
    label: "Table",
    icon: Table,
    snippet: "| Column | Column |\n| --- | --- |\n| Value | Value |",
  },
  {
    label: "Checklist",
    icon: ListTodo,
    snippet: "- [ ] First task\n- [ ] Second task",
  },
  {
    label: "Code block",
    icon: TerminalSquare,
    snippet: "```ts\n\n```",
  },
  {
    label: "Quote",
    icon: Quote,
    snippet: "> Quote",
  },
  {
    label: "Callout",
    icon: Quote,
    snippet: "> [!NOTE]\n> Important detail",
  },
  {
    label: "Mermaid",
    icon: TerminalSquare,
    snippet: "```mermaid\ngraph TD\n  A[Start] --> B[Next]\n```",
  },
];

function applyMonacoTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  if (!window.MonacoEnvironment) {
    return;
  }

  monaco.editor.setTheme(isDark ? "vs-dark" : "vs");
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { filePath, content, onContentChange, onSave, isUnsaved, focusMode = false },
  ref
) {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [localContent, setLocalContent] = useState(content);
  const [splitWidth, setSplitWidth] = useState<number | null>(null);
  const [searchRequested, setSearchRequested] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<MonacoEditor | null>(null);
  const onContentChangeRef = useRef(onContentChange);
  const viewModeRef = useRef<ViewMode>(viewMode);

  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  }, [onContentChange]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  useEffect(() => {
    if (!(filePath && editorHostRef.current)) {
      return;
    }

    applyMonacoTheme();

    const model = monaco.editor.createModel(content, "markdown");
    const editor = monaco.editor.create(editorHostRef.current, {
      automaticLayout: true,
      fontFamily: "var(--font-mono)",
      fontSize: 14,
      lineHeight: 22,
      lineNumbers: "on",
      minimap: { enabled: false },
      model,
      language: "markdown",
      colorDecorators: true,
      wordWrap: "on",
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      padding: { top: 0, bottom: 0 },
      tabSize: 2,
    });

    const disposable = model.onDidChangeContent(() => {
      const value = model.getValue();
      setLocalContent(value);
      onContentChangeRef.current(value);

      const editorPosition = editor.getPosition();
      if (!editorPosition) {
        return;
      }

      const line = model.getLineContent(editorPosition.lineNumber);
      const previousChar = line.charAt(editorPosition.column - 2);
      setSlashOpen(previousChar === "/");
      setSlashIndex(0);
    });

    editorRef.current = editor;

    const observer = new MutationObserver(() => {
      applyMonacoTheme();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
      disposable.dispose();
      editor.dispose();
      model.dispose();
      editorRef.current = null;
    };
  }, [filePath]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const model = editor.getModel();
    if (!model) {
      return;
    }

    const current = model.getValue();
    if (current === content) {
      return;
    }

    model.setValue(content);
  }, [content]);

  useEffect(() => {
    if (!searchRequested || viewMode === "preview") {
      return;
    }

    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
    editor.getAction("actions.find")?.run();
    setSearchRequested(false);
  }, [searchRequested, viewMode]);

  const exportAs = async (format: "pdf" | "docx" | "html") => {
    if (!filePath) {
      return;
    }
    const fileName = filePath.split("/").pop()?.replace(".md", "") || "export";

    if (format === "pdf") {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const lines = content.split("\n");
      let y = 20;
      lines.forEach((line) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 20, y);
        y += 7;
      });
      doc.save(`${fileName}.pdf`);
    } else if (format === "docx") {
      const { Document, Packer, Paragraph, TextRun } = await import("docx");
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: content.split("\n").map(
              (line) =>
                new Paragraph({
                  children: [new TextRun(line || " ")],
                })
            ),
          },
        ],
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${fileName}.docx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } else if (format === "html") {
      const { remark } = (await import("remark")) as typeof import("remark");
      const { default: remarkHtml } = await import("remark-html");
      const processor = remark();
      const html = await processor.use(remarkHtml).process(content);
      const blob = new Blob([`<html><body>${String(html)}</body></html>`], {
        type: "text/html",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${fileName}.html`;
      anchor.click();
      URL.revokeObjectURL(url);
    }
  };

  const openSearch = () => {
    if (viewModeRef.current === "preview") {
      setSearchRequested(true);
      setViewMode("split");
      return;
    }

    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
    editor.getAction("actions.find")?.run();
  };

  const insertSnippet = (snippet: string) => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    const position = editor?.getPosition();
    if (!(editor && model && position)) {
      return;
    }

    const line = model.getLineContent(position.lineNumber);
    const replaceSlash = line.charAt(position.column - 2) === "/";
    const range = new monaco.Range(
      position.lineNumber,
      replaceSlash ? position.column - 1 : position.column,
      position.lineNumber,
      position.column
    );

    editor.executeEdits("insert-snippet", [{ range, text: snippet }]);
    editor.focus();
    setSlashOpen(false);
  };

  useImperativeHandle(ref, () => ({
    exportAs,
    focus: () => editorRef.current?.focus(),
    insertSnippet,
    openSearch,
    setViewMode,
  }));

  const markdownOptions = useMemo(
    () => ({
      overrides: {
        a: {
          component: ({
            href,
            children,
            ...props
          }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
            <a
              {...props}
              href={href}
              onClick={(event) => {
                if (!href) {
                  return;
                }
                event.preventDefault();
                window.electronAPI?.shell.openPathOrUrl(href);
              }}
            >
              {children}
            </a>
          ),
        },
      },
    }),
    []
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    editor.addAction({
      id: "custom-find",
      label: "Custom Find",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF],
      run: () => openSearch(),
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!slashOpen) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setSlashOpen(false);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSlashIndex((current) => (current + 1) % slashCommands.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSlashIndex(
          (current) =>
            (current - 1 + slashCommands.length) % slashCommands.length
        );
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insertSnippet(slashCommands[slashIndex].snippet);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [slashIndex, slashOpen]);

  if (!filePath) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-muted-foreground/80">
        <div className="text-center">
          <div className="mb-2 text-sm uppercase tracking-[0.3em] opacity-40">
            Note
          </div>
          <p className="text-[13px]">Select a file or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-full min-h-0 flex-1 flex-col ${focusMode ? "mx-auto max-w-5xl border-x bg-background/96 shadow-sm" : ""}`}
    >
      <div
        className={`flex h-10 items-center justify-between border-b px-2 py-2.5 ${focusMode ? "bg-background/80" : ""}`}
      >
        <div className="flex items-center gap-2 font-medium text-[13px] text-foreground/80">
          {filePath.split("/").pop()}
          {isUnsaved && <div className="h-2 w-2 rounded-full bg-gray-500" />}
        </div>

        <div className="flex items-center">
          <div className="flex gap-0 rounded-full border p-0.5">
            <Tooltip>
              <TooltipTrigger>
                <Button
                  className="h-7 w-7 rounded-full"
                  onClick={() => setViewMode("edit")}
                  size="icon-sm"
                  variant={viewMode === "edit" ? "outline" : "ghost"}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  className="h-7 w-7 rounded-full"
                  onClick={() => setViewMode("split")}
                  size="icon-sm"
                  variant={viewMode === "split" ? "outline" : "ghost"}
                >
                  <Columns className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Split</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  className="h-7 w-7 rounded-full"
                  onClick={() => setViewMode("preview")}
                  size="icon-sm"
                  variant={viewMode === "preview" ? "outline" : "ghost"}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Preview</TooltipContent>
            </Tooltip>
          </div>

          <Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="ml-1 h-7 w-7"
                  size="icon-sm"
                  variant="outline"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => exportAs("pdf")}>
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportAs("docx")}>
                  Export as DOCX
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportAs("html")}>
                  Export as HTML
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <TooltipContent>Export</TooltipContent>
          </Tooltip>

          {onSave && (
            <Tooltip>
              <TooltipTrigger>
                <Button
                  className="ml-1 h-7 w-7"
                  onClick={onSave}
                  size="icon-sm"
                  variant="outline"
                >
                  <Save className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          className={`h-full min-h-0 w-full overflow-hidden ${
            viewMode === "split" ? "border-border/70 border-r" : ""
          }`}
          ref={editorHostRef}
          style={{
            width:
              viewMode === "preview"
                ? 0
                : viewMode === "split"
                  ? (splitWidth ?? "50%")
                  : "100%",
            visibility: viewMode === "preview" ? "hidden" : "visible",
          }}
        />

        {(viewMode === "preview" || viewMode === "split") && (
          <div
            className="h-full overflow-auto px-6"
            id="preview-pane"
            style={{
              width:
                viewMode === "split"
                  ? splitWidth
                    ? `calc(100% - ${splitWidth}px)`
                    : "50%"
                  : "100%",
            }}
          >
            <div className="markdown-preview max-w-none">
              <Markdown options={markdownOptions}>
                {localContent || "*Nothing to preview*"}
              </Markdown>
            </div>
          </div>
        )}

        {slashOpen && viewMode !== "preview" && (
          <div className="absolute top-8 left-8 z-30 w-56 overflow-hidden rounded-lg border border-border/80 bg-popover shadow-lg">
            {slashCommands.map((command, index) => {
              const Icon = command.icon;
              return (
                <button
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] ${
                    slashIndex === index
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/70"
                  }`}
                  key={command.label}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insertSnippet(command.snippet);
                  }}
                  type="button"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {command.label}
                </button>
              );
            })}
          </div>
        )}

        {viewMode === "split" && (
          <div
            id="splitter"
            onMouseDown={(event) => {
              const startX = event.clientX;
              const startWidth =
                editorHostRef.current?.getBoundingClientRect().width || 0;
              const onMouseMove = (moveEvent: MouseEvent) => {
                const dx = moveEvent.clientX - startX;
                const newWidth = Math.max(200, startWidth + dx);
                setSplitWidth(newWidth);
              };
              const onMouseUp = () => {
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
              };
              document.addEventListener("mousemove", onMouseMove);
              document.addEventListener("mouseup", onMouseUp);
            }}
            style={{
              width: 6,
              cursor: "col-resize",
              position: "absolute",
              left: splitWidth ?? "50%",
              top: 0,
              bottom: 0,
              transform: "translateX(-3px)",
            }}
          />
        )}
      </div>
    </div>
  );
});
