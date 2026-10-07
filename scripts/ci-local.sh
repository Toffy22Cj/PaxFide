#!/usr/bin/env bash
# CI local de paxfide-web — excepción permanente a la regla 3.2 (Carlos, 2026-10-07): GitHub Actions no arranca
# porque la cuenta está bloqueada por facturación.
#
# Ejecuta EXACTAMENTE los pasos de .github/workflows/ci.yml, en el mismo orden. Si cambia uno, cambia el otro.
#   1. Checkout repository           → el commit actual del árbol de trabajo (debe estar limpio)
#   2. Check for .skip or .only      → mismo grep
#   3. Setup Node.js 22              → se exige Node 22.x
#   4. Install pnpm (11.26.0)        → se exige pnpm 11.26.0
#   5. Install dependencies          → pnpm install --frozen-lockfile
#   6. Typecheck                     → pnpm typecheck
#   7. Vitest                        → pnpm vitest run
#   8. Check Server Imports          → pnpm check:server
#   9. Install Playwright Chromium   → pnpm exec playwright install --with-deps chromium
#                                      (si PW_CHROMIUM_PATH apunta a un Chromium local, se usa ese y se registra)
#  10. Playwright E2E Tests          → pnpm test:e2e
#
# Uso: desde la raíz del repositorio a validar:  bash scripts/ci-local.sh
# Salida: Documentos/evidencia-web/ci-local-<commit corto>-<fecha UTC>.txt (con su sha256). Código ≠ 0 si algo falla.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "ci-local: no es un repositorio git" >&2; exit 2; }
cd "$ROOT"

# 1. Árbol limpio: lo que se valida es exactamente el commit
if [ -n "$(git status --porcelain)" ]; then
  echo "ci-local: hay cambios sin commit; se niega a ejecutarse." >&2
  git status --short >&2
  exit 2
fi

COMMIT="$(git rev-parse HEAD)"
SHORT="$(git rev-parse --short HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="Documentos/evidencia-web"
OUT="$OUT_DIR/ci-local-$SHORT-$STAMP.txt"
mkdir -p "$OUT_DIR"
TMP="$(mktemp)"
RESULTS=()
FAILED=0

log() { echo "$*" | tee -a "$TMP"; }

step() {
  local name="$1"; shift
  log ""
  log "===== PASO: $name ====="
  log "\$ $*"
  local start end rc
  start=$(date +%s)
  if [ "$FAILED" -ne 0 ]; then
    log "OMITIDO (un paso anterior falló, como en GitHub Actions)"
    RESULTS+=("OMITIDO  $name")
    return
  fi
  bash -c "$*" >>"$TMP" 2>&1
  rc=$?
  end=$(date +%s)
  if [ "$rc" -eq 0 ]; then
    log "RESULTADO: OK ($((end - start)) s)"
    RESULTS+=("OK       $name")
  else
    log "RESULTADO: FALLO (código $rc, $((end - start)) s)"
    RESULTS+=("FALLO    $name (código $rc)")
    FAILED=1
  fi
}

log "# CI local de paxfide-web (réplica de .github/workflows/ci.yml)"
log "commit:     $COMMIT"
log "rama:       $BRANCH"
log "fecha UTC:  $(date -u +%FT%TZ)"
log "node:       $(node -v 2>/dev/null || echo 'no instalado')"
log "pnpm:       $(pnpm -v 2>/dev/null || echo 'no instalado')"
log "workflow:   .github/workflows/ci.yml sha256 $(sha256sum .github/workflows/ci.yml | cut -d' ' -f1)"

step "Checkout repository" "git cat-file -e $COMMIT && echo 'Árbol limpio en $COMMIT'"
step "Check for .skip or .only in tests" "if grep -E '\\.(skip|only)\\(' -r __tests__/ e2e/; then echo 'Error: Found .skip() or .only() in tests. Please remove them.'; exit 1; fi"
step "Setup Node.js 22" "node -v | grep -Eq '^v22\\.' || { echo 'Se exige Node 22.x'; exit 1; }; node -v"
step "Install pnpm" "[ \"\$(pnpm -v)\" = '11.26.0' ] || { echo 'Se exige pnpm 11.26.0 (npm install -g pnpm@11.26.0)'; exit 1; }; pnpm -v"
step "Install dependencies" "pnpm install --frozen-lockfile"
step "Typecheck" "pnpm typecheck"
step "Vitest" "pnpm vitest run"
step "Check Server Imports" "pnpm check:server"
if [ -n "${PW_CHROMIUM_PATH:-}" ]; then
  step "Install Playwright Chromium" "test -x \"\$PW_CHROMIUM_PATH\" && echo \"Chromium local (PW_CHROMIUM_PATH=\$PW_CHROMIUM_PATH); no se descarga\" && \"\$PW_CHROMIUM_PATH\" --version"
else
  step "Install Playwright Chromium" "pnpm exec playwright install --with-deps chromium"
fi
step "Playwright E2E Tests" "pnpm test:e2e"

log ""
log "===== RESUMEN ====="
for r in "${RESULTS[@]}"; do log "$r"; done
if [ "$FAILED" -eq 0 ]; then log "CI LOCAL: OK"; else log "CI LOCAL: FALLO"; fi

cp "$TMP" "$OUT"
rm -f "$TMP"
SUM="$(sha256sum "$OUT" | cut -d' ' -f1)"
echo "" >>"$OUT"
echo "sha256 (de todo lo anterior a la línea en blanco final; verificar con: head -n -2 <archivo> | sha256sum): $SUM" >>"$OUT"
echo ""
echo "Evidencia: $OUT"
echo "sha256:    $SUM"
exit "$FAILED"
