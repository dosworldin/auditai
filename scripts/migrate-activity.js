/**
 * Migrate the admin activity feed into the live database.
 * Idempotent. Reads SUPABASE_DB_URL from .env.local.
 *   node scripts/migrate-activity.js
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

const SQL = fs.readFileSync(path.join(__dirname, "..", "supabase", "activity.sql"), "utf8");

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
    console.log("✅ activity migration applied (admin_activity, notify settings)");

    const { rows: tables } = await client.query(
      "select table_name from information_schema.tables where table_schema='public' and table_name='admin_activity'",
    );
    console.log("admin_activity table:", tables.length ? "exists" : "MISSING");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
