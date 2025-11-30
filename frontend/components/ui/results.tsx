import { Card } from "./card";
import type { RunResponse, RunResults } from "@/lib/types";

// 状态码颜色映射
const getStatusColor = (statusCode: number) => {
    const colors = {
        '2xx': 'text-green-200 bg-green-500/10',
        '3xx': 'text-blue-200 bg-blue-500/10',
        '4xx': 'text-yellow-200 bg-yellow-500/10',
        '5xx': 'text-red-200 bg-red-500/10',
        'timeout': 'text-slate-200 bg-slate-500/10',
        'connection': 'text-slate-200 bg-slate-500/10'
    };

    if (statusCode >= 200 && statusCode < 300) {
        return colors['2xx'];
    } else if (statusCode >= 300 && statusCode < 400) {
        return colors['3xx'];
    } else if (statusCode >= 400 && statusCode < 500) {
        return colors['4xx'];
    } else if (statusCode >= 500) {
        return colors['5xx'];
    } else {
        return colors['connection'];
    }
};

const formatIps = (ips?: string[]) => {
    if (!ips || ips.length === 0) return "—";
    return ips.slice(0, 3).join(", ") + (ips.length > 3 ? ` +${ips.length - 3}` : "");
};

const derivePort = (metadata?: Record<string, any>) => {
    if (!metadata) return "—";
    if (metadata.port) return metadata.port;
    if (metadata.scheme === "https") return 443;
    if (metadata.scheme === "http") return 80;
    return "—";
};

interface ResultsProps {
    results: RunResults | null;
    run: RunResponse | null;
    loading: boolean;
    error: string | null;
}

export function Results({ results, run, loading, error }: ResultsProps) {
    // 统计信息
    const stats = {
        total: results?.results?.length || 0,
        successful: results?.results?.filter(r => r.metadata?.status_code && r.metadata.status_code >= 200 && r.metadata.status_code < 400)?.length || 0,
        failed: results?.results?.filter(r => r.metadata?.status_code && r.metadata.status_code >= 400)?.length || 0,
        timeouts: results?.results?.filter(r => r.metadata?.error?.includes('timeout'))?.length || 0,
    };

    // 保持接口返回顺序，确保列表简洁
    const sortedResults = results?.results || [];

    return (
        <Card>
            <Card.Header className="flex items-center justify-between pb-3">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-slate-50">子域名枚举结果</h3>
                    <p className="text-xs text-slate-400">
                        {results ? `共 ${stats.total} 条` : "等待任务完成"}
                    </p>
                </div>
            </Card.Header>

            <Card.Content className="p-0">
                {error && (
                    <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="text-red-600 text-sm font-medium">{error}</div>
                    </div>
                )}

                {results && results.results.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-[var(--surface-strong)]/60 border-b border-border/60">
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-[0.16em]">
                                        资产
                                    </th>
                                    <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-[0.16em]">
                                        标题
                                    </th>
                                    <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-[0.16em]">
                                        响应码
                                    </th>
                                    <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-[0.16em]">
                                        IP
                                    </th>
                                    <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-[0.16em]">
                                        端口
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedResults.map((item) => (
                                    <tr key={item.host} className="border-b border-border/40 hover:bg-[var(--surface-strong)] transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                <a
                                                    href={`http://${item.host}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-300 hover:text-blue-100 font-semibold hover:underline"
                                                >
                                                    {item.host}
                                                </a>
                                                <span className="text-[11px] text-slate-500">
                                                    {item.discovered_at ? formatDateTime(item.discovered_at) : "未知时间"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="text-sm text-slate-200 max-w-64 truncate block" title={item.metadata?.title || '无标题'}>
                                                {item.metadata?.title || "—"}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            {item.metadata?.status_code ? (
                                                <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-[11px] font-semibold ${getStatusColor(item.metadata.status_code)}`}>
                                                    {item.metadata.status_code}
                                                </span>
                                            ) : item.metadata?.error ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-200">
                                                    错误
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-200">
                                                    未知
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            <span className="text-sm text-slate-200">{formatIps(item.metadata?.ips)}</span>
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            <span className="text-sm text-slate-200">{derivePort(item.metadata)}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!results && !loading && !error && (
                    <div className="text-center py-16">
                        <div className="text-slate-500">暂无结果数据，等待枚举完成...</div>
                    </div>
                )}

                {results && results.results.length === 0 && !loading && !error && (
                    <div className="text-center py-16">
                        <div className="text-slate-500">未发现任何子域名</div>
                    </div>
                )}
            </Card.Content>
        </Card>
    );
}
