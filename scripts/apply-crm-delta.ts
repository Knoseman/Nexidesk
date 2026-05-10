import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

  console.log('Applying CRM delta...');

  try {
    await sql.begin(async (tx) => {
      await tx`
        CREATE TABLE IF NOT EXISTS "contacts" (
          "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "email" citext UNIQUE NOT NULL,
          "name" text,
          "phone" text,
          "title" text,
          "company_name" text,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        )
      `;
      console.log('Table "contacts" ensured.');

      await tx`
        ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "requester_id" bigint
      `;
      console.log('Column "requester_id" added to "tickets".');

      // Check if constraint exists before adding
      const [constraint] = await tx`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'tickets' AND constraint_name = 'tickets_requester_id_contacts_id_fk'
      `;

      if (!constraint) {
        await tx`
          ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_id_contacts_id_fk"
          FOREIGN KEY ("requester_id") REFERENCES "contacts"("id")
        `;
        console.log('Foreign key added.');
      }

      await tx`CREATE INDEX IF NOT EXISTS "contacts_email" ON "contacts" ("email")`;
      await tx`CREATE INDEX IF NOT EXISTS "contacts_company" ON "contacts" ("company_name")`;
      console.log('Indexes ensured.');
    });
    console.log('CRM delta applied successfully.');
  } catch (e) {
    console.error('Failed to apply delta:', e);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
