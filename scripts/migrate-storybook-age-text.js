/**
 * One-off: add storybook_orders.child_age_text (free-text age/audience).
 * Idempotent. Run: node scripts/migrate-storybook-age-text.js
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

const SQL = `
alter table public.storybook_orders add column if not exists child_age_text text;
`;

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL not set — cannot migrate.");
    process.exit(1);
  }
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(SQL);
    const { rows } = await client.query(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'storybook_orders'
         and column_name = 'child_age_text'`,
    );
    console.log(
      rows.length > 0
        ? "✅ child_age_text column present on storybook_orders"
        : "❌ column missing after migration",
    );
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
