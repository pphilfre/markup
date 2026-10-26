"use client";
import { useState } from "react";
import { Columns3, List } from "lucide-react";
import { KanbanView } from "@/components/shell/kanban";
import { useEditorStore } from "@/lib/store";
import { TaskView } from "./task-view";
export function BoardDocument() {
  const [view, setView] = useState<"board" | "list">("board");
  const id = useEditorStore((s) => s.activeTabId);
  return (
    <div className="flex flex-1 min-w-0 min-h-0 flex-col overflow-hidden">
      <div className="px-5 py-2 border-b border-border">
        <div className="view-switch w-fit">
          <button
            aria-pressed={view === "board"}
            onClick={() => setView("board")}
          >
            <Columns3 size={14} />
            Board
          </button>
          <button
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List size={14} />
            List
          </button>
        </div>
      </div>
      {view === "board" ? (
        <KanbanView />
      ) : id ? (
        <div className="p-5 overflow-y-auto">
          <TaskView boardId={id} listOnly />
        </div>
      ) : null}
    </div>
  );
}
