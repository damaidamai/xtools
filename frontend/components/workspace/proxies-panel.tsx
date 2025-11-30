"use client";

import { useEffect, useMemo, useState } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { createProxy, deleteProxy, listProxies, testProxy, updateProxy } from "@/lib/api";
import { useMemoizedFn } from "@/lib/hooks";
import { Proxy, ProxyType } from "@/lib/types";

type ProxyForm = {
  name: string;
  type: ProxyType;
  host: string;
  port: number;
  username: string;
  password: string;
  note: string;
  enabled: boolean;
};

const PROXY_TYPES: Array<{ value: ProxyType; label: string }> = [
  { value: "http", label: "HTTP" },
  { value: "https", label: "HTTPS" },
  { value: "socks5", label: "SOCKS5" },
];

const emptyForm: ProxyForm = {
  name: "",
  type: "http",
  host: "",
  port: 8080,
  username: "",
  password: "",
  note: "",
  enabled: true,
};

export function ProxiesPanel() {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Proxy | null>(null);
  const [form, setForm] = useState<ProxyForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<Record<number, string>>({});

  const refreshProxies = useMemoizedFn(async () => {
    setLoading(true);
    try {
      const items = await listProxies();
      setProxies(items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void refreshProxies();
  }, [refreshProxies]);

  const sortedProxies = useMemo(
    () => [...proxies].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [proxies],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (proxy: Proxy) => {
    setEditing(proxy);
    setForm({
      name: proxy.name,
      type: proxy.type,
      host: proxy.host,
      port: proxy.port,
      username: proxy.username || "",
      password: proxy.password || "",
      note: proxy.note || "",
      enabled: proxy.enabled,
    });
    setModalOpen(true);
  };

  const handleSubmit = useMemoizedFn(async () => {
    if (!form.name.trim() || !form.host.trim()) {
      setError("名称和主机不能为空");
      return;
    }
    if (!form.port || form.port < 1 || form.port > 65535) {
      setError("端口需在 1-65535 之间");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateProxy(editing.id, {
          name: form.name.trim(),
          type: form.type,
          host: form.host.trim(),
          port: Number(form.port),
          username: form.username || null,
          password: form.password,
          note: form.note || null,
          enabled: form.enabled,
        });
      } else {
        await createProxy({
          name: form.name.trim(),
          type: form.type,
          host: form.host.trim(),
          port: Number(form.port),
          username: form.username || undefined,
          password: form.password || undefined,
          note: form.note || undefined,
          enabled: form.enabled,
        });
      }
      await refreshProxies();
      setModalOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  });

  const handleToggleEnabled = useMemoizedFn(async (proxy: Proxy) => {
    try {
      await updateProxy(proxy.id, { enabled: !proxy.enabled });
      await refreshProxies();
    } catch (err) {
      setError((err as Error).message);
    }
  });

  const handleDelete = useMemoizedFn(async (id: number) => {
    setDeletingId(id);
    try {
      await deleteProxy(id);
      await refreshProxies();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  });

  const handleTest = useMemoizedFn(async (id: number) => {
    setTestingId(id);
    try {
      const res = await testProxy(id);
      if (res.ok) {
        const latency = res.latency_ms ? `${res.latency_ms} ms` : "ok";
        setTestResult((prev) => ({ ...prev, [id]: `连通成功 (${latency})` }));
      } else {
        setTestResult((prev) => ({ ...prev, [id]: `连通失败：${res.error || "未知错误"}` }));
      }
    } catch (err) {
      setTestResult((prev) => ({ ...prev, [id]: `连通失败：${(err as Error).message}` }));
    } finally {
      setTestingId(null);
    }
  });

  return (
    <div className="flex flex-col gap-4">
        <header className="flex items-center justify-between gap-3">
          <div>
            <div className="text-muted text-sm">代理管理</div>
            <h1 className="text-2xl font-bold tracking-tight font-tech text-primary">代理管理</h1>
            <div className="text-xs text-muted">
              维护可复用的代理，支持启用/停用、编辑与连通性测试。
            </div>
          </div>
          <Button onClick={openCreate}>+ 添加代理</Button>
        </header>

        {error && (
          <Card className="border border-destructive/40 bg-destructive/15 text-red-200">{error}</Card>
        )}

        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted">
              代理数量：{proxies.length} · 默认按创建时间倒序
            </div>
          </div>
          <div className="overflow-auto">
            <Table>
              <THead>
                <TR>
                  <TH>名称</TH>
                  <TH>类型</TH>
                  <TH>地址</TH>
                  <TH>认证</TH>
                  <TH>状态</TH>
                  <TH>备注</TH>
                  <TH>最近测试</TH>
                  <TH>创建时间</TH>
                  <TH>操作</TH>
                </TR>
              </THead>
              <TBody>
                {sortedProxies.length ? (
                  sortedProxies.map((item) => (
                    <TR key={item.id}>
                      <TD className="font-semibold">{item.name}</TD>
                      <TD className="text-xs uppercase text-muted">{item.type}</TD>
                      <TD className="text-xs text-muted">
                        {item.host}:{item.port}
                      </TD>
                      <TD className="text-xs text-muted">
                        {item.username ? `${item.username}${item.password ? " / ******" : ""}` : "-"}
                      </TD>
                      <TD>
                        {item.enabled ? (
                          <Badge variant="success">启用</Badge>
                        ) : (
                          <Badge variant="neutral">停用</Badge>
                        )}
                      </TD>
                      <TD className="text-xs text-muted max-w-[180px] truncate">
                        {item.note || "-"}
                      </TD>
                      <TD className="text-xs text-muted max-w-[200px] truncate">
                        {testResult[item.id] ?? "-"}
                      </TD>
                      <TD className="text-xs text-muted">
                        {formatDateTime(item.created_at)}
                      </TD>
                      <TD className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={testingId === item.id}
                          onClick={() => void handleTest(item.id)}
                          className="flex items-center gap-1"
                        >
                          {testingId === item.id && <IconLoader2 size={14} className="animate-spin" />}
                          测试
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                          编辑
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleToggleEnabled(item)}
                        >
                          {item.enabled ? "禁用" : "启用"}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={deletingId === item.id}
                          onClick={() => void handleDelete(item.id)}
                        >
                          删除
                        </Button>
                      </TD>
                    </TR>
                  ))
                ) : (
                  <TR>
                    <TD colSpan={8} className="text-sm text-muted">
                      {loading ? "加载中…" : "暂无代理，点击上方添加。"}
                    </TD>
                  </TR>
                )}
              </TBody>
            </Table>
          </div>
        </Card>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editing ? "编辑代理" : "添加代理"}
          description="配置代理字段"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                取消
              </Button>
              <Button onClick={() => void handleSubmit()} loading={saving}>
                保存
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted mb-1">名称</div>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="例如：默认代理"
                />
              </div>
              <div>
                <div className="text-xs text-muted mb-1">类型</div>
                <Select
                  value={form.type}
                  onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as ProxyType }))}
                >
                  {PROXY_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-[2fr_1fr] gap-3">
              <div>
                <div className="text-xs text-muted mb-1">主机</div>
                <Input
                  value={form.host}
                  onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))}
                  placeholder="127.0.0.1"
                />
              </div>
              <div>
                <div className="text-xs text-muted mb-1">端口</div>
                <Input
                  type="number"
                  min={1}
                  max={65535}
                  value={form.port}
                  onChange={(e) => setForm((prev) => ({ ...prev, port: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted mb-1">用户名</div>
                <Input
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="可选"
                />
              </div>
              <div>
                <div className="text-xs text-muted mb-1">密码（明文）</div>
                <Input
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="可选"
                />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">备注</div>
              <textarea
                value={form.note}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                className="min-h-[72px] w-full rounded-lg border border-border/80 bg-[var(--surface-strong)] px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted"
                placeholder="用途或限制说明（可选）"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="h-4 w-4"
              />
              启用
            </label>
          </div>
        </Modal>
      </div>
  );
}
