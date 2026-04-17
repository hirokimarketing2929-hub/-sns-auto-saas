import os
import json
import asyncio
from typing import List, Dict, Any, Optional

class MCPClient:
    """
    ProX MCP Client - Manages connections to Model Context Protocol servers.
    This client supports both Remote MCP Tools (xAI native) and local tool integration.
    """
    def __init__(self):
        self.remote_mcp_servers = []
        # デフォルトで追加する可能性のあるMCPサーバー（将来的にDBや設定から読み込む）
        self.registered_servers = [
            # Example: {"name": "Obsidian", "url": "http://localhost:3001", "type": "local"}
        ]

    def get_remote_tool_configs(self) -> List[Dict[str, Any]]:
        """
        xAI SDKの tools パラメータに渡すための Remote MCP 設定を生成します。
        """
        configs = []
        for server in self.registered_servers:
            if server.get("type") == "remote" or server.get("url").startswith("http"):
                configs.append({
                    "type": "remote_mcp",
                    "remote_mcp": {
                        "url": server["url"]
                    }
                })
        return configs

    async def fetch_local_context(self, query: str) -> str:
        """
        (将来用) ローカルのMCPサーバーから直接情報を取得し、プロンプトに注入するためのメソッド。
        """
        # 現時点ではスタブ
        return ""

    def add_server(self, name: str, url: str, server_type: str = "remote"):
        self.registered_servers.append({
            "name": name,
            "url": url,
            "type": server_type
        })

# グローバルなMCPクライアントインスタンス
mcp_manager = MCPClient()
