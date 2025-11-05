#!/usr/bin/env sh
set -e

# Install production deps if node_modules is missing (useful for shell-based buildpacks)
if [ ! -d node_modules ]; then
  npm ci --omit=dev
fi

# Start the server
node src/index.js
