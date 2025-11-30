"use client";

import { useEffect } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { WorkspaceTabBar } from "@/components/workspace/tab-bar";
import { HomePanel } from "@/components/workspace/home-panel";
import { SubdomainPanel } from "@/components/workspace/subdomain-panel";
import { WordlistsPanel } from "@/components/workspace/wordlists-panel";
import { ProxiesPanel } from "@/components/workspace/proxies-panel";
import { RequestTesterPanel } from "@/components/workspace/request-tester-panel";
import { type WorkspaceTabKey, useWorkspaceTabs } from "@/lib/workspace-tabs";

const PANEL_COMPONENTS: Record<WorkspaceTabKey, () => JSX.Element> = {
  home: HomePanel,
  subdomain: SubdomainPanel,
  wordlists: WordlistsPanel,
  proxies: ProxiesPanel,
  "request-tester": RequestTesterPanel,
};

export function Workspace({ initialTabKey }: { initialTabKey?: WorkspaceTabKey }) {
  const { tabs, activeKey, openTab, ensureHome } = useWorkspaceTabs();

  useEffect(() => {
    ensureHome();
    if (initialTabKey) {
      openTab(initialTabKey);
    }
  }, [initialTabKey, ensureHome, openTab]);

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4">
        <WorkspaceTabBar />
        <div className="relative">
          {tabs.map((tab) => {
            const Component = PANEL_COMPONENTS[tab.key];
            if (!Component) return null;
            return (
              <div key={tab.key} className={tab.key === activeKey ? "block" : "hidden"}>
                <Component />
              </div>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
