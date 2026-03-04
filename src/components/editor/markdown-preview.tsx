"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useEditorStore } from "@/lib/store";

export function MarkdownPreview({
  id,
  onScroll,
}: {
  id?: string;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
} = {}) {
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  if (!activeTab) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-sm">No tab open</p>
      </div>
    );
  }

  if (!activeTab.content.trim()) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-sm">Nothing to preview</p>
      </div>
    );
  }

  return (
    <div id={id} onScroll={onScroll} className="flex-1 overflow-auto">
      <article className="markdown-body mx-auto max-w-3xl px-8 py-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {activeTab.content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
