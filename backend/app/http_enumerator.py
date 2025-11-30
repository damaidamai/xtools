"""
高效的HTTP子域名枚举器 - 优化版

主要改进:
1. 修复 ClientSession 作用域问题
2. 并行请求策略提升速度
3. 批量数据库写入减少 I/O
4. 可选的 DNS 预检查
5. 自适应并发控制
"""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import os
import ssl
from typing import Dict, Optional, Set, Tuple, List
import aiohttp
from aiohttp import ClientTimeout, TCPConnector
from urllib.parse import urlparse

from loguru import logger
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from .models import Subdomain, SubdomainRun, Wordlist
from .run_progress import clear_progress, clear_stop, increment_progress, is_stopped, set_progress

LOG_LIMIT = 4000
DEFAULT_WORDLIST_TYPE = "subdomain"

# 配置参数
MAX_CONCURRENT_REQUESTS = int(os.getenv("MAX_CONCURRENT_REQUESTS", "50"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "5"))
MAX_RESPONSE_SIZE = int(os.getenv("MAX_RESPONSE_SIZE", "4096"))
VERIFY_SSL = os.getenv("VERIFY_SSL", "false").lower() == "true"
ENABLE_GET_FALLBACK = os.getenv("ENABLE_GET_FALLBACK", "true").lower() == "true"
USER_AGENT = os.getenv("USER_AGENT", "XTools/1.0 (HTTP Subdomain Enumerator)")

# DNS 配置
DNS_TIMEOUT = int(os.getenv("DNS_TIMEOUT", "2"))
DNS_RETRIES = int(os.getenv("DNS_RETRIES", "2"))

_ssl_context: Optional[ssl.SSLContext] = None


def _append_log(log: str, new_line: str) -> str:
    combined = (log + "\n" + new_line).strip()
    if len(combined) > LOG_LIMIT:
        return combined[-LOG_LIMIT:]
    return combined


def _safe_snippet(text: str, limit: int = 200) -> str:
    """清理换行和多余空白，截断以避免日志过长。"""
    return " ".join(text.split())[:limit]


def _get_ssl_context() -> ssl.SSLContext:
    """缓存 SSL 配置，避免重复创建"""
    global _ssl_context
    if _ssl_context is None:
        ctx = ssl.create_default_context()
        if not VERIFY_SSL:
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        _ssl_context = ctx
    return _ssl_context


async def _dns_resolve(subdomain: str, resolver) -> Tuple[bool, Optional[List[str]]]:
    """
    DNS 解析检查，返回是否存在和 IP 列表
    
    需要安装: pip install aiodns
    返回: (是否存在, IP列表)
    """
    if resolver is None:
        # 没有 aiodns 时使用内置解析作为兜底，同时尝试获取 IP
        try:
            loop = asyncio.get_running_loop()
            addrs = await asyncio.wait_for(
                loop.getaddrinfo(subdomain, None, proto=0, type=0, family=0),
                timeout=2,
            )
            ips = list({addr[4][0] for addr in addrs if addr[4]})
            return (True, ips) if ips else (True, None)
        except Exception as e:
            logger.debug("Fallback DNS resolve failed for {}: {}", subdomain, e)
            return False, None
    
    try:
        ips = []
        
        # 尝试查询 A 记录 (IPv4)
        try:
            result = await asyncio.wait_for(resolver.query(subdomain, 'A'), timeout=2)
            ips.extend([r.host for r in result])
        except:
            pass
        
        # 尝试查询 AAAA 记录 (IPv6)
        try:
            result = await asyncio.wait_for(resolver.query(subdomain, 'AAAA'), timeout=2)
            ips.extend([r.host for r in result])
        except:
            pass
        
        # 如果有任何 IP，说明 DNS 记录存在
        if ips:
            return True, ips
        
        return False, None
        
    except Exception as e:
        logger.debug("DNS resolve failed for {}: {}", subdomain, e)
        # DNS 查询失败，按不存在处理，避免继续发起 HTTP 请求
        return False, None


def _extract_peer_ip(response: aiohttp.ClientResponse) -> Optional[str]:
    """从响应连接中提取对端 IP，作为 DNS 结果的补充。"""
    try:
        if response.connection and response.connection.transport:
            peer = response.connection.transport.get_extra_info("peername")
            if peer and isinstance(peer, (tuple, list)) and len(peer) > 0:
                return peer[0]
    except Exception as e:
        logger.debug("Extract peer IP failed: {}", e)
    return None


async def _verify_subdomain_http(
    subdomain: str,
    session: aiohttp.ClientSession,
) -> Tuple[bool, Dict]:
    """
    并行验证子域名HTTP服务
    
    策略：并行尝试 HTTPS/HTTP HEAD，失败后尝试 OPTIONS 和 GET
    """
    details = {
        'subdomain': subdomain,
        'method': None,
        'scheme': None,
        'status_code': None,
        'content_type': None,
        'content_length': None,
        'server': None,
        'title': None,
        'error': None,
        'response_time': None
    }

    try:
        start_time = dt.datetime.now()
        
        # 并行策略：同时尝试 HTTPS 和 HTTP 的 HEAD 请求
        tasks = [
            _try_request(session, 'HEAD', f"https://{subdomain}", details.copy(), start_time),
            _try_request(session, 'HEAD', f"http://{subdomain}", details.copy(), start_time),
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 返回第一个成功的结果
        for result in results:
            if not isinstance(result, Exception) and result[0]:
                result[1].setdefault('detected_by', result[1].get('method'))
                return result

        # 如果 HEAD 都失败，尝试 OPTIONS
        tasks = [
            _try_request(session, 'OPTIONS', f"https://{subdomain}", details.copy(), start_time),
            _try_request(session, 'OPTIONS', f"http://{subdomain}", details.copy(), start_time),
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in results:
            if not isinstance(result, Exception) and result[0]:
                result[1].setdefault('detected_by', result[1].get('method'))
                return result

        # 最后尝试受限的 GET
        if ENABLE_GET_FALLBACK:
            tasks = [
                _try_limited_get(session, f"https://{subdomain}", details.copy(), start_time),
                _try_limited_get(session, f"http://{subdomain}", details.copy(), start_time),
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in results:
                if not isinstance(result, Exception) and result[0]:
                    result[1].setdefault('detected_by', result[1].get('method'))
                    return result

        return False, details

    except Exception as e:
        details['error'] = str(e)
        return False, details


async def _try_request(
    session: aiohttp.ClientSession,
    method: str,
    url: str,
    details: Dict,
    start_time: dt.datetime
) -> Tuple[bool, Dict]:
    """尝试单个HTTP请求"""
    try:
        async with session.request(
            method=method,
            url=url,
            allow_redirects=False,
            timeout=ClientTimeout(total=3)
        ) as response:
            details.update({
                'method': method,
                'scheme': urlparse(url).scheme,
                'status_code': response.status,
                'content_type': response.headers.get('content-type', ''),
                'content_length': response.headers.get('content-length', ''),
                'server': response.headers.get('server', ''),
                'response_time': (dt.datetime.now() - start_time).total_seconds()
            })

            if _is_valid_response(response.status):
                details.setdefault('detected_by', details.get('method'))
                peer_ip = _extract_peer_ip(response)
                if peer_ip:
                    details.setdefault('ip', peer_ip)
                    details.setdefault('ips', [])
                    if peer_ip not in details['ips']:
                        details['ips'].append(peer_ip)
                return True, details

            return False, details

    except asyncio.TimeoutError:
        details['error'] = 'timeout'
    except aiohttp.ClientConnectorError:
        details['error'] = 'connection_refused'
    except aiohttp.ClientError as e:
        details['error'] = f'http_error: {type(e).__name__}'
    except Exception as e:
        details['error'] = f'unknown_error: {type(e).__name__}'

    return False, details


async def _try_limited_get(
    session: aiohttp.ClientSession,
    url: str,
    details: Dict,
    start_time: dt.datetime
) -> Tuple[bool, Dict]:
    """有限制的GET请求，只下载少量数据；缺失标题时会尝试一次无 Range 的兜底 GET。"""
    try:
        headers = {'Range': f'bytes=0-{MAX_RESPONSE_SIZE-1}'}

        async with session.get(
            url=url,
            headers=headers,
            # 跟随跳转以获取最终页面标题（常见 http->https 或 www 重定向）
            allow_redirects=True,
            timeout=ClientTimeout(total=3)
        ) as response:

            details.update({
                'method': 'GET(limited)',
                'scheme': urlparse(str(response.url)).scheme,
                'status_code': response.status,
                'content_type': response.headers.get('content-type', ''),
                'content_length': response.headers.get('content-length', ''),
                'server': response.headers.get('server', ''),
                'response_time': (dt.datetime.now() - start_time).total_seconds(),
                'final_url': str(response.url),
                'redirected': bool(response.history),
            })

            if _is_valid_response(response.status):
                details.setdefault('detected_by', details.get('method'))
                peer_ip = _extract_peer_ip(response)
                if peer_ip:
                    details.setdefault('ip', peer_ip)
                    details.setdefault('ips', [])
                    if peer_ip not in details['ips']:
                        details['ips'].append(peer_ip)

                # 尝试解析 title（即使 content-type 缺失也尝试）
                title_found = False
                try:
                    content_bytes = await response.content.read(MAX_RESPONSE_SIZE)
                    details['sampled_bytes'] = len(content_bytes)
                    content = content_bytes.decode('utf-8', errors='ignore')
                    lower = content.lower()
                    if '<title>' in lower:
                        start = lower.find('<title>') + 7
                        end = lower.find('</title>', start)
                        if start > 6 and end > start:
                            details['title'] = content[start:end].strip()[:100]
                            title_found = True
                except Exception:
                    pass

                # 如果未拿到标题，额外做一次无 Range 的兜底 GET（仍限制读取大小）
                if not title_found and response.status < 400:
                    try:
                        async with session.get(
                            url=url,
                            allow_redirects=True,
                            timeout=ClientTimeout(total=4)
                        ) as resp2:
                            details.update({
                                'status_code': resp2.status,
                                'scheme': urlparse(str(resp2.url)).scheme,
                                'content_type': resp2.headers.get('content-type', ''),
                                'content_length': resp2.headers.get('content-length', ''),
                                'server': resp2.headers.get('server', details.get('server', '')),
                                'response_time': (dt.datetime.now() - start_time).total_seconds(),
                                'final_url': str(resp2.url),
                                'redirected': bool(resp2.history),
                            })
                            peer_ip2 = _extract_peer_ip(resp2)
                            if peer_ip2:
                                details.setdefault('ip', peer_ip2)
                                details.setdefault('ips', [])
                                if peer_ip2 not in details['ips']:
                                    details['ips'].append(peer_ip2)

                            content_bytes = await resp2.content.read(MAX_RESPONSE_SIZE)
                            details['sampled_bytes'] = len(content_bytes)
                            content = content_bytes.decode('utf-8', errors='ignore')
                            lower = content.lower()
                            if '<title>' in lower:
                                start = lower.find('<title>') + 7
                                end = lower.find('</title>', start)
                                if start > 6 and end > start:
                                    details['title'] = content[start:end].strip()[:100]
                                    title_found = True
                    except Exception:
                        pass
                if not title_found:
                    # 带上调试信息，方便日志排查
                    details['title_debug'] = f"no <title> in first {details.get('sampled_bytes','?')} bytes; ct={details.get('content_type','')}; url={details.get('final_url','')}"
                    # 仅在 debug 级别输出截断的正文内容
                    logger.debug(
                        "No <title> for {} {} ct={} sampled={} url={} body='{}'",
                        url,
                        response.status,
                        details.get('content_type'),
                        details.get('sampled_bytes'),
                        details.get('final_url'),
                        _safe_snippet(content if 'content' in locals() else ""),
                    )

                return True, details

            return False, details

    except Exception as e:
        details['error'] = f'get_error: {type(e).__name__}'
        return False, details


async def _enrich_with_get(
    session: aiohttp.ClientSession,
    subdomain: str,
    details: Dict,
) -> Dict:
    """
    对已确认存活的子域再发起一次受限 GET，提取状态码和 title。
    避免对未存活的目标重复请求，减小负载。
    """
    if details.get('method', '').upper().startswith('GET'):
        return details

    detected_by = details.get('detected_by', details.get('method'))
    scheme = details.get('scheme') or 'https'
    ok, enriched = await _try_limited_get(
        session,
        f"{scheme}://{subdomain}",
        details.copy(),
        dt.datetime.now()
    )
    if ok:
        enriched['detected_by'] = detected_by
        return enriched

    details['detected_by'] = detected_by
    return details


def _is_valid_response(status_code: int) -> bool:
    """判断HTTP状态码是否表示有效的HTTP服务"""
    if 200 <= status_code < 400:
        return True

    valid_4xx = {
        400, 401, 403, 404, 405, 406, 407, 408, 409, 410,
        411, 412, 413, 414, 415, 416, 417, 418, 421, 422,
        423, 424, 425, 426, 428, 429, 431, 451,
    }

    return status_code in valid_4xx


async def _update_run(
    session: AsyncSession,
    run: SubdomainRun,
    *,
    status: Optional[str] = None,
    log_line: Optional[str] = None,
    error: Optional[str] = None,
    finished: bool = False,
) -> None:
    if status:
        run.status = status
    if log_line:
        run.log_snippet = _append_log(run.log_snippet, log_line)
    if error:
        run.error_message = error
    if run.started_at is None and status == "running":
        run.started_at = dt.datetime.now(dt.timezone.utc)
    if finished:
        run.finished_at = dt.datetime.now(dt.timezone.utc)
    session.add(run)
    await session.commit()
    await session.refresh(run)


async def _ensure_wordlist(
    session: AsyncSession,
    wordlist_id: Optional[int],
    *,
    expected_type: str = DEFAULT_WORDLIST_TYPE,
) -> Optional[str]:
    if wordlist_id is None:
        stmt = (
            select(Wordlist)
            .where(Wordlist.is_default.is_(True), Wordlist.type == expected_type)
            .limit(1)
        )
        result = await session.exec(stmt)
        wordlist = result.first()
    else:
        stmt = select(Wordlist).where(
            Wordlist.id == wordlist_id, Wordlist.type == expected_type
        )
        result = await session.exec(stmt)
        wordlist = result.first()
    if wordlist is None:
        return None
    return wordlist.path


async def run_http_enumerator(
    session: AsyncSession, run_id: int, domain: str, wordlist_id: Optional[int]
) -> None:
    """
    高效HTTP子域名枚举器主函数
    """
    run = await session.get(SubdomainRun, run_id)
    if run is None:
        return
    if is_stopped(run_id):
        return

    wordlist_path = await _ensure_wordlist(session, wordlist_id)
    if not wordlist_path:
        await _update_run(
            session, run,
            status="failed",
            error="未找到可用的字典文件",
            finished=True
        )
        return

    await _update_run(session, run, status="running")

    try:
        ssl_context = _get_ssl_context()
        connector = TCPConnector(
            ssl=ssl_context,
            limit=MAX_CONCURRENT_REQUESTS,
            ttl_dns_cache=300,
            use_dns_cache=True,
        )
        client_timeout = ClientTimeout(
            total=REQUEST_TIMEOUT,
            connect=3,
            sock_read=2
        )

        # 读取字典
        with open(wordlist_path, 'r', encoding='utf-8', errors='ignore') as f:
            words = [line.strip() for line in f if line.strip() and not line.startswith('#')]

        set_progress(run_id, len(words), 0)

        await _update_run(
            session, run,
            log_line=f"🚀 启动HTTP枚举器：{len(words)} 个候选子域名"
        )
        await _update_run(
            session, run,
            log_line=f"⚡ 配置：并发={MAX_CONCURRENT_REQUESTS}, 超时={REQUEST_TIMEOUT}s, DNS预检查=启用"
        )
        await _update_run(
            session, run,
            log_line=f"🎯 策略：DNS解析 → 并行 HEAD(HTTPS+HTTP) → OPTIONS → GET(受限)"
        )

        # 初始化 DNS 解析器
        dns_resolver = None
        try:
            import aiodns
            dns_resolver = aiodns.DNSResolver(timeout=DNS_TIMEOUT, tries=DNS_RETRIES)
            await _update_run(
                session, run,
                log_line=f"🔍 DNS解析器已启用，将先过滤不存在的域名"
            )
        except ImportError:
            await _update_run(
                session, run,
                log_line=f"⚠️  未安装 aiodns，跳过 DNS 预检查 (pip install aiodns)"
            )
            logger.info("aiodns not installed, skip DNS pre-check")

        # 创建信号量控制并发
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
        found_domains: Set[str] = set()

        # ✅ 关键修复：将所有使用 session 的代码放在 async with 块内
        async with aiohttp.ClientSession(
            connector=connector,
            timeout=client_timeout,
            headers={'User-Agent': USER_AGENT}
        ) as client_session:

            async def check_subdomain(word: str) -> Optional[Tuple[str, Dict]]:
                subdomain = f"{word}.{domain}"

                # 第一步：DNS 预检查
                dns_exists, ips = await _dns_resolve(subdomain, dns_resolver)
                
                if not dns_exists:
                    # DNS 不存在，直接跳过
                    return None

                # 第二步：HTTP 验证
                async with semaphore:
                    is_valid, details = await _verify_subdomain_http(subdomain, client_session)

                    if is_valid and subdomain not in found_domains:
                        found_domains.add(subdomain)
                        # 已确认存活后再进行一次受限 GET 获取标题/状态码等详情
                        details = await _enrich_with_get(client_session, subdomain, details)
                        
                        # 将 DNS 信息添加到 metadata
                        if ips:
                            details['ips'] = ips
                        # 若 HTTP 连接提取到了对端 IP 也附加上
                        if details.get('ip'):
                            details.setdefault('ips', [])
                            if details['ip'] not in details['ips']:
                                details['ips'].append(details['ip'])
                        
                        return subdomain, details

                    return None

            # 批量处理
            batch_size = 200
            total_found = 0
            total_dns_filtered = 0

            for i in range(0, len(words), batch_size):
                if is_stopped(run_id):
                    clear_progress(run_id)
                    await _update_run(
                        session, run,
                        status="canceled",
                        finished=True,
                        log_line="⏹ 任务已被用户停止"
                    )
                    return

                batch = words[i:i + batch_size]
                batch_num = i // batch_size + 1
                total_batches = (len(words) + batch_size - 1) // batch_size

                await _update_run(
                    session, run,
                    log_line=f"📦 处理批次 {batch_num}/{total_batches}: {len(batch)} 个候选域名"
                )
                logger.info(
                    "Processing batch {}/{} (size={}) for domain={}",
                    batch_num,
                    total_batches,
                    len(batch),
                    domain,
                )

                # 并发验证当前批次
                tasks = [check_subdomain(word) for word in batch]
                batch_results = await asyncio.gather(*tasks, return_exceptions=True)

                # 批量处理结果
                batch_found = 0
                batch_subdomains: List[Subdomain] = []
                batch_logs: List[str] = []

                for result in batch_results:
                    if isinstance(result, Exception):
                        logger.warning("Check subdomain failed: {}", result)
                        continue

                    if result:
                        subdomain, details = result
                        batch_found += 1
                        total_found += 1

                        # 格式化日志
                        info = f"✅ {subdomain}"
                        info += f" [{details['method']} {details['scheme']} {details['status_code']}]"
                        if details.get('response_time'):
                            info += f" ({details['response_time']:.2f}s)"
                        if details.get('ips'):
                            ips_str = ', '.join(details['ips'][:3])  # 最多显示3个IP
                            if len(details['ips']) > 3:
                                ips_str += f" +{len(details['ips'])-3}..."
                            info += f" IP:[{ips_str}]"
                        if details.get('server'):
                            info += f" - {details['server'][:30]}"
                        if details.get('title'):
                            info += f" - {details['title'][:50]}"
                        elif details.get('title_debug'):
                            info += f" - 无标题({details['title_debug'][:120]})"

                        batch_logs.append(info)

                        batch_subdomains.append(
                            Subdomain(
                                run_id=run.id,
                                host=subdomain,
                                source="http_enumerator",
                                metadata_json=json.dumps(details, ensure_ascii=False, separators=(',', ':'))
                            )
                        )

                # 批量写入日志和数据库
                if batch_logs:
                    await _update_run(session, run, log_line="\n".join(batch_logs))

                if batch_subdomains:
                    session.add_all(batch_subdomains)
                    try:
                        await session.commit()
                    except IntegrityError:
                        await session.rollback()
                        logger.opt(exception=True).warning("Integrity error while saving batch, rolled back")

                if batch_found > 0:
                    await _update_run(
                        session, run,
                        log_line=f"📈 本批次发现 {batch_found} 个子域名，总计 {total_found}"
                    )

                increment_progress(run_id, len(batch))

        # 完成
        clear_progress(run_id)
        
        summary = f"🎉 HTTP枚举完成！总计发现 {total_found} 个真实可访问的子域名"
        if dns_resolver:
            summary += f"\n🔍 DNS预检查已过滤大量无效域名"
        
        await _update_run(
            session, run,
            status="succeeded",
            finished=True,
            log_line=summary
        )
        clear_stop(run_id)

    except Exception as e:
        clear_progress(run_id)
        clear_stop(run_id)
        await _update_run(
            session, run,
            status="failed",
            error=f"HTTP枚举器错误: {str(e)}",
            finished=True
        )
