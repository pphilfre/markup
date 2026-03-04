"use client";

import { useState } from "react";
import {
  FileText,
  List,
  ListOrdered,
  Heading,
  Quote,
  Code2,
  Link,
  Image,
  Table,
  CheckSquare,
  Bold,
  Italic,
  Strikethrough,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useEditorStore } from "@/lib/store";

/** Small inline kbd badge for keybind hints */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="pointer-events-none ml-2 inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  );
}

export function Sidebar() {
  const insertLinePrefix = useEditorStore((s) => s.insertLinePrefix);
  const insertSnippet = useEditorStore((s) => s.insertSnippet);
  const wrapSelection = useEditorStore((s) => s.wrapSelection);
  const [headingOpen, setHeadingOpen] = useState(false);

  return (
    <aside className="flex h-full w-12 flex-col items-center border-r border-border bg-card py-2">
      {/* App icon */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="mb-1 h-8 w-8">
            <FileText className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Markup</TooltipContent>
      </Tooltip>

      <Separator className="my-1 w-6" />

      {/* Quick-insert tools */}
      <div className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto py-1">
        {/* Bold */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => wrapSelection("**", "**")}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Bold className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center">
            Bold <Kbd>Ctrl+B</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Italic */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => wrapSelection("*", "*")}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Italic className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center">
            Italic <Kbd>Ctrl+I</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Strikethrough */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => wrapSelection("~~", "~~")}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Strikethrough className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center">
            Strikethrough <Kbd>Alt+X</Kbd>
          </TooltipContent>
        </Tooltip>

        <Separator className="my-0.5 w-6" />

        {/* Heading dropdown */}
        <DropdownMenu open={headingOpen} onOpenChange={setHeadingOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <Heading className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="flex items-center">
              Heading <Kbd>Alt+H</Kbd>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" align="start" className="min-w-[120px]">
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <DropdownMenuItem
                key={level}
                onClick={() => insertLinePrefix("#".repeat(level) + " ")}
                className="gap-2"
              >
                <span className="font-semibold" style={{ fontSize: `${1.3 - level * 0.1}em` }}>
                  H{level}
                </span>
                <span className="text-muted-foreground text-xs ml-auto">{"#".repeat(level)}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Bullet List */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => insertLinePrefix("- ")}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <List className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center">
            Bullet List <Kbd>Alt+U</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Numbered List */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => insertLinePrefix("1. ")}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center">
            Numbered List <Kbd>Alt+O</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Task List */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => insertLinePrefix("- [ ] ")}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <CheckSquare className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center">
            Task List <Kbd>Alt+C</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Blockquote */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => insertLinePrefix("> ")}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Quote className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center">
            Blockquote <Kbd>Alt+Q</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Code Block */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => insertSnippet("```\n$SEL\n```")}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Code2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center">
            Code Block <Kbd>Alt+`</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Link */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => insertSnippet("[$SEL](url)")}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Link className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center">
            Link <Kbd>Alt+N</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Image */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => insertSnippet("![alt]($SEL)")}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Image className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center">
            Image <Kbd>Alt+I</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Table */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => insertSnippet("| Header | Header |\n| ------ | ------ |\n| Cell   | Cell   |")}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Table className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center">
            Table <Kbd>Alt+T+B</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Bottom: Settings button */}
      <Separator className="my-1 w-6" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => document.dispatchEvent(new CustomEvent("open-settings"))}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center">
          Settings <Kbd>Alt+S</Kbd>
        </TooltipContent>
      </Tooltip>
    </aside>
  );
}
