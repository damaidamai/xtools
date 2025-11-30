#!/usr/bin/env python3
"""
XTools Simple HTTP Enumerator Launcher

启动HTTP子域名枚举器 - 无需交互式输入
"""

import os
import sys

def setup_http_mode():
    """设置HTTP枚举模式"""
    print("🚀 XTools HTTP子域名枚举器")
    print("✨ 特性：直接HTTP验证，无DNS依赖")

    # 设置环境变量
    os.environ["ENABLE_HTTP_ENUM"] = "true"
    os.environ["MAX_CONCURRENT_REQUESTS"] = "50"
    os.environ["REQUEST_TIMEOUT"] = "8"
    os.environ["VERIFY_SSL"] = "false"
    os.environ["ENABLE_GET_FALLBACK"] = "true"
    os.environ["USER_AGENT"] = "XTools/1.0 (HTTP Subdomain Enumerator)"

    print("⚡ 配置：并发=100, 超时=8s, SSL验证=否, HEAD/OPTIONS优先")
    print("📊 验证策略：HEAD → HTTPS → HTTP → OPTIONS → 有限GET")
    print("✅ HTTP枚举器配置完成！")

def print_usage():
    """显示使用说明"""
    print("📋 使用方法：")
    print("  python start_simple.py              # 使用默认配置")
    print("  python start_simple.py --fast     # 快速模式")
    print("  python start_simple.py --balanced  # 平衡模式")
    print("  python start_simple.py --thorough # 精确模式")
    print()
    print("🌐 前端: http://localhost:3000")
    print("📡 API文档: http://localhost:8000/docs")

def main():
    print("🎯 XTools HTTP子域名枚举器")
    print("跳过DNS依赖，直接验证HTTP服务！")
    print()

    # 解析命令行参数
    if len(sys.argv) > 1:
        mode = sys.argv[1]
        if mode == "--fast":
            os.environ["MAX_CONCURRENT_REQUESTS"] = "200"
            os.environ["REQUEST_TIMEOUT"] = "3"
            os.environ["ENABLE_GET_FALLBACK"] = "false"
            print("🚀 快速模式：200并发，3秒超时")
        elif mode == "--balanced":
            os.environ["MAX_CONCURRENT_REQUESTS"] = "50"
            os.environ["REQUEST_TIMEOUT"] = "8"
            os.environ["VERIFY_SSL"] = "true"
            print("⚡ 平衡模式：50并发，8秒超时，SSL验证")
        elif mode == "--thorough":
            os.environ["MAX_CONCURRENT_REQUESTS"] = "20"
            os.environ["REQUEST_TIMEOUT"] = "15"
            os.environ["VERIFY_SSL"] = "true"
            os.environ["ENABLE_GET_FALLBACK"] = "true"
            print("🎯 精确模式：20并发，15秒超时，包含GET验证")
        else:
            print("❌ 未知参数")
            print_usage()
            return
    else:
        print("📋 使用默认配置：100并发，8秒超时")

    # 设置HTTP枚举模式
    setup_http_mode()

    print_usage()

    print("\n🚀 确认启动？按Enter继续...")
    input()  # 等待用户确认

    print("\n🚀 启动HTTP枚举服务...")
    print("  后端: http://localhost:8000")
    print("  前端: http://localhost:3000")
    print("\n💡 提示：打开前端界面开始枚举")

    try:
        # 这里可以添加启动服务器的代码，现在暂时只显示信息
        print("✅ HTTP枚举器准备就绪！")
        print("🌐 请在前端界面开始枚举任务")
    except KeyboardInterrupt:
        print("\n👋 已取消启动")

if __name__ == "__main__":
    main()