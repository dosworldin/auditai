/**
 * Debug: storybook-assets bucket state + sample seeding status.
 * Run: node scripts/check-storybook-env.js
 * (Reads env from process environment; .env/.env.local are injected by the platform.)
 */
const { createClient } = require("@supabase/supabase-js");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("MISSING_ENV: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
    process.exit(0);
  }
  const c = createClient(url, key);

  const { data: buckets, error } = await c.storage.listBuckets();
  console.log(
    "buckets:",
    buckets?.map((b) => b.id).join(",") ?? "ERR " + (error?.message ?? "")
  );

  const slugs = [
    "luna-and-the-moon-rocket",
    "the-tea-shop-at-the-end-of-the-lane",
    "the-dragon-who-was-scared-of-mornings",
    "grandmas-secret-recipe",
  ];
  for (const slug of slugs) {
    const { data, error } = await c.storage
      .from("storybook-assets")
      .list("samples/" + slug, { limit: 10 });
    console.log(
      slug,
      "->",
      (data ?? []).map((o) => o.name).join(",") || "EMPTY: " + (error?.message ?? "?")
    );
  }

  // Count orders with group/audience values (to see if schema supports them)
  const { count: orderCount, error: oerr } = await c
    .from("storybook_orders")
    .select("id", { count: "exact", head: true });
  console.log("storybook_orders rows:", orderCount ?? "ERR " + (oerr?.message ?? ""));
}

main().catch((e) => {
  console.log("FAILED:", e.message);
  process.exit(0);
});
