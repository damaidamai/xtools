'use client';

import { IconX } from "@tabler/icons-react";
import { useWorkspaceTabs } from "@/lib/workspace-tabs";

export function WorkspaceTabBar() {
  const { tabs, activeKey, setActive, closeTab } = useWorkspaceTabs();

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-[var(--surface-strong)] px-2 py-2">
      <div className="flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          const Icon = tab.icon;
          return (
            <div
              key={tab.key}
              className={`group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? "bg-[var(--surface)] text-foreground border border-primary/40 shadow-subtle"
                  : "text-muted border border-transparent hover:border-border/60 hover:text-foreground"
              }`}
            >
              <button
                className="flex items-center gap-2 outline-none"
                onClick={() => setActive(tab.key)}
              >
                {Icon && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-md border border-border/60 bg-[var(--surface)]">
                    <Icon size={14} className={isActive ? "text-primary" : "text-muted"} stroke={1.6} />
                  </span>
                )}
                <span className="font-medium">{tab.title}</span>
              </button>
              {tab.closable && (
                <button
                  className={`rounded-sm p-[2px] transition-colors ${
                    isActive ? "text-muted hover:text-foreground" : "text-muted hover:text-foreground"
                  }`}
                  onClick={() => closeTab(tab.key)}
                  aria-label={`关闭 ${tab.title}`}
                >
                  <IconX size={14} stroke={1.6} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
