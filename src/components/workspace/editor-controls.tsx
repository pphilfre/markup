"use client";
import {
  Bold,
  Italic,
  Underline,
  Superscript,
  Subscript,
  Undo2,
  Redo2,
  ChevronDown,
  Strikethrough,
  Heading,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code2,
  Link,
  Image as ImageIcon,
  Table,
  MoreHorizontal,
  CheckCheck,
} from "lucide-react";
import { redo, undo } from "@codemirror/commands";
import { useEditorStore } from "@/lib/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function EditorControls() {
  const wrap = useEditorStore((s) => s.wrapSelection),
    prefix = useEditorStore((s) => s.insertLinePrefix),
    snippet = useEditorStore((s) => s.insertSnippet);
  const view = useEditorStore((s) => s.editorView);
  const tools = [
    { label: "Bold", Icon: Bold, action: () => wrap("**", "**") },
    { label: "Italic", Icon: Italic, action: () => wrap("*", "*") },
    { label: "Underline", Icon: Underline, action: () => wrap("<u>", "</u>") },
    {
      label: "Strikethrough",
      Icon: Strikethrough,
      action: () => wrap("~~", "~~"),
    },
  ];
  return (
    <div className="editor-control-strip" role="group" aria-label="Formatting tools">
      {view && (
        <>
          <button title="Undo" aria-label="Undo" onMouseDown={(event) => event.preventDefault()} onClick={() => { undo(view); view.focus(); }}><Undo2 size={16} /></button>
          <button title="Redo" aria-label="Redo" onMouseDown={(event) => event.preventDefault()} onClick={() => { redo(view); view.focus(); }}><Redo2 size={16} /></button>
          <span className="editor-control-divider" aria-hidden />
        </>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            title="Heading level"
            aria-label="Heading level"
            className="editor-heading-control"
            onMouseDown={(e) => e.preventDefault()}
          >
            <Heading size={15} /><span>Heading</span><ChevronDown size={11} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => prefix("")}>Paragraph</DropdownMenuItem>
          {[1, 2, 3, 4, 5, 6].map((level) => (
            <DropdownMenuItem
              key={level}
              onSelect={() => prefix("#".repeat(level) + " ")}
            >
              <span className="w-7 font-medium">H{level}</span>Heading {level}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {tools.map(({ label, Icon, action }) => (
        <button
          key={label}
          title={label}
          aria-label={label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={action}
        >
          <Icon size={16} />
        </button>
      ))}
      <span className="editor-control-divider" aria-hidden />
      <button title="Bullet list" aria-label="Bullet list" onMouseDown={(event) => event.preventDefault()} onClick={() => prefix("- ")}><List size={16} /></button>
      <button title="Numbered list" aria-label="Numbered list" onMouseDown={(event) => event.preventDefault()} onClick={() => prefix("1. ")}><ListOrdered size={16} /></button>
      <button title="Checklist" aria-label="Checklist" onMouseDown={(event) => event.preventDefault()} onClick={() => prefix("- [ ] ")}><CheckSquare size={16} /></button>
      <button
        title="Blockquote"
        aria-label="Blockquote"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => prefix("> ")}
      >
        <Quote size={16} />
      </button>
      <button
        title="Code block"
        aria-label="Code block"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => snippet("```\n$SEL\n```")}
      >
        <Code2 size={17} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            title="Insert link"
            aria-label="Insert link"
            onMouseDown={(e) => e.preventDefault()}
          >
            <Link size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onSelect={() =>
              document.dispatchEvent(new CustomEvent("open-link-picker"))
            }
          >
            Link a document
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => snippet("[$SEL](https://)")}>
            Web link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button title="Superscript" aria-label="Superscript" onMouseDown={(event) => event.preventDefault()} onClick={() => wrap("^", "^")}><Superscript size={16} /></button>
      <button title="Subscript" aria-label="Subscript" onMouseDown={(event) => event.preventDefault()} onClick={() => wrap("~", "~")}><Subscript size={16} /></button>
      <span className="editor-control-divider" aria-hidden />
      <button
        title="Image"
        aria-label="Image"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => snippet("![$SEL](https://)")}
      >
        <ImageIcon size={16} />
      </button>
      <button
        title="Table"
        aria-label="Table"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() =>
          snippet("| Heading | Heading |\n| --- | --- |\n| Cell | Cell |\n")
        }
      >
        <Table size={16} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            title="More insert options"
            aria-label="More insert options"
            onMouseDown={(e) => e.preventDefault()}
          >
            <MoreHorizontal size={17} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => snippet("\n---\n")}>
            Horizontal rule
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => wrap("$", "$ ")}>
            Inline maths
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => snippet("$$\n$SEL\n$$")}>
            Maths block
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => wrap("==", "==")}>
            Highlight
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => useEditorStore.getState().createTaskFromSelection()}
          >
            <CheckCheck size={15} />
            New linked task
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        className="editor-new-task"
        title="Create a task from selection, or add a new task"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => useEditorStore.getState().createTaskFromSelection()}
      >
        <CheckCheck size={16} />
        <span>Task</span>
      </button>
    </div>
  );
}
