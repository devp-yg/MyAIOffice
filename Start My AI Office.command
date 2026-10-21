#!/bin/bash
cd "$(dirname "$0")"
machine=$(uname -m)
case "$machine" in
  arm64) bundled_node="runtime/node/macos-arm64/bin/node" ;;
  x86_64) bundled_node="runtime/node/macos-x64/bin/node" ;;
  *) echo "지원하지 않는 Mac 프로세서입니다: $machine"; read -r -p "Enter를 누르면 닫힙니다. "; exit 1 ;;
esac
if [ -x "$bundled_node" ]; then
  node_command=("$bundled_node")
elif command -v node >/dev/null 2>&1 && node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)'; then
  node_command=("$(command -v node)")
else
  echo "Node.js 24 or later is required. Install it or use a complete release ZIP."
  read -r -p "Enter to close. "
  exit 1
fi

# Reuse this app's server if it is already running. Starting a second copy
# would fail with EADDRINUSE even though the office is available in a browser.
if curl --silent --show-error --fail --max-time 2 http://127.0.0.1:4173/api/state 2>/dev/null | grep -q '"provider":"Codex"'; then
  echo "My AI Office is already running. Opening the existing office."
  open "http://127.0.0.1:4173"
  exit 0
fi

if lsof -nP -iTCP:4173 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "포트 4173을 다른 프로그램이 사용 중입니다. 기존 앱 창을 닫거나 해당 프로그램을 종료한 뒤 다시 실행해 주세요."
  read -r -p "Enter를 누르면 닫힙니다. "
  exit 1
fi

"${node_command[@]}" server.mjs &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null' EXIT INT TERM
ready=0
for _ in {1..30}; do
  if curl --silent --fail --max-time 1 http://127.0.0.1:4173/api/state >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    break
  fi
  sleep 0.25
done
if [ "$ready" -ne 1 ]; then
  echo "My AI Office 서버가 시작되지 않았습니다. 위 오류를 확인해 주세요."
  wait "$server_pid"
  exit 1
fi
open "http://127.0.0.1:4173"
wait "$server_pid"
