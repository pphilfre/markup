"use client";
import {
  Bold,
  Italic,
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
  const tools = [
    { label: "Bold", Icon: Bold, action: () => wrap("**", "**") },
    { label: "Italic", Icon: Italic, action: () => wrap("*", "*") },
    {
      label: "Strikethrough",
      Icon: Strikethrough,
      action: () => wrap("~~", "~~"),
    },
  ];
  return (
    <div className="editor-control-strip" aria-label="Formatting tools">
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            title="Heading level"
            aria-label="Heading level"
            onMouseDown={(e) => e.preventDefault()}
          >
            <Heading size={18} />
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            title="Lists"
            aria-label="Lists"
            onMouseDown={(e) => e.preventDefault()}
          >
            <List size={17} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => prefix("- ")}>
            <List size={15} />
            Bullet list
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => prefix("1. ")}>
            <ListOrdered size={15} />
            Numbered list
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => prefix("- [ ] ")}>
            <CheckSquare size={15} />
            Checklist
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
