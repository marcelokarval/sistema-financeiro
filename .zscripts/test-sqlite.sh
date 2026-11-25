#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Erro: comando obrigatório '$cmd' não encontrado no PATH." >&2
    exit 1
  fi
}

require_cmd bwrap
require_cmd bun
require_cmd node
require_cmd realpath

BUN_BIN="$(realpath -e "$(command -v bun)")"
NODE_BIN="$(realpath -e "$(command -v node)")"
BUN_DIR="$(dirname "$BUN_BIN")"
NODE_DIR="$(dirname "$NODE_BIN")"
NODE_PREFIX="$(dirname "$NODE_DIR")"

for req_path in "prisma/schema.prisma" "src" "package.json" "tsconfig.json" "node_modules"; do
  if [ ! -e "$REPO_ROOT/$req_path" ]; then
    echo "Erro: insumo obrigatório ausente no projeto: $REPO_ROOT/$req_path" >&2
    exit 1
  fi
done

if [ ! -x "$REPO_ROOT/node_modules/.bin/prisma" ]; then
  echo "Erro: CLI do Prisma ausente em $REPO_ROOT/node_modules/.bin/prisma" >&2
  exit 1
fi

WORK="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/test-sqlite.XXXXXX")"
trap 'rm -rf -- "$WORK"' EXIT

PROJECT_DIR="/workspace"

build_bwrap_args() {
  BWRAP_ARGS=(
    --tmpfs /
    --ro-bind /usr /usr
    --ro-bind /etc /etc
    --dev /dev
    --proc /proc
    --dir /tmp --tmpfs /tmp
    --dir /scratch --tmpfs /scratch
    --unshare-net
    --die-with-parent
    --dir "$PROJECT_DIR"
    --dir "$PROJECT_DIR/prisma"
    --ro-bind "$REPO_ROOT/src" "$PROJECT_DIR/src"
    --ro-bind "$REPO_ROOT/prisma/schema.prisma" "$PROJECT_DIR/prisma/schema.prisma"
    --ro-bind "$REPO_ROOT/package.json" "$PROJECT_DIR/package.json"
    --ro-bind "$REPO_ROOT/tsconfig.json" "$PROJECT_DIR/tsconfig.json"
    --ro-bind "$REPO_ROOT/node_modules" "$PROJECT_DIR/node_modules"
    --chdir "$PROJECT_DIR"
  )

  local sysdir target
  for sysdir in /bin /lib /lib64 /sbin; do
    if [ -L "$sysdir" ]; then
      target="$(readlink "$sysdir")"
      BWRAP_ARGS+=(--symlink "$target" "$sysdir")
    elif [ -d "$sysdir" ]; then
      BWRAP_ARGS+=(--ro-bind "$sysdir" "$sysdir")
    fi
  done

  if [[ "$BUN_DIR" != /usr/* && "$BUN_DIR" != /bin ]]; then
    BWRAP_ARGS+=(--ro-bind "$BUN_DIR" "$BUN_DIR")
  fi

  if [[ "$NODE_PREFIX" != "/" && "$NODE_PREFIX" != "/usr" && "$NODE_PREFIX" != "/usr/local" && "$NODE_PREFIX" != /usr/* ]]; then
    BWRAP_ARGS+=(--ro-bind "$NODE_PREFIX" "$NODE_PREFIX")
  elif [[ "$NODE_DIR" != /usr/* && "$NODE_DIR" != /bin ]]; then
    BWRAP_ARGS+=(--ro-bind "$NODE_DIR" "$NODE_DIR")
  fi
}

build_bwrap_args

if ! bwrap "${BWRAP_ARGS[@]}" /bin/true 2>/dev/null; then
  echo "Erro: falha ao iniciar sandbox bwrap (verifique suporte a unprivileged user namespaces / AppArmor)." >&2
  exit 1
fi

SANDBOX_PATH="$BUN_DIR:$NODE_DIR:/usr/local/bin:/usr/bin:/bin"

run_in_sandbox() {
  local label="$1"
  local tz="$2"
  local inner_cmd="$3"

  echo "==> [$label] (TZ=${tz})"
  bwrap "${BWRAP_ARGS[@]}" \
    env -i \
      PATH="$SANDBOX_PATH" \
      HOME="/tmp/home" \
      TMPDIR="/tmp" \
      LC_ALL="C.UTF-8" \
      TZ="$tz" \
      /bin/bash -lc "set -euo pipefail; mkdir -p /tmp/home; $inner_cmd"
}

run_in_sandbox \
  "purchase-date (UTC)" \
  "UTC" \
  'DATABASE_URL="file:/tmp/calendar-d3.sqlite" bun --no-env-file ./node_modules/.bin/prisma db push --force-reset --skip-generate --schema=prisma/schema.prisma >/dev/null && CALENDAR_D3_SQLITE=1 DATABASE_URL="file:/tmp/calendar-d3.sqlite" bun --no-env-file test ./src/lib/purchase-date.test.ts'

run_in_sandbox \
  "purchase-date (America/Bahia)" \
  "America/Bahia" \
  'DATABASE_URL="file:/tmp/calendar-d3.sqlite" bun --no-env-file ./node_modules/.bin/prisma db push --force-reset --skip-generate --schema=prisma/schema.prisma >/dev/null && CALENDAR_D3_SQLITE=1 DATABASE_URL="file:/tmp/calendar-d3.sqlite" bun --no-env-file test ./src/lib/purchase-date.test.ts'

run_in_sandbox \
  "installments/route" \
  "UTC" \
  'DATABASE_URL="file:/tmp/installments-d2.db" bun --no-env-file ./node_modules/.bin/prisma db push --force-reset --skip-generate --schema=prisma/schema.prisma >/dev/null && INSTALLMENTS_D2_SQLITE=1 DATABASE_URL="file:/tmp/installments-d2.db" bun --no-env-file test ./src/app/api/installments/route.test.ts'

run_in_sandbox \
  "purchases/route-integrity" \
  "UTC" \
  'rm -f /scratch/purchases-integrity.db && DATABASE_URL="file:/scratch/purchases-integrity.db" bun --no-env-file test ./src/app/api/purchases/route-integrity.test.ts'

run_in_sandbox \
  "consortiums/assembly" \
  "UTC" \
  'DATABASE_URL="file:/scratch/consortium-assembly.sqlite" bun --no-env-file ./node_modules/.bin/prisma db push --force-reset --skip-generate --schema=prisma/schema.prisma >/dev/null && DATABASE_URL="file:/scratch/consortium-assembly.sqlite" bun --no-env-file test ./src/app/api/consortiums/assembly.test.ts'

run_in_sandbox \
  "savings/route" \
  "UTC" \
  'DATABASE_URL="file:/scratch/savings-route.sqlite" bun --no-env-file ./node_modules/.bin/prisma db push --force-reset --skip-generate --schema=prisma/schema.prisma >/dev/null && DATABASE_URL="file:/scratch/savings-route.sqlite" bun --no-env-file test ./src/app/api/savings/route.test.ts'
