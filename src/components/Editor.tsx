import { useEffect, useRef, useState } from "react";
import { Columns, Download, Eye, Pencil, Save, Search } from "lucide-react";
import Markdown from "markdown-to-jsx";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import "monaco-editor/min/vs/editor/editor.main.css";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker.js?worker";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

interface EditorProps {
  filePath: string | null;
  content: string;
  onContentChange: (content: string) => void;
  onSave?: () => void;
  isUnsaved?: boolean;
  onCloseUnsaved?: () => boolean;
}

function applyMonacoTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  if (!window.MonacoEnvironment) {
    return;
  }

  monaco.editor.setTheme(isDark ? "vs-dark" : "vs");
}

export function Editor({ filePath, content, onContentChange, onSave, isUnsaved, onCloseUnsaved }: EditorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [localContent, setLocalContent] = useState(content);
  const [splitWidth, setSplitWidth] = useState<number | null>(null);
  const [searchRequested, setSearchRequested] = useState(false);
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
    if (!filePath || !editorHostRef.current) return;

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
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    const current = model.getValue();
    if (current === content) return;

    model.setValue(content);
  }, [content]);

  useEffect(() => {
    if (!searchRequested || viewMode === "preview") return;

    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    editor.getAction("actions.find")?.run();
    setSearchRequested(false);
  }, [searchRequested, viewMode]);

  const exportAs = async (format: "pdf" | "docx" | "html") => {
    if (!filePath) return;
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
                }),
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
    if (!editor) return;

    editor.focus();
    editor.getAction("find")?.run();
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.addAction({
      id: "custom-find",
      label: "Custom Find",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF],
      run: () => openSearch(),
    });
  }, []);

  if (!filePath) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground/80 h-full">
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
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b h-10 px-2 py-2.5">
        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/80">
          {filePath.split("/").pop()}
          {isUnsaved && <div className="bg-gray-500 h-2 w-2 rounded-full" />}
        </div>

        <div className="flex items-center">
          <div className="flex gap-0 rounded-full border p-0.5">
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant={viewMode === "edit" ? "outline" : "ghost"}
                  size="icon-sm"
                  className="h-7 w-7 rounded-full"
                  onClick={() => setViewMode("edit")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant={viewMode === "split" ? "outline" : "ghost"}
                  size="icon-sm"
                  className="h-7 w-7 rounded-full"
                  onClick={() => setViewMode("split")}
                >
                  <Columns className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Split</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant={viewMode === "preview" ? "outline" : "ghost"}
                  size="icon-sm"
                  className="h-7 w-7 rounded-full"
                  onClick={() => setViewMode("preview")}
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
                <Button variant="outline" size="icon-sm" className="ml-1 h-7 w-7">
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
                  variant="outline"
                  size="icon-sm"
                  className="ml-1 h-7 w-7"
                  onClick={onSave}
                >
                  <Save className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <div
          ref={editorHostRef}
          className={`h-full min-h-0 w-full overflow-hidden ${
            viewMode === "split" ? "border-r border-border/70" : ""
          }`}
          style={{
            width:
              viewMode === "preview"
                ? 0
                : viewMode === "split"
                  ? splitWidth ?? "50%"
                  : "100%",
            visibility: viewMode === "preview" ? "hidden" : "visible",
          }}
        />

        {(viewMode === "preview" || viewMode === "split") && (
          <div
            id="preview-pane"
            style={{
              width:
                viewMode === "split"
                  ? splitWidth
                    ? `calc(100% - ${splitWidth}px)`
                    : "50%"
                  : "100%",
            }}
            className="h-full overflow-auto px-6"
          >
            <div className="markdown-preview max-w-none">
              <Markdown>{localContent || "*Nothing to preview*"}</Markdown>
            </div>
          </div>
        )}

        {viewMode === "split" && (
          <div
            id="splitter"
            style={{
              width: 6,
              cursor: "col-resize",
              position: "absolute",
              left: splitWidth ?? "50%",
              top: 0,
              bottom: 0,
              transform: "translateX(-3px)",
            }}
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
          />
        )}
      </div>
    </div>
  );
}
