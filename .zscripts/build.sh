#!/bin/bash
# O executor Z recebe o diagnóstico e o caminho do pacote via stdout.
exec 2>&1
set -euo pipefail
umask 077

fail() { printf "Erro de empacotamento: %s\n" "$1" >&2; exit 1; }

script_lexical=$(realpath -ms -- "$0" 2>/dev/null) || fail "launcher de build inválido."
script_real=$(realpath -e -- "$0" 2>/dev/null) || fail "launcher de build inválido."
[ "$script_lexical" = "$script_real" ] || fail "link simbólico no caminho do launcher de build."
SCRIPT_DIR=${script_real%/*}
PROJECT_DIR=${SCRIPT_DIR%/*}
cd -- "$PROJECT_DIR"

# Inspeciona entradas sem abrir dotenv, resolver links ou percorrer o banco.
blocked_input=$(find -P . \
    \( -type d \( -path ./.git -o -path ./db \) \) -prune -o \
    -type l -printf link -quit -o \
    -iname ".env*" ! \( -name .env.example -type f \) -printf dotenv -quit) \
    || fail "não foi possível verificar o contexto de build."
case "$blocked_input" in
    link) fail "link simbólico no contexto de build." ;;
    dotenv) fail "dotenv privado no contexto de build." ;;
esac
[ ! -e .next ] || fail "o contexto precisa estar sem saída .next anterior."

regular_file() { [ -f "$1" ] && [ ! -L "$1" ]; }

required_service=mini-services/finance-ws
[ -d "$required_service" ] && regular_file "$required_service/package.json" \
    || fail "fontes obrigatórias de finance-ws ausentes."
regular_file package.json && regular_file bun.lock && [ -d public ] \
    && regular_file Caddyfile && regular_file "$SCRIPT_DIR/start.sh" \
    && regular_file "$SCRIPT_DIR/mini-services-start.sh" \
    || fail "insumo obrigatório de release ausente."

# Planeja todos os produtores a partir dos insumos validados, antes de chamar Bun.
services=()
entries=()
for service in mini-services/*; do
    [ -d "$service" ] && regular_file "$service/package.json" || continue
    regular_file "$service/bun.lock" || fail "bun.lock do mini-serviço ausente."
    entry=""
    for candidate in src/index.ts index.ts src/index.js index.js; do
        if regular_file "$service/$candidate"; then entry=$candidate; break; fi
    done
    [ -n "$entry" ] || fail "mini-serviço sem ponto de entrada."
    # Caminho absoluto: o cd do produtor não consulta CDPATH.
    services+=("$PROJECT_DIR/$service")
    entries+=("$entry")
done

build_id=${BUILD_ID:-local}
case "$build_id" in
    *[!a-zA-Z0-9_.-]*) fail "BUILD_ID inválido." ;;
esac
work=$(mktemp -d -- "/tmp/build_fullstack_${build_id}.XXXXXXXXXX")
trap 'rm -rf -- "$work"' EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
stage="$work/package"
archive="$work/package.tar.gz"
mkdir -- "$stage" "$work/home" "$work/tmp"

build_bun() {
    env -i PATH="$PATH" HOME="$work/home" TMPDIR="$work/tmp" LC_ALL=C \
        NEXT_TELEMETRY_DISABLED=1 bun "$@"
}

# Inventário estruturado: não interpreta a apresentação textual de tar -tvf.
# Valida os insumos antes da cópia e confronta o tar com a montagem verificada.
check_tree() {
    python3 -I - "$@" <<'PY'
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import tarfile


data_name = re.compile(r"\.(?:db|sqlite|sqlite3)(?:-(?:journal|wal|shm))?\Z", re.I)


def allowed(name):
    return all(part.lower() != "db" and not part.lower().startswith(".env")
               and not data_name.search(part) for part in PurePosixPath(name).parts)


def walk_error(error):
    raise error


def inventory(root):
    if root.is_symlink() or not root.is_dir():
        raise ValueError("raiz inválida")
    root = root.resolve(strict=True)
    entries = {".": ("dir", "")}
    for directory, dirs, files in os.walk(root, onerror=walk_error, followlinks=False):
        for leaf in dirs + files:
            path = Path(directory, leaf)
            name = path.relative_to(root).as_posix()
            if not allowed(name):
                raise ValueError("nome proibido")
            info = path.lstat()
            if stat.S_ISLNK(info.st_mode):
                target = os.readlink(path)
                if os.path.isabs(target) or not allowed(target):
                    raise ValueError("destino do link inválido")
                prefix = path.parent
                for part in target.split("/"):
                    prefix /= part
                    resolved = prefix.resolve(strict=True).relative_to(root)
                    if not allowed(resolved.as_posix()):
                        raise ValueError("destino do link proibido")
                entries[name] = ("symlink", target)
            elif stat.S_ISDIR(info.st_mode):
                entries[name] = ("dir", "")
            elif stat.S_ISREG(info.st_mode) and info.st_nlink == 1:
                entries[name] = ("file", info.st_size)
            else:
                raise ValueError("tipo de entrada proibido")
    return entries


try:
    expected = inventory(Path(sys.argv[1]))
    if len(sys.argv) == 3:
        with tarfile.open(sys.argv[2], "r:gz") as archive:
            for entry in archive:
                name = PurePosixPath(entry.name)
                if name.is_absolute() or ".." in name.parts:
                    raise ValueError("caminho de tar inválido")
                record = expected.pop(name.as_posix())  # recusa extras e duplicatas
                if entry.isdir():
                    actual = ("dir", "")
                elif entry.issym():
                    actual = ("symlink", entry.linkname)
                elif entry.type in (tarfile.REGTYPE, tarfile.AREGTYPE):
                    actual = ("file", entry.size)
                else:
                    raise ValueError("tipo de tar proibido")
                if actual != record:
                    raise ValueError("entrada de tar diferente da montagem")
            if expected:
                raise ValueError("inventário incompleto")
except (KeyError, OSError, RuntimeError, ValueError, tarfile.TarError):
    sys.exit("Erro de empacotamento: árvore ou tar contém entrada inválida.")
PY
}

build_bun install --frozen-lockfile
build_bun run build
regular_file .next/standalone/server.js && [ -s .next/standalone/server.js ] \
    && [ ! -L .next ] \
    && [ -d .next/standalone/.next/static ] && [ -d .next/standalone/public ] \
    || fail "saída obrigatória do Next incompleta."
check_tree .next/standalone
# O próprio bun run build já coloca estáticos e public dentro do standalone.
cp -a -- .next/standalone "$stage/next-service-dist"

mkdir -- "$stage/mini-services-dist"
for i in "${!services[@]}"; do
    service=${services[i]}
    entry=${entries[i]}
    bundle="$stage/mini-services-dist/mini-service-${service##*/}.js"
    (cd -- "$service" && build_bun install --frozen-lockfile &&
        build_bun build "$entry" --outfile "$bundle" --target bun --minify)
    regular_file "$bundle" && [ -s "$bundle" ] || fail "bundle de mini-serviço incompleto."
done

install -m 644 -- Caddyfile "$stage/Caddyfile"
install -m 755 -- "$SCRIPT_DIR/start.sh" "$stage/start.sh"
install -m 755 -- "$SCRIPT_DIR/mini-services-start.sh" "$stage/mini-services-start.sh"

check_tree "$stage"
env -i PATH="$PATH" LC_ALL=C tar -czf "$archive" -C "$stage" .
check_tree "$stage" "$archive"

# Publicação local, sem sobrescrever outro resultado e somente após inspeção.
output="$work.tar.gz"
ln -T -- "$archive" "$output"
printf "Pacote verificado: %s\n" "$output"
