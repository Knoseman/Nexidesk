/**
 * Restore a pg_dump backup into the database.
 * Usage: npx tsx scripts/restore-db.ts <path-to-backup.sql.gz>
 */
import { createReadStream } from "fs";
import { createGunzip } from "zlib";
import { spawn } from "child_process";
import { resolve } from "path";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npx tsx scripts/restore-db.ts <path-to-backup.sql.gz>");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const absolute = resolve(file);
console.log(`Restoring ${absolute} to database...`);
console.log("WARNING: This will overwrite existing data. Press Ctrl+C to abort.");

const gunzip = createGunzip();
const psql = spawn("psql", [dbUrl], {
  stdio: ["pipe", "inherit", "inherit"],
});

createReadStream(absolute).pipe(gunzip).pipe(psql.stdin);

psql.on("close", (code) => {
  if (code === 0) {
    console.log("Restore complete.");
  } else {
    console.error(`Restore failed with code ${code}`);
    process.exit(1);
  }
});
