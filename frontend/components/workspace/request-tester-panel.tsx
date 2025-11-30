"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { IconChevronDown, IconLoader2, IconMaximize, IconMinimize } from "@tabler/icons-react";
import { formatDateTime } from "@/lib/format";
import { listProxies, runRequestTest } from "@/lib/api";
import { useMemoizedFn } from "@/lib/hooks";
import { Proxy, RequestTestResult } from "@/lib/types";

const SAMPLE_CURL =
  `curl -X GET https://httpbin.org/get \\\n  -H "Accept: application/json"`;

export function RequestTesterPanel() {
  const [curlText, setCurlText] = useState(SAMPLE_CURL);
  const [count, setCount] = useState(1);
  const [proxyId, setProxyId] = useState<string>("");
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RequestTestResult[]>([]);
  const [requestedAt, setRequestedAt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<"sequential" | "parallel">("sequential");
  const [fullscreen, setFullscreen] = useState(false);

  const refreshProxies = useMemoizedFn(async () => {
    try {
      const data = await listProxies();
      setProxies(data);
    } catch (err) {
      setError((err as Error).message);
    }
  });

  useEffect(() => {
    void refreshProxies();
  }, [refreshProxies]);

  const handleSubmit = useMemoizedFn(async () => {
    if (!curlText.trim()) {
      setError("请输入 curl 命令");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await runRequestTest({
        curl: curlText,
        count,
        proxy_id: proxyId ? Number(proxyId) : undefined,
        mode,
      });
      setResults(response.results);
      setRequestedAt(formatDateTime(new Date()));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  });

  const selectedProxy = useMemo(
    () => proxies.find((p) => p.id === Number(proxyId)),
    [proxyId, proxies],
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="text-muted text-sm">请求测试</div>
          <h1 className="text-2xl font-bold tracking-tight font-tech text-primary">请求测试</h1>
          <div className="text-xs text-muted">粘贴 curl，设置次数与代理，快速发起多次请求并查看返回。</div>
        </div>
        <Button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2">
          {loading && <IconLoader2 size={16} className="animate-spin" />}
          发起请求
        </Button>
      </header>

      {error && <Card className="border border-destructive/40 bg-destructive/15 text-red-200">{error}</Card>}

      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted">curl 命令（可编辑）</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex items-center gap-1"
                onClick={() => setFullscreen(true)}
              >
                <IconMaximize size={14} />
                全屏编辑
              </Button>
            </div>
            <textarea
              value={curlText}
              onChange={(e) => setCurlText(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-border/80 bg-[var(--surface-strong)] px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              placeholder="粘贴 curl 命令..."
            />
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-muted">请求次数（1-5）</label>
              <Input
                type="number"
                min={1}
                max={5}
                value={count}
                onChange={(e) => setCount(Math.min(5, Math.max(1, Number(e.target.value))))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">执行模式</label>
              <div className="flex gap-2">
                {(["sequential", "parallel"] as const).map((opt) => (
                  <Button
                    key={opt}
                    type="button"
                    size="sm"
                    variant={mode === opt ? "primary" : "ghost"}
                    onClick={() => setMode(opt)}
                  >
                    {opt === "sequential" ? "顺序" : "并发"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">代理（可选）</label>
              <select
                value={proxyId}
                onChange={(e) => setProxyId(e.target.value)}
                className="rounded-lg border border-border/80 bg-[var(--surface-strong)] px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              >
                <option value="">直连</option>
                {proxies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type})
                  </option>
                ))}
              </select>
              {selectedProxy && !selectedProxy.enabled && (
                <span className="text-xs text-amber-300">该代理已禁用，将无法使用。</span>
              )}
            </div>
            {requestedAt && <div className="text-xs text-muted">上次执行：{requestedAt}</div>}
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted">返回结果 {results.length ? `（${results.length} 条）` : ""}</div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-1"
          >
            {loading && <IconLoader2 size={14} className="animate-spin" />}
            重新请求
          </Button>
        </div>
        {results.length === 0 ? (
          <div className="text-sm text-muted">暂无结果，先发起一次请求。</div>
        ) : (
          <div className="space-y-3">
            {results.map((item) => (
              <Card key={item.index} className="border border-border/70 bg-[var(--surface-strong)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={item.error ? "danger" : item.status && item.status < 400 ? "success" : "neutral"}>
                      #{item.index}
                    </Badge>
                    <span className="text-sm font-mono text-primary">{item.method || "?"}</span>
                    <span className="text-sm text-foreground">{item.url}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.index)) {
                          next.delete(item.index);
                        } else {
                          next.add(item.index);
                        }
                        return next;
                      });
                    }}
                    className="flex items-center gap-1"
                  >
                    {expanded.has(item.index) ? "收起详情" : "展开详情"}
                    <IconChevronDown
                      size={14}
                      className={`transition-transform ${expanded.has(item.index) ? "rotate-180" : ""}`}
                    />
                  </Button>
                </div>
                <div className="space-y-2 px-3 py-3">
                  {item.error ? (
                    <div className="text-sm text-red-200">错误：{item.error}</div>
                  ) : (
                    <>
                      <div className="text-xs text-muted">Response Body</div>
                      <pre className="overflow-auto rounded-lg bg-[var(--surface)] p-3 text-xs text-foreground">
                        {item.body || "<empty>"}
                      </pre>
                      {item.headers && (
                        <div className="space-y-2">
                          <div className="text-xs text-muted">Headers</div>
                          <Table>
                            <THead>
                              <TR>
                                <TH>Key</TH>
                                <TH>Value</TH>
                              </TR>
                            </THead>
                            <TBody>
                              {Object.entries(item.headers).map(([k, v]) => (
                                <TR key={k}>
                                  <TD className="text-xs font-mono">{k}</TD>
                                  <TD className="text-xs text-muted">{v}</TD>
                                </TR>
                              ))}
                            </TBody>
                          </Table>
                        </div>
                      )}
                      {item.cookies && (
                        <div className="space-y-2">
                          <div className="text-xs text-muted">Cookies</div>
                          <Table>
                            <THead>
                              <TR>
                                <TH>Name</TH>
                                <TH>Value</TH>
                              </TR>
                            </THead>
                            <TBody>
                              {item.cookies.map((ck) => (
                                <TR key={ck.name}>
                                  <TD className="text-xs font-mono">{ck.name}</TD>
                                  <TD className="text-xs text-muted">{ck.value}</TD>
                                </TR>
                              ))}
                            </TBody>
                          </Table>
                        </div>
                      )}
                      {item.timings_ms && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted">Timings (ms)</div>
                          <div className="flex gap-2 text-xs text-muted">
                            <span>DNS: {item.timings_ms.dns ?? "-"}</span>
                            <span>TCP: {item.timings_ms.tcp ?? "-"}</span>
                            <span>TLS: {item.timings_ms.tls ?? "-"}</span>
                            <span>Transfer: {item.timings_ms.transfer ?? "-"}</span>
                          </div>
                        </div>
                      )}
                      {item.raw && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted">Raw</div>
                          <pre className="overflow-auto rounded-lg bg-[var(--surface)] p-3 text-xs text-muted">
                            {item.raw}
                          </pre>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {fullscreen && (
        <FullscreenEditor value={curlText} onChange={setCurlText} onClose={() => setFullscreen(false)} />
      )}
    </div>
  );
}

function FullscreenEditor({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 p-4 backdrop-blur-sm">
      <Card className="flex h-full flex-col gap-3 border border-border/70 bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="text-sm text-muted">全屏编辑 curl 命令</div>
          <Button type="button" variant="ghost" className="flex items-center gap-1" onClick={onClose}>
            <IconMinimize size={14} />
            退出全屏
          </Button>
        </div>
        <div className="flex-1 px-4 pb-4">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-full w-full rounded-lg border border-border/80 bg-[var(--surface-strong)] px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </Card>
    </div>
  );
}
