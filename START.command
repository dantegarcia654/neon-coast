#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js from https://nodejs.org/ or use the Python instructions in README.md."
  read -r answer
  exit 1
fi
exec node server.mjs
