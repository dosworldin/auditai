#!/bin/bash

# AuditAI Platform - Blueprint Phase 1 startup script.
# Frontend-only blueprint (no backend service yet in this phase).
# When a backend is introduced, it will be started here in the background
# and the Next.js dev server will proxy /api to it.

cd /workspace

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  npm install --no-audit --no-fund
fi

# Start the frontend dev server (exposed preview port)
npm run dev
