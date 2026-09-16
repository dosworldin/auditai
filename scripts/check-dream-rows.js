/**
 * Debug helper: count dream_entries rows via direct SQL.
 * Reads SUPABASE_DB_URL from .env.local (same pattern as other migrate scripts).
 * Run: node scripts/check-dream-rows.js
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

loadEnvLocal();

async function main() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const r = await client.query("select count(*)::int as n from public.dream_entries");
    console.log("dream_entries count:", r.rows[0].n);
    const r2 = await client.query(
      "select id, left(narrative, 50) as narrative, match_alias, match_country, user_id is not null as has_user from public.dream_entries order by created_at desc limit 5",
    );
    console.log(JSON.stringify(r2.rows, null, 1));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Check failed:", e.message);
  process.exit(1);
});
