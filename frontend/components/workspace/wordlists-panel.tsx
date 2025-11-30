"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import {
  dedupeWordlist,
  deleteWordlist,
  getWordlist,
  listWordlists,
  setDefaultWordlist,
  updateWordlist,
  uploadWordlist,
} from "@/lib/api";
import { useMemoizedFn } from "@/lib/hooks";
import { Wordlist, WordlistDetail, WordlistType } from "@/lib/types";

const WORDLIST_TYPES: Array<{ value: WordlistType; label: string; hint: string }> = [
  { value: "subdomain", label: "二级域名", hint: "用于子域名枚举" },
  { value: "username", label: "用户名", hint: "用于账号枚举/爆破" },
  { value: "password", label: "密码", hint: "用于弱口令/碰撞" },
];

export function WordlistsPanel() {
  const [wordlists, setWordlists] = useState<Wordlist[]>([]);
  const [defaultWordlist, setDefaultWordlistState] = useState<Wordlist | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editorWordlist, setEditorWordlist] = useState<WordlistDetail | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorName, setEditorName] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorStatus, setEditorStatus] = useState<string | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deduping, setDeduping] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshWordlists = useMemoizedFn(async () => {
    setLoading(true);
    try {
      const items = await listWordlists();
      setWordlists(items);
      setDefaultWordlistState(items.find((i) => i.is_default) || null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void refreshWordlists();
  }, [refreshWordlists]);

  const sortedWordlists = useMemo(
    () => [...wordlists].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [wordlists],
  );

  const countNonEmptyLines = (content: string) =>
    content.split(/\r?\n/).filter((line) => line.trim() !== "").length;
  const editorLineCount = useMemo(() => countNonEmptyLines(editorContent), [editorContent]);

  const handleSetDefault = useMemoizedFn(async (id: number) => {
    try {
      await setDefaultWordlist(id);
      await refreshWordlists();
    } catch (err) {
      setError((err as Error).message);
    }
  });

  const handleUploadSubmit = useMemoizedFn(async (formData: FormData) => {
    const fileInput = formData.get("wordlistFile") as File | null;
    const nameInput = (formData.get("wordlistName") as string) || undefined;
    const defaultInput = formData.get("wordlistDefault") === "on";
    const typeInput = (formData.get("wordlistType") as WordlistType) || "subdomain";
    if (!fileInput) {
      setError("请选择字典文件");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      await uploadWordlist({
        file: fileInput,
        name: nameInput || undefined,
        is_default: defaultInput,
        type: typeInput,
      });
      await refreshWordlists();
      setShowUploadModal(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  });

  const handleOpenEditor = useMemoizedFn(async (id: number) => {
    setShowEditorModal(true);
    setEditorWordlist(null);
    setEditorLoading(true);
    setEditorError(null);
    setEditorStatus(null);
    setEditorContent("");
    setEditorName("");
    try {
      const detail = await getWordlist(id);
      setEditorWordlist(detail);
      setEditorContent(detail.content);
      setEditorName(detail.name);
    } catch (err) {
      setEditorError((err as Error).message);
    } finally {
      setEditorLoading(false);
    }
  });

  const handleCloseEditor = useMemoizedFn(() => {
    setShowEditorModal(false);
    setEditorWordlist(null);
    setEditorContent("");
    setEditorName("");
    setEditorError(null);
    setEditorStatus(null);
  });

  const handleSaveEditor = useMemoizedFn(async () => {
    if (!editorWordlist) return;
    setSaving(true);
    setEditorError(null);
    setEditorStatus(null);
    try {
      const updated = await updateWordlist(editorWordlist.id, {
        content: editorContent,
        name: editorName,
      });
      setEditorWordlist(updated);
      setEditorContent(updated.content);
      setEditorName(updated.name);
      setEditorStatus("已保存");
      await refreshWordlists();
    } catch (err) {
      setEditorError((err as Error).message);
    } finally {
      setSaving(false);
    }
  });

  const handleDedupeEditor = useMemoizedFn(async () => {
    if (!editorWordlist) return;
    setDeduping(true);
    setEditorError(null);
    setEditorStatus(null);
    try {
      const deduped = await dedupeWordlist(editorWordlist.id, { content: editorContent });
      setEditorWordlist(deduped);
      setEditorContent(deduped.content);
      setEditorName(deduped.name);
      setEditorStatus(`已去重：移除 ${deduped.removed_lines} 行`);
      await refreshWordlists();
    } catch (err) {
      setEditorError((err as Error).message);
    } finally {
      setDeduping(false);
    }
  });

  const humanSize = (size: number) => `${(size / 1024).toFixed(1)} KB`;
  const renderTypePill = (type: WordlistType) => {
    const color =
      type === "subdomain"
        ? "bg-blue-500/15 text-blue-200 border-blue-500/40"
        : type === "username"
          ? "bg-amber-500/15 text-amber-200 border-amber-500/40"
          : "bg-emerald-500/15 text-emerald-200 border-emerald-500/40";
    const label = WORDLIST_TYPES.find((t) => t.value === type)?.label ?? type;
    return (
      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-mono ${color}`}>
        {label}
      </span>
    );
  };

  const handleDelete = useMemoizedFn(async (id: number, name: string) => {
    if (!window.confirm(`确定删除字典【${name}】？文件将同时删除，默认字典删除后将不再存在。`)) return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteWordlist(id);
      await refreshWordlists();
      if (editorWordlist?.id === id) {
        handleCloseEditor();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="text-muted text-sm">字典管理</div>
          <h1 className="text-2xl font-bold tracking-tight font-tech text-primary">字典管理</h1>
          <div className="text-xs text-muted">按类型维护默认字典，供各功能调用。</div>
        </div>
        <Button onClick={() => setShowUploadModal(true)}>+ 添加字典</Button>
      </header>

      {error && <Card className="border border-destructive/40 bg-destructive/15 text-red-200">{error}</Card>}

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted">数量：{wordlists.length}</div>
        </div>
        <div className="overflow-auto">
          <Table>
            <THead>
              <TR>
                <TH>名称</TH>
                <TH>类型</TH>
                <TH>大小</TH>
                <TH>默认</TH>
                <TH>创建时间</TH>
                <TH>操作</TH>
              </TR>
            </THead>
            <TBody>
              {sortedWordlists.length ? (
                sortedWordlists.map((item) => (
                  <TR key={item.id}>
                    <TD className="font-semibold">{item.name}</TD>
                    <TD>{renderTypePill(item.type)}</TD>
                    <TD className="text-muted text-xs">{humanSize(item.size_bytes)}</TD>
                    <TD>
                      {item.is_default ? <Badge variant="success">默认</Badge> : <span className="text-muted text-xs">-</span>}
                    </TD>
                    <TD className="text-muted text-xs">{formatDateTime(item.created_at)}</TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => void handleOpenEditor(item.id)}>
                          编辑
                        </Button>
                        {!item.is_default && (
                          <Button size="sm" variant="ghost" onClick={() => void handleSetDefault(item.id)}>
                            设为默认
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          loading={deletingId === item.id}
                          onClick={() => void handleDelete(item.id, item.name)}
                        >
                          删除
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))
              ) : (
                <TR>
                  <TD colSpan={6} className="text-muted text-sm">
                    {loading ? "加载中…" : "暂无字典，先上传一个吧。"}
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </div>
      </Card>
      <Modal
        open={showEditorModal}
        onClose={handleCloseEditor}
        className="max-w-4xl"
        title={editorWordlist ? `编辑字典：${editorWordlist.name}` : "编辑字典"}
        description="查看与修改字典内容，支持一键去重"
      >
        {editorLoading && <div className="py-16 text-center text-sm text-muted">加载中…</div>}
        {!editorLoading && (
          <div className="space-y-3">
            {editorError && (
              <Card className="border border-destructive/40 bg-destructive/10 text-red-200">{editorError}</Card>
            )}
            {editorStatus && (
              <Card className="border border-emerald-500/50 bg-emerald-500/10 text-emerald-100">{editorStatus}</Card>
            )}
            {editorWordlist ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {renderTypePill(editorWordlist.type)}
                    {editorWordlist.is_default && <Badge variant="outline">默认</Badge>}
                    <span className="text-muted">行数 {editorLineCount}</span>
                    <span className="text-muted">大小 {humanSize(editorWordlist.size_bytes)}</span>
                    <span className="text-muted">创建 {formatDateTime(editorWordlist.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted">
                    <span>名称</span>
                    <Input value={editorName} onChange={(e) => setEditorName(e.target.value)} className="h-9 w-56" />
                  </div>
                </div>
                <textarea
                  className="min-h-[320px] w-full rounded-xl border border-border/80 bg-[var(--surface-strong)] px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  spellCheck={false}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted">
                    去重会移除重复行与空行，保持出现顺序，保存或去重后立即写入后端。
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" onClick={handleCloseEditor}>
                      关闭
                    </Button>
                    <Button type="button" variant="outline" loading={deduping} onClick={handleDedupeEditor}>
                      一键去重
                    </Button>
                    <Button type="button" loading={saving} onClick={handleSaveEditor}>
                      保存
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-sm text-muted">无法加载字典内容</div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={showUploadModal} onClose={() => setShowUploadModal(false)} title="上传字典">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void handleUploadSubmit(fd);
          }}
        >
          <Input name="wordlistName" placeholder="自定义文件名 (可选)" />
          <div className="flex flex-col gap-1 text-sm">
            <div className="text-xs text-muted">类型</div>
            <select
              name="wordlistType"
              className="rounded-lg border border-border/80 bg-[var(--surface-strong)] px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              defaultValue="subdomain"
            >
              {WORDLIST_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <Input type="file" name="wordlistFile" accept=".txt,text/plain" />
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="wordlistDefault" className="h-4 w-4" /> 设为默认
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setShowUploadModal(false)}>
              取消
            </Button>
            <Button type="submit" loading={uploading}>
              上传
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
