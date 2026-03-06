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
  LogIn,
  LogOut,
  User,
  Shield,
  Monitor,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useEditorStore } from "@/lib/store";
import { useAuthState } from "@/components/convex-client-provider";
import { UserAccountPanel } from "@/components/shell/user-account-panel";


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
  const { isAuthenticated, user, isLoading: authLoading } = useAuthState();
  const sidebarWidth = useEditorStore((s) => s.settings.sidebarWidth);
  const compactMode = useEditorStore((s) => s.settings.compactMode);
  const showIcons = useEditorStore((s) => s.settings.showIconsInSidebar);
  const sidebarPosition = useEditorStore((s) => s.settings.sidebarPosition);

  const btnSize = compactMode ? "h-7 w-7" : "h-8 w-8";
  const iconSize = compactMode ? "h-3.5 w-3.5" : "h-4 w-4";
  const tooltipSide = sidebarPosition === "right" ? "left" : "right";

  return (
    <aside
      className="flex h-full flex-col items-center border-r border-border bg-card py-2"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* App icon */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className={`mb-1 ${btnSize}`}>
            <FileText className={iconSize} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>Markup</TooltipContent>
      </Tooltip>

      <Separator className="my-1 w-6" />

      {/* Quick-insert tools */}
      {showIcons && (
      <div className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto py-1">
        {/* Bold */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => wrapSelection("**", "**")}
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <Bold className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
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
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <Italic className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
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
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <Strikethrough className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
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
                  className={`${btnSize} text-muted-foreground hover:text-foreground`}
                >
                  <Heading className={iconSize} />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side={tooltipSide} className="flex items-center">
              Heading <Kbd>Alt+H</Kbd>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent side={tooltipSide} align="start" className="min-w-[120px]">
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
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <List className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
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
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <ListOrdered className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
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
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <CheckSquare className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
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
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <Quote className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
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
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <Code2 className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
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
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <Link className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
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
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <Image className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
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
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <Table className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
            Table <Kbd>Alt+T+B</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>
      )}
      {!showIcons && <div className="flex-1" />}

      {/* Bottom: Auth + Settings */}
      <Separator className="my-1 w-6" />

      {/* Auth button */}
      {!authLoading && (
        <Tooltip>
          <TooltipTrigger asChild>
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${btnSize} text-muted-foreground hover:text-foreground`}
                  >
                    {user?.profilePictureUrl ? (
                      <img
                        src={user.profilePictureUrl}
                        alt=""
                        className="h-5 w-5 rounded-full"
                      />
                    ) : (
                      <User className={iconSize} />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side={tooltipSide} align="end">
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-medium">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => document.dispatchEvent(new CustomEvent("open-user-account", { detail: "profile" }))}>
                    <User className="mr-2 h-3.5 w-3.5" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => document.dispatchEvent(new CustomEvent("open-user-account", { detail: "sessions" }))}>
                    <Monitor className="mr-2 h-3.5 w-3.5" /> Sessions
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => document.dispatchEvent(new CustomEvent("open-user-account", { detail: "security" }))}>
                    <Shield className="mr-2 h-3.5 w-3.5" /> Security
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/api/auth/signout" className="flex w-full items-center gap-2">
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <a href="/api/auth/signin">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`${btnSize} text-muted-foreground hover:text-foreground`}
                >
                  <LogIn className={iconSize} />
                </Button>
              </a>
            )}
          </TooltipTrigger>
          <TooltipContent side={tooltipSide}>
            {isAuthenticated ? `${user?.email}` : "Sign in to sync"}
          </TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => document.dispatchEvent(new CustomEvent("open-settings"))}
            className={`${btnSize} text-muted-foreground hover:text-foreground`}
          >
            <Settings className={iconSize} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} className="flex items-center">
          Settings <Kbd>Alt+S</Kbd>
        </TooltipContent>
      </Tooltip>

      <UserAccountPanel />
    </aside>
  );
}
