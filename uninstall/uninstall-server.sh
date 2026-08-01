#!/usr/bin/env bash
# Uninstalls JARVIS from the headless server (the mini PC running OpenJarvis
# + Ollama + jarvis-tts). Run this ON the mini PC, not on the client laptop —
# see uninstall/uninstall-client.ps1 for the Windows client side.
#
# Usage:
#   ./uninstall-server.sh            # interactive, asks for confirmation
#   ./uninstall-server.sh --yes      # skip confirmation
#   ./uninstall-server.sh --yes --purge-ollama   # also remove Ollama itself
set -euo pipefail

SERVICE_NAME="openjarvis"
OPENJARVIS_DIR="${OPENJARVIS_DIR:-$HOME/OpenJarvis}"
JARVIS_TTS_VENV="${JARVIS_TTS_VENV:-$HOME/jarvis-ai-assistant/jarvis-tts/.venv}"
CONFIG_DIR="${CONFIG_DIR:-$HOME/.config/openjarvis}"
HF_TTS_CACHE="$HOME/.cache/huggingface/hub/models--facebook--mms-tts-ind"
MODELS=(qwen2.5:7b llava:13b)

ASSUME_YES=false
PURGE_OLLAMA=false
for arg in "$@"; do
  case "$arg" in
    --yes) ASSUME_YES=true ;;
    --purge-ollama) PURGE_OLLAMA=true ;;
  esac
done

echo "This will remove JARVIS (OpenJarvis backend, Ollama models, jarvis-tts,"
echo "config/telemetry data) from this machine. Paths in use:"
echo "  OpenJarvis dir : $OPENJARVIS_DIR"
echo "  jarvis-tts venv: $JARVIS_TTS_VENV"
echo "  Config dir     : $CONFIG_DIR"
if [ "$PURGE_OLLAMA" = true ]; then
  echo "  Ollama itself will also be uninstalled (--purge-ollama)."
fi
echo

if [ "$ASSUME_YES" != true ]; then
  read -r -p "Continue? [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

echo "==> Stopping and disabling the ${SERVICE_NAME} service"
if systemctl list-unit-files | grep -q "^${SERVICE_NAME}.service"; then
  sudo systemctl stop "${SERVICE_NAME}" || true
  sudo systemctl disable "${SERVICE_NAME}" || true
  sudo rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
  sudo systemctl daemon-reload
else
  echo "    (no ${SERVICE_NAME}.service unit found, skipping)"
fi

if command -v ollama >/dev/null 2>&1; then
  echo "==> Removing Ollama models: ${MODELS[*]}"
  for m in "${MODELS[@]}"; do
    ollama rm "$m" 2>/dev/null || echo "    (model $m not present, skipping)"
  done
  if [ "$PURGE_OLLAMA" = true ]; then
    echo "==> Purging Ollama itself"
    sudo systemctl stop ollama 2>/dev/null || true
    sudo systemctl disable ollama 2>/dev/null || true
    sudo rm -rf /usr/share/ollama /usr/local/bin/ollama /etc/systemd/system/ollama.service
    sudo systemctl daemon-reload
  fi
else
  echo "==> Ollama not installed, skipping model removal"
fi

echo "==> Removing OpenJarvis checkout ($OPENJARVIS_DIR)"
rm -rf "$OPENJARVIS_DIR"

echo "==> Removing jarvis-tts virtualenv ($JARVIS_TTS_VENV)"
rm -rf "$JARVIS_TTS_VENV"

echo "==> Removing cached MMS-TTS Indonesian model ($HF_TTS_CACHE)"
rm -rf "$HF_TTS_CACHE"

echo "==> Removing config/telemetry data ($CONFIG_DIR)"
rm -rf "$CONFIG_DIR"

echo
echo "Server-side cleanup done. This only cleaned the mini PC — run"
echo "uninstall/uninstall-client.ps1 on the Windows client laptop to remove"
echo "the Electron overlay side too."
