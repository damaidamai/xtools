'use client';

import { ReactNode } from "react";
import { IconGauge, IconSettings } from "@tabler/icons-react";
import { WORKSPACE_NAV_ITEMS, type WorkspaceNavItem, useWorkspaceTabs } from "@/lib/workspace-tabs";

type NavEntry =
  | WorkspaceNavItem
  | {
      key?: never;
      label: string;
      icon: typeof IconGauge;
      disabled?: boolean;
    };

const NAV_SECTIONS: Array<{ title: string; items: NavEntry[] }> = [
  {
    title: "工作区",
    items: WORKSPACE_NAV_ITEMS,
  },
  {
    title: "系统设置",
    items: [
      { label: "态势总览（预留）", icon: IconGauge, disabled: true },
      { label: "配置（预留）", icon: IconSettings, disabled: true },
    ],
  },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const { activeKey, openTab } = useWorkspaceTabs();

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-[var(--bg)]">
      <aside className="flex flex-col gap-4 border-r border-border/70 bg-[var(--surface-strong)] px-4 py-6">
        <div className="flex flex-col gap-1">
          <div className="font-tech text-sm text-primary">xtools</div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full glow-dot" />
            <span className="text-xs text-muted tracking-[0.12em]">control · console</span>
          </div>
        </div>
        <nav className="flex flex-col gap-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-2">
              <div className="px-2 text-[11px] uppercase tracking-[0.18em] text-muted">{section.title}</div>
              {section.items.map((item) => {
                const isActive = "key" in item && item.key ? activeKey === item.key : false;
                return (
                  <NavItem
                    key={item.label}
                    item={item}
                    active={isActive}
                    onSelect={item.key ? () => openTab(item.key) : undefined}
                  />
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex flex-col gap-4 p-6">{children}</main>
    </div>
  );
}

function NavItem({ item, active, onSelect }: { item: NavEntry; active: boolean; onSelect?: () => void }) {
  const Icon = item.icon;
  const content = (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
        active
          ? "border-primary/30 bg-surface text-foreground shadow-subtle"
          : "border-transparent text-muted hover:border-border/60 hover:text-foreground hover:bg-[var(--surface-strong)]"
      } ${item.disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--surface-strong)] border border-border/60">
        <Icon size={16} stroke={1.6} className={active ? "text-primary" : "text-muted"} />
      </span>
      <span>{item.label}</span>
    </div>
  );

  if (item.disabled) {
    return content;
  }

  return (
    <button type="button" className="block text-left" onClick={onSelect}>
      {content}
    </button>
  );
}
