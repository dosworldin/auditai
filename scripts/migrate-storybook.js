/**
 * Migrate the AI Storybooks tables + settings into the live database.
 * Idempotent. Parses .env.local itself (SUPABASE_DB_URL) — run:
 *   node scripts/migrate-storybook.js
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

const SQL = fs.readFileSync(path.join(__dirname, "..", "supabase", "storybook.sql"), "utf8");

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
    console.log("✅ storybook migration applied (tables, bucket, settings)");
    const { rows } = await client.query(
      "select key from public.admin_settings where key like 'storybook_%' or key like 'storyverse_%' order by key",
    );
    console.log("Settings:", rows.map((r) => r.key).join(", "));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
