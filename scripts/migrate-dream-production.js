/**
 * Dream AI Analyzer production migration.
 * Applies supabase/dream-production.sql (idempotent: IF NOT EXISTS everywhere).
 * Reads SUPABASE_DB_URL from .env.local — run:
 *   node scripts/migrate-dream-production.js
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

loadEnvLocal();

const SQL = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "dream-production.sql"),
  "utf8",
);

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL not set — cannot migrate.");
    process.exit(1);
  }
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(SQL);
    console.log("✅ dream production migration applied (identity, ai_analysis, matches_detail, hash index)");
    const { rows } = await client.query(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'dream_entries'
         and column_name in ('match_alias','match_country','match_identity_generated_at','ai_analysis')`,
    );
    console.log("New dream_entries columns present:", rows.map((r) => r.column_name).join(", "));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
