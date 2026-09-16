/**
 * Migrate rescue delivery settings into the live database.
 * Idempotent. Reads SUPABASE_DB_URL from .env.local.
 *   node scripts/migrate-rescue.js
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

const SQL = fs.readFileSync(path.join(__dirname, "..", "supabase", "rescue.sql"), "utf8");

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
    const { rows } = await client.query(
      "select key, value from public.admin_settings where key like 'rescue_%' order by key",
    );
    for (const r of rows) console.log(`${r.key} = ${r.value}`);
    console.log("✅ rescue settings applied");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
