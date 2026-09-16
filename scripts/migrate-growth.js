/**
 * Migrate the invite + referral growth engine into the live database.
 * Idempotent. Reads SUPABASE_DB_URL from .env.local.
 *   node scripts/migrate-growth.js
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

const SQL = fs.readFileSync(path.join(__dirname, "..", "supabase", "growth.sql"), "utf8");

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
    console.log("✅ growth migration applied (invite_codes, tiered referral settings)");

    const { rows } = await client.query(
      "select key, value from public.admin_settings where key like 'referral%' order by key",
    );
    // eslint-disable-next-line no-console
    for (const r of rows) console.log(`  ${r.key} = ${JSON.stringify(r.value)}`);

    const { rows: tables } = await client.query(
      "select table_name from information_schema.tables where table_schema='public' and table_name='invite_codes'",
    );
    console.log("invite_codes table:", tables.length ? "exists" : "MISSING");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
