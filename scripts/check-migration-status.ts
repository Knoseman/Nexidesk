/**
 * Diagnostic script: compare local migration journal against the database.
 * Run with: npx tsx scripts/check-migration-status.ts
 */
import { config } from "dotenv";
import postgres from "postgres";
import journal from "../drizzle/meta/_journal.json";

config({ path: ".env.local" });
config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not found in environment");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  console.log("=== Local journal entries ===");
  const localTags = journal.entries.map((e: { tag: string }) => e.tag);
  localTags.forEach((t) => console.log(`  ${t}`));

  console.log("\n=== Database journal entries ===");
  let dbTags: string[] = [];
  try {
    const rows = await sql`
      SELECT tag, created_at
      FROM drizzle.__drizzle_migrations
      ORDER BY created_at
    `;
    dbTags = rows.map((r: any) => r.tag);
    rows.forEach((r: any) =>
      console.log(`  ${r.tag}  (${r.created_at.toISOString()})`),
    );
  } catch {
    console.log("  (table drizzle.__drizzle_migrations not found)");
  }

  console.log("\n=== Comparison ===");
  const onlyLocal = localTags.filter((t: string) => !dbTags.includes(t));
  const onlyDb = dbTags.filter((t: string) => !localTags.includes(t));

  if (onlyLocal.length === 0 && onlyDb.length === 0) {
    console.log("✅ Journals are in sync");
  } else {
    if (onlyLocal.length > 0) {
      console.log("⚠️  Migrations in local journal but NOT in DB:");
      onlyLocal.forEach((t: string) => console.log(`    ${t}`));
    }
    if (onlyDb.length > 0) {
      console.log("⚠️  Migrations in DB but NOT in local journal:");
      onlyDb.forEach((t: string) => console.log(`    ${t}`));
    }
  }

  console.log("\n=== Schema check: bcc_emails ===");
  const cols = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_name IN ('messages', 'outbound_queue')
      AND column_name = 'bcc_emails'
  `;
  if (cols.length === 0) {
    console.log("  ❌ bcc_emails NOT found");
  } else {
    cols.forEach((r: any) =>
      console.log(`  ✅ bcc_emails exists on ${r.table_name}`),
    );
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
