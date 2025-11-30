"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Results } from "@/components/ui/results";
import { getResults, getRun, listWordlists, startRun, stopRun, uploadWordlist } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { RunResponse, RunResults, RunStatus, Wordlist } from "@/lib/types";
import { useMemoizedFn } from "@/lib/hooks";

type StatusMeta = { label: string; variant: "neutral" | "info" | "success" | "danger" };

const statusMap: Record<RunStatus, StatusMeta> = {
  pending: { label: "等待中", variant: "neutral" },
  running: { label: "运行中", variant: "info" },
  succeeded: { label: "已完成", variant: "success" },
  failed: { label: "失败", variant: "danger" },
  canceled: { label: "已停止", variant: "danger" },
};

export function SubdomainPanel() {
  const [wordlists, setWordlists] = useState<Wordlist[]>([]);
  const [selectedWordlist, setSelectedWordlist] = useState<string>("");
  const [defaultWordlist, setDefaultWordlistState] = useState<Wordlist | null>(null);
  const [domain, setDomain] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [results, setResults] = useState<RunResults | null>(null);
  const [logs, setLogs] = useState("等待启动枚举任务...");
  const [loadingRun, setLoadingRun] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const statusMeta: StatusMeta | null = run ? statusMap[run.status] : null;
  const isRunActive = run?.status === "running" || run?.status === "pending";
  const progressPercent =
    run?.progress_percent ??
    (run?.progress_total && run.progress_total > 0
      ? Math.min(Math.round(((run.progress_processed ?? 0) / run.progress_total) * 100), 100)
      : null);

  const sortedWordlists = useMemo(
    () => [...wordlists].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [wordlists],
  );

  const activeWordlistName = selectedWordlist && wordlists.find((w) => w.id === Number(selectedWordlist))?.name;

  const refreshWordlists = useMemoizedFn(async () => {
    try {
      const data = await listWordlists();
      setWordlists(data);
      const defaultWordlist = data.find((w) => w.is_default);
      setDefaultWordlistState(defaultWordlist || null);
      if (!selectedWordlist && defaultWordlist) {
        setSelectedWordlist(defaultWordlist.id.toString());
      }
    } catch (err) {
      setError((err as Error).message);
    }
  });

  const handleStartRun = useMemoizedFn(async () => {
    if (!domain.trim()) {
      setError("请输入有效的域名");
      return;
    }

    setError(null);
    setResults(null);
    setLogs("准备启动枚举任务...");
    setLoadingRun(true);

    try {
      const payload = {
        domain: domain.trim().toLowerCase(),
        wordlist_id: selectedWordlist ? Number(selectedWordlist) : undefined,
      };
      const created = await startRun(payload);
      setRun(created);
      setLogs(created.log_snippet || "启动成功，开始执行...");
      poll(created.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingRun(false);
    }
  });

  const handleUploadSubmit = useMemoizedFn(async (formData: FormData) => {
    setError(null);
    setUploading(true);

    try {
      const wordlistName = (formData.get("wordlistName") as string) || undefined;
      const wordlistFile = formData.get("wordlistFile") as File;
      const isDefault = (formData.get("wordlistDefault") as string) === "on";

      await uploadWordlist({
        name: wordlistName,
        file: wordlistFile,
        is_default: isDefault,
      });

      await refreshWordlists();
      setShowUploadModal(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  });

  const poll = useMemoizedFn((runId: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const current = await getRun(runId);
        setRun(current);
        setLogs(current.log_snippet || "执行中...");
        if (current.status === "running" || current.status === "succeeded" || current.status === "failed") {
          setLoadingResults(current.status === "running");
          const data = await getResults(runId);
          setResults(data);
        }
        if (current.status === "succeeded" || current.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setLoadingResults(false);
        }
      } catch (err) {
        if (pollRef.current) clearInterval(pollRef.current);
        setError((err as Error).message);
        setLoadingResults(false);
      }
    }, 2500);
  });

  useEffect(() => {
    void refreshWordlists();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshWordlists]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-200 font-semibold uppercase tracking-[0.18em]">
            Subdomain Recon
          </span>
          <span>自动化验证 · 更快、更稳</span>
        </div>

        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-slate-50 tracking-tight">子域名枚举控制台</h1>
        </div>
      </header>

      {error && (
        <Card className="mb-6 border-red-500/40 bg-red-500/10">
          <Card.Header>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_0_4px_rgba(239,68,68,0.1)]">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <span className="text-red-200 font-semibold">执行错误</span>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="text-red-200">{error}</div>
          </Card.Content>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="h-fit">
          <Card.Header>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Target & Wordlist</p>
                <h3 className="text-lg font-semibold text-slate-50">目标与字典配置</h3>
              </div>
            </div>
          </Card.Header>

          <Card.Content className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-[0.14em]">目标域名</label>
                <div className="relative">
                  <Input
                    placeholder="example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-[0.14em]">二级域名字典</label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Select
                      value={selectedWordlist}
                      onChange={(e) => setSelectedWordlist(e.target.value)}
                      className="w-full"
                    >
                      <option value="">使用默认字典</option>
                      {sortedWordlists.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} {w.is_default ? "(默认)" : ""}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setShowUploadModal(true)}>
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 5v14" strokeWidth="1.8" strokeLinecap="round" />
                        <path d="M5 12h14" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                      添加新字典
                    </span>
                  </Button>
                </div>
                {defaultWordlist && (
                  <div className="text-[11px] text-slate-500 mt-1">
                    默认字典：{defaultWordlist.name}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-lg border border-border/60 bg-[var(--surface-strong)] px-4 py-3 text-xs text-slate-400">
              <div className="flex flex-col gap-1 md:max-w-[60%]">
                <span>建议：控制字典体积在 1-2MB，确保实时反馈。</span>
                <span className="text-slate-500">域名会自动转为小写并去除前后空格。</span>
              </div>
              <Button
                onClick={handleStartRun}
                loading={loadingRun || isRunActive}
                loadingText="枚举中..."
                disabled={!domain.trim() || loadingRun || stopping || isRunActive}
                className="min-w-36 shadow-[0_10px_40px_-24px_rgba(56,189,248,0.7)] md:self-end"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12l5 5L20 7" />
                  </svg>
                  开始枚举
                </span>
              </Button>
            </div>
          </Card.Content>
        </Card>

        <Card className="h-fit">
          <Card.Header>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Run Monitor</p>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-slate-50">执行状态</h3>
                  {run && (
                    <span className="text-xs px-2 py-1 rounded-md bg-[var(--surface-strong)] border border-border/60 text-slate-300">
                      任务 #{run.id}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                {statusMeta && (
                  <Badge variant={statusMeta.variant} className="px-3 py-1">
                    <span className="flex items-center gap-2">{statusMeta.label}</span>
                  </Badge>
                )}
                {run?.status === "running" && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      if (!run) return;
                      setStopping(true);
                      try {
                        const stopped = await stopRun(run.id);
                        setRun(stopped);
                        setLogs((prev) => `${prev}\n⏹ 已请求停止`);
                      } catch (err) {
                        setError((err as Error).message);
                      } finally {
                        setStopping(false);
                      }
                    }}
                    disabled={stopping}
                  >
                    {stopping ? "停止中..." : "停止任务"}
                  </Button>
                )}
              </div>
            </div>
          </Card.Header>

          <Card.Content className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">进度</span>
                  <span className="text-xs text-slate-400">
                    {progressPercent !== null && progressPercent !== undefined ? `${progressPercent}%` : "—"}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${progressPercent ?? 0}%` }}
                  />
                </div>
              </div>

              {run && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-200">开始时间</span>
                    <span className="text-sm text-slate-400">
                      {run.started_at ? formatDateTime(run.started_at) : "-"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-200">完成时间</span>
                    <span className="text-sm text-slate-400">
                      {run.finished_at ? formatDateTime(run.finished_at) : "-"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4">
              <h4 className="text-sm font-medium text-slate-200 mb-2">实时日志</h4>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowLogs((s) => !s)}
                className="text-slate-300 hover:text-white"
              >
                {showLogs ? "折叠日志" : "展开日志"}
              </Button>
            </div>

            {showLogs && (
              <div className="bg-[#0c1118] border border-border/80 rounded-lg p-4 font-mono text-sm text-slate-200 max-h-96 overflow-auto shadow-[0_20px_60px_-48px_rgba(0,0,0,0.8)]">
                <pre className="whitespace-pre-wrap">{logs || "暂无日志信息"}</pre>
              </div>
            )}
          </Card.Content>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Results results={results} run={run} loading={loadingResults} error={error} />
      </div>

      <Modal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="上传二级域名字典"
        description="支持 .txt 格式，最大 10MB"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void handleUploadSubmit(fd);
          }}
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">自定义名称（可选）</label>
            <Input name="wordlistName" placeholder="我的专业字典" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">选择文件</label>
            <Input type="file" name="wordlistFile" accept=".txt,text/plain" />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="wordlistDefault"
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="wordlistDefault" className="ml-2 text-sm text-slate-700">
              设为默认字典
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowUploadModal(false)}>
              取消
            </Button>
            <Button type="submit" loading={uploading}>
              {uploading ? "上传中..." : "确认上传"}
            </Button>
          </div>

          {defaultWordlist && (
            <div className="text-xs text-slate-500 mt-2">
              当前默认：{defaultWordlist.name}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
