import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

  console.log('Applying Agent Color delta...');

  try {
    await sql.begin(async (tx) => {
      await tx`
        ALTER TABLE "agents"
        ADD COLUMN IF NOT EXISTS "label_color_bg" text,
        ADD COLUMN IF NOT EXISTS "label_color_text" text
      `;
      console.log('Columns added to "agents".');
    });
    console.log('Agent Color delta applied successfully.');
  } catch (e) {
    console.error('Failed to apply delta:', e);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
