#!/bin/bash

# AuditAI Platform startup script.
# Next.js frontend + API routes backed by Supabase (auth, database, storage).

cd /workspace

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  npm install --no-audit --no-fund
fi

# Start the Next.js dev server (exposed preview port)
npm run dev
