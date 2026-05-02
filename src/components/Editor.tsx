import { useEffect, useRef, useState } from "react";
import { Columns, Download, Eye, Pencil, Search } from "lucide-react";
import Markdown from "markdown-to-jsx";
import { basicSetup, EditorView } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { openSearchPanel } from "@codemirror/search";
import { EditorState } from "@codemirror/state";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ViewMode = "edit" | "preview" | "split";

interface EditorProps {
  filePath: string | null;
  content: string;
  onContentChange: (content: string) => void;
}

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "transparent",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.75",
  },
  ".cm-content": {
    padding: "16px",
    caretColor: "hsl(var(--foreground))",
  },
  ".cm-line": {
    paddingLeft: "2px",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "hsl(var(--muted-foreground))",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "hsl(var(--muted) / 0.55)",
  },
  ".cm-activeLine": {
    backgroundColor: "hsl(var(--muted) / 0.28)",
  },
  ".cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "hsl(var(--accent) / 0.42) !important",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "hsl(var(--foreground))",
  },
  ".cm-matchingBracket, .cm-nonmatchingBracket": {
    backgroundColor: "hsl(var(--accent) / 0.34)",
    outline: "none",
  },
  ".cm-searchMatch": {
    backgroundColor: "hsl(var(--chart-1) / 0.22)",
    outline: "1px solid hsl(var(--chart-1) / 0.35)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "hsl(var(--chart-1) / 0.42)",
  },
  ".cm-tooltip, .cm-panel": {
    backgroundColor: "hsl(var(--popover))",
    color: "hsl(var(--popover-foreground))",
    border: "1px solid hsl(var(--border))",
    boxShadow: "0 18px 40px hsl(var(--foreground) / 0.08)",
  },
  ".cm-panel input, .cm-panel button": {
    fontFamily: "var(--font-sans)",
  },
  ".cm-placeholder": {
    color: "hsl(var(--muted-foreground))",
    paddingLeft: "2px",
  },
});

export function Editor({ filePath, content, onContentChange }: EditorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [localContent, setLocalContent] = useState(content);
  const [splitWidth, setSplitWidth] = useState<number | null>(null);
  const [searchRequested, setSearchRequested] = useState(false);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
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
    if (!filePath || !editorHostRef.current || editorViewRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        markdown({ codeLanguages: languages }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        editorTheme,
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          const value = update.state.doc.toString();
          setLocalContent(value);
          onContentChangeRef.current(value);
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorHostRef.current,
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
  }, [filePath]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;

    const current = view.state.doc.toString();
    if (current === content) return;

    view.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: content,
      },
    });
  }, [content]);

  useEffect(() => {
    if (!searchRequested || viewMode === "preview") return;

    const view = editorViewRef.current;
    if (!view) return;

    openSearchPanel(view);
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

    const view = editorViewRef.current;
    if (!view) return;

    openSearchPanel(view);
  };

  if (!filePath) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground/80">
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
    <div className="flex h-full flex-1 flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="truncate text-[13px] font-medium text-foreground/80">
          {filePath.split("/").pop()}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={openSearch}
          >
            <Search className="h-3.5 w-3.5" />
          </Button>

          <div className="flex gap-1 rounded-full bg-muted/50 p-0.5">
            <Button
              variant={viewMode === "edit" ? "secondary" : "ghost"}
              size="icon-sm"
              className="h-7 w-7 rounded-full"
              onClick={() => setViewMode("edit")}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "split" ? "secondary" : "ghost"}
              size="icon-sm"
              className="h-7 w-7 rounded-full"
              onClick={() => setViewMode("split")}
            >
              <Columns className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "preview" ? "secondary" : "ghost"}
              size="icon-sm"
              className="h-7 w-7 rounded-full"
              onClick={() => setViewMode("preview")}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="ml-1 h-7 w-7">
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
        </div>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <div
          ref={editorHostRef}
          className={`h-full min-h-0 overflow-hidden ${
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
            className="overflow-auto p-6"
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
