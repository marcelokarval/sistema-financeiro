#!/bin/sh

set +x
set -e

# Preserva o caminho canônico inteiro antes de recusar caracteres de controle.
canonical_path() {
    newline='
'
    resolved=$(realpath -e -- "$1" 2>/dev/null && printf .) || return 1
    resolved=${resolved%"$newline."}
}

canonical_path "$0" || { echo "Erro: launcher não encontrado." >&2; exit 1; }
BUILD_DIR=${resolved%/*}

database_error() {
    echo "Erro: DATABASE_URL deve apontar para um SQLite externo preexistente e acessível (file:/caminho/absoluto)." >&2
    exit 1
}

plain_absolute_path() {
    case "$1" in
        //*|*[[:cntrl:]]*|*'?'*|*'#'*|*'%'*|*'\'*) return 1 ;;
        /*) return 0 ;;
        *) return 1 ;;
    esac
}

case ${DATABASE_URL-} in
    file:/*) db_path=${DATABASE_URL#file:} ;;
    *) database_error ;;
esac
plain_absolute_path "$db_path" || database_error
canonical_path "$db_path" || database_error
plain_absolute_path "$resolved" || database_error
case "$resolved" in
    "$BUILD_DIR"|"$BUILD_DIR"/*) database_error ;;
esac
[ -f "$resolved" ] && [ -s "$resolved" ] && [ -r "$resolved" ] || database_error
export DATABASE_URL="file:$resolved"
unset db_path resolved

command -v caddy >/dev/null 2>&1 || { echo "Erro: caddy não encontrado no PATH." >&2; exit 1; }

# 存储所有子进程的 PID
pids=""
cleaned_up=0

# 清理函数：优雅关闭所有服务
cleanup() {
    rc=${1:-$?}
    if [ "$cleaned_up" -eq 1 ]; then
        return "$rc"
    fi
    cleaned_up=1
    trap - EXIT INT TERM

    set +e
    any_alive=0
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            any_alive=1
            break
        fi
    done

    if [ "$any_alive" -eq 1 ]; then
        echo ""
        echo "🛑 正在关闭所有服务..."

        # 发送 SIGTERM 信号给所有子进程
        for pid in $pids; do
            if kill -0 "$pid" 2>/dev/null; then
                service_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
                echo "   关闭进程 $pid ($service_name)..."
                kill -TERM "$pid" 2>/dev/null || true
            fi
        done

        # 等待所有进程退出（最多等待 5 秒）
        sleep 1
        for pid in $pids; do
            if kill -0 "$pid" 2>/dev/null; then
                # 如果还在运行，等待最多 4 秒
                timeout=4
                while [ $timeout -gt 0 ] && kill -0 "$pid" 2>/dev/null; do
                    sleep 1
                    timeout=$((timeout - 1))
                done
                # 如果仍然在运行，强制关闭
                if kill -0 "$pid" 2>/dev/null; then
                    echo "   强制关闭进程 $pid..."
                    kill -KILL "$pid" 2>/dev/null || true
                fi
            fi
        done

        for pid in $pids; do
            wait "$pid" 2>/dev/null || true
        done

        echo "✅ 所有服务已关闭"
    fi

    return "$rc"
}

trap 'rc=$?; cleanup "$rc"; exit "$rc"' EXIT
trap 'cleanup 130; exit 130' INT
trap 'cleanup 143; exit 143' TERM

echo "🚀 开始启动所有服务..."
echo ""

# 切换到构建目录
cd "$BUILD_DIR" || exit 1

# 启动 Next.js 服务器
if [ -f "./next-service-dist/server.js" ]; then
    echo "🚀 启动 Next.js 服务器..."
    cd next-service-dist/ || exit 1
    
    # 设置环境变量
    export NODE_ENV=production
    export PORT="${PORT:-3000}"
    export HOSTNAME="${HOSTNAME:-0.0.0.0}"
    # 后台启动 Next.js
    bun server.js &
    NEXT_PID=$!
    pids="$NEXT_PID"
    
    # 等待一小段时间检查进程是否成功启动
    sleep 1
    if ! kill -0 "$NEXT_PID" 2>/dev/null; then
        echo "❌ Next.js 服务器启动失败"
        exit 1
    else
        echo "✅ Next.js 服务器已启动 (PID: $NEXT_PID, Port: $PORT)"
    fi
    
    cd ../
else
    echo "⚠️  未找到 Next.js 服务器文件: ./next-service-dist/server.js"
fi

# 启动 mini-services
if [ -f "./mini-services-start.sh" ]; then
    echo "🚀 启动 mini-services..."
    
    # 运行启动脚本（从根目录运行，脚本内部会处理 mini-services-dist 目录）
    sh ./mini-services-start.sh &
    MINI_PID=$!
    pids="$pids $MINI_PID"
    
    # 等待一小段时间检查进程是否成功启动
    sleep 1
    if ! kill -0 "$MINI_PID" 2>/dev/null; then
        echo "⚠️  mini-services 可能启动失败，但继续运行..."
    else
        echo "✅ mini-services 已启动 (PID: $MINI_PID)"
    fi
elif [ -d "./mini-services-dist" ]; then
    echo "⚠️  未找到 mini-services 启动脚本，但目录存在"
else
    echo "ℹ️  mini-services 目录不存在，跳过"
fi

# 启动 Caddy（如果存在 Caddyfile）
echo "🚀 启动 Caddy..."

# Caddy 作为前台进程运行（主进程）
echo "✅ Caddy 已启动（前台运行）"
echo ""
echo "🎉 所有服务已启动！"
echo ""
echo "💡 按 Ctrl+C 停止所有服务"
echo ""

# Caddy 作为主进程运行
caddy run --config Caddyfile --adapter caddyfile &
CADDY_PID=$!
pids="$pids $CADDY_PID"
caddy_rc=0
wait "$CADDY_PID" || caddy_rc=$?
exit "$caddy_rc"
