#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "需要 Node.js 24 LTS 和 npm 11；请使用 Dev Container，或先运行 nvm install && nvm use。" >&2
  exit 1
fi

node -e 'if (process.versions.node.split(".")[0] !== "24") { console.error("请使用 Node.js 24 LTS（见 .nvmrc）。"); process.exit(1); }'
npm_major="$(npm --version)"
if [[ "${npm_major%%.*}" != "11" ]]; then
  echo "需要 npm 11；当前版本为 $npm_major。" >&2
  exit 1
fi

# 使用锁文件安装；重复运行不会修改依赖定义或覆盖已有本地环境变量。
npm ci --no-fund --no-audit
npm run check

echo "云开发依赖和领域测试已就绪。Web 页面与 Vite 启动入口将在 Phase 1 实现。"
