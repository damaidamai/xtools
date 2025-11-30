'use client';

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function HomePanel() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Badge variant="secondary" className="bg-blue-500/10 text-blue-200 border-blue-500/30">
          XTools Control
        </Badge>
        <h1 className="text-3xl font-semibold text-slate-50 tracking-tight">快速、安全的攻防工作台</h1>
        <p className="text-muted text-sm leading-relaxed">
          在同一窗口管理子域枚举、字典、代理与请求测试。保持 Minimal Dark 控制室体验，专注执行与反馈。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border border-border/70 bg-[var(--surface-strong)] p-4">
          <h3 className="text-lg font-semibold text-foreground">工作区标签</h3>
          <p className="text-sm text-muted">
            左侧菜单点击即可打开或切换标签，多任务并行，状态不会因为切换而丢失。
          </p>
        </Card>
        <Card className="border border-border/70 bg-[var(--surface-strong)] p-4">
          <h3 className="text-lg font-semibold text-foreground">深色高密度界面</h3>
          <p className="text-sm text-muted">
            统一深色主题与红蓝语义色，保持卡片扁平与细边框，信息集中、反馈直接。
          </p>
        </Card>
      </div>
    </div>
  );
}
