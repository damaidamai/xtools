'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getResults, getRun, listWordlists, setDefaultWordlist, startRun, uploadWordlist } from "@/lib/api";
import { RunResponse, RunResults, RunStatus, Wordlist } from "@/lib/types";
import { useMemoizedFn } from "@/lib/hooks";

type StatusMeta = { label: string; variant: "neutral" | "info" | "success" | "danger" };

const statusMap: Record<RunStatus, StatusMeta> = {
  pending: { label: "Pending", variant: "neutral" },
  running: { label: "Running", variant: "info" },
  succeeded: { label: "Succeeded", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
};

export default function Page() {
  const [wordlists, setWordlists] = useState<Wordlist[]>([]);
  const [selectedWordlist, setSelectedWordlist] = useState<string>("");
  const [defaultWordlist, setDefaultWordlistState] = useState<Wordlist | null>(null);
  const [domain, setDomain] = useState("");
  const [run, setRun] = useState<RunResponse | null>(null);
  const [results, setResults] = useState<RunResults | null>(null);
  const [logs, setLogs] = useState("No logs yet.");
  const [loadingRun, setLoadingRun] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(true);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const statusMeta: StatusMeta | null = run ? statusMap[run.status] : null;

  const sortedWordlists = useMemo(
    () => [...wordlists].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [wordlists],
  );

  useEffect(() => {
    void refreshWordlists();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const refreshWordlists = useMemoizedFn(async () => {
    try {
      const items = await listWordlists();
      setWordlists(items);
      const def = items.find((i) => i.is_default) || null;
      setDefaultWordlistState(def);
    } catch (err) {
      console.error(err);
    }
  });

  const handleUpload = useMemoizedFn(async (form: HTMLFormElement) => {
    const fileInput = form.elements.namedItem("wordlistFile") as HTMLInputElement;
    const nameInput = form.elements.namedItem("wordlistName") as HTMLInputElement;
    const defaultInput = form.elements.namedItem("wordlistDefault") as HTMLInputElement;
    if (!fileInput.files?.length) {
      setError("请选择字典文件");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const file = fileInput.files[0];
      await uploadWordlist({
        file,
        name: nameInput.value || undefined,
        is_default: defaultInput.checked,
      });
      fileInput.value = "";
      nameInput.value = "";
      defaultInput.checked = false;
      await refreshWordlists();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  });

  const handleSetDefault = useMemoizedFn(async (id: number) => {
    try {
      await setDefaultWordlist(id);
      await refreshWordlists();
    } catch (err) {
      setError((err as Error).message);
    }
  });

  const handleStartRun = useMemoizedFn(async () => {
    if (!domain) {
      setError("请输入域名");
      return;
    }
    setError(null);
    setLoadingRun(true);
    setResults(null);
    try {
      const payload = {
        domain,
        wordlist_id: selectedWordlist ? Number(selectedWordlist) : null,
      };
      const created = await startRun(payload);
      setRun(created);
      setLogs(created.log_snippet || "Starting...");
      poll(created.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingRun(false);
    }
  });

  const poll = (runId: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const current = await getRun(runId);
        setRun(current);
        setLogs(current.log_snippet || "");
        if (current.status === "succeeded" || current.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          const data = await getResults(runId);
          setResults(data);
        }
      } catch (err) {
        if (pollRef.current) clearInterval(pollRef.current);
        setError((err as Error).message);
      }
    }, 2500);
  };

  const humanSize = (size: number) => `${(size / 1024).toFixed(1)} KB`;

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-[var(--bg)]">
      <aside className="flex flex-col gap-4 border-r border-border bg-[#0d111a] px-4 py-6">
        <div className="flex flex-col gap-1">
          <div className="font-tech text-sm text-[#6cb2ff]">xtools</div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full glow-dot" />
            <span className="text-xs text-muted tracking-[0.12em]">control · console</span>
          </div>
        </div>
        <nav className="flex flex-col gap-2">
          <NavItem active label="子域枚举" />
          <NavItem label="态势总览（预留）" />
          <NavItem label="配置（预留）" />
        </nav>
      </aside>

      <main className="flex flex-col gap-4 p-6">
        <header className="flex items-center justify-between gap-3">
          <div>
            <div className="text-muted text-sm">资产发现 · 指导流程</div>
            <h1 className="text-2xl font-bold tracking-tight font-tech text-[#6cb2ff]">
              子域名枚举
            </h1>
            <div className="mt-1 text-xs text-muted">
              Step 1: 管理字典 · Step 2: 输入域名 · Step 3: 启动枚举
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Card className="min-w-[220px] bg-[#111624]">
              <div className="text-muted text-xs">运行摘要</div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-xs text-muted">状态</div>
                {statusMeta ? (
                  <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                ) : (
                  <span className="text-muted text-sm">-</span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>默认字典</span>
                <span className="text-foreground text-sm">
                  {defaultWordlist ? defaultWordlist.name : "未设置"}
                </span>
              </div>
            </Card>
          </div>
        </header>

        {error && (
          <Card className="border border-destructive/40 bg-[#1a0f0f] text-red-200">
            {error}
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">任务配置</div>
              <div className="text-xs text-muted">Step 2 · 输入域名 & 字典</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-muted">目标域名</label>
                <Input
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm text-muted">字典</label>
                <Select
                  value={selectedWordlist}
                  onChange={(e) => setSelectedWordlist(e.target.value)}
                >
                  <option value="">默认字典</option>
                  {sortedWordlists.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.is_default ? "(默认)" : ""}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted">
                提示：若未设置默认字典，请在右侧上传并设为默认后再启动。
              </div>
              <Button onClick={handleStartRun} loading={loadingRun}>
                启动枚举
              </Button>
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">字典管理</h3>
              <div className="text-xs text-muted">Step 1 · 上传或选择默认</div>
            </div>
            <form
              className="grid gap-3 md:grid-cols-[1fr_auto_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                void handleUpload(e.currentTarget);
              }}
            >
              <Input name="wordlistName" placeholder="custom.txt (可选)" />
              <Input type="file" name="wordlistFile" accept=".txt,text/plain" />
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" name="wordlistDefault" className="h-4 w-4" /> 设为默认
              </label>
              <div className="md:col-span-3">
                <Button type="submit" loading={uploading}>
                  上传字典
                </Button>
              </div>
            </form>
            <div className="space-y-2">
              {sortedWordlists.length === 0 && (
                <Card className="border-dashed border-border/60 bg-[#0f1320] text-sm text-muted">
                  暂无字典，请先上传。
                </Card>
              )}
              {sortedWordlists.map((w) => (
                <Card key={w.id} className="flex items-center justify-between border-border/60 bg-[#161c29]">
                  <div>
                    <div className="text-sm font-semibold">{w.name}</div>
                    <div className="text-xs text-muted">
                      {humanSize(w.size_bytes)} • {w.is_default ? "默认" : "可用"}
                    </div>
                  </div>
                  {!w.is_default && (
                    <Button size="sm" variant="ghost" onClick={() => void handleSetDefault(w.id)}>
                      设为默认
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-muted text-xs">任务 ID</div>
                <div className="text-sm">{run ? run.id : "-"}</div>
              </div>
              <div className="text-right">
                <div className="text-muted text-xs">状态</div>
                <div className="text-sm">{run ? statusMap[run.status].label : "-"}</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-muted text-xs">日志</div>
              <Button size="sm" variant="ghost" onClick={() => setShowLogs((s) => !s)}>
                {showLogs ? "折叠" : "展开"}
              </Button>
            </div>
            {showLogs && (
              <pre className="max-h-60 overflow-auto rounded-lg border border-border bg-black/50 p-3 text-xs text-muted">
                {logs || "暂无日志"}
              </pre>
            )}
          </Card>
        </div>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-muted text-sm">结果</div>
            <div className="text-xs text-muted">
              {results ? `更新时间：${new Date().toLocaleTimeString()}` : ""}
            </div>
          </div>
          <div className="overflow-auto">
            <Table>
              <THead>
                <TR>
                  <TH>子域名</TH>
                  <TH>来源</TH>
                  <TH>发现时间</TH>
                </TR>
              </THead>
              <TBody>
                {results?.results?.length ? (
                  results.results.map((item) => (
                    <TR key={item.host}>
                      <TD>{item.host}</TD>
                      <TD className="text-muted">{item.source || "-"}</TD>
                      <TD className="text-muted text-xs">{item.discovered_at}</TD>
                    </TR>
                  ))
                ) : (
                  <TR>
                    <TD colSpan={3} className="text-muted text-sm">
                      {run ? "等待结果…" : "暂无数据，请先启动枚举"}
                    </TD>
                  </TR>
                )}
              </TBody>
            </Table>
          </div>
        </Card>
      </main>
    </div>
  );
}

function NavItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
        active
          ? "border-border bg-[#181818] text-foreground shadow-subtle"
          : "border-transparent text-muted hover:border-border hover:text-foreground"
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-border" />
      <span>{label}</span>
    </div>
  );
}
