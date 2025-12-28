#!/bin/bash
set -e

echo "=== Inkwell Startup ==="

# Ensure data directory exists
mkdir -p /app/data

# Run database migrations using Bun-native script
# (avoids better-sqlite3 native module compatibility issues)
bun run src/lib/migrate.ts

echo "Starting Inkwell server..."
exec bun run src/index.ts
