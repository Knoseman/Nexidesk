import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { agents } from "@/lib/schema";
import { sql } from "drizzle-orm";
import { ProfileEditor } from "@/components/nexidesk/ProfileEditor";
import type { AgentTheme } from "@/lib/schema";

export default async function AccountPage() {
  const session = await auth();
  if (!session) redirect("/");

  const email = session.user?.email?.toLowerCase().trim() ?? null;

  let agentRow: {
    name: string;
    phone: string | null;
    role: string;
    theme: string;
    signatureHtml: string | null;
    labelColorBg: string | null;
    labelColorText: string | null;
  } | null = null;

  if (email) {
    const [row] = await db
      .select({
        name: agents.name,
        phone: agents.phone,
        role: agents.role,
        theme: agents.theme,
        signatureHtml: agents.signatureHtml,
        labelColorBg: agents.labelColorBg,
        labelColorText: agents.labelColorText,
      })
      .from(agents)
      .where(sql`lower(${agents.email}::text) = ${email}`)
      .limit(1);
    agentRow = row ?? null;
  }

  const validTheme = (t: string): AgentTheme =>
    t === "light" || t === "dark" ? t : "auto";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b border-zinc-200 px-6 py-4 dark:border-slate-700">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-slate-100">Account</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-slate-400">
          Manage your profile, contact details, and email signature.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {agentRow ? (
          <div className="max-w-2xl">
            <ProfileEditor
              email={email ?? ""}
              role={agentRow.role}
              initialTheme={validTheme(agentRow.theme)}
              initialName={agentRow.name}
              initialPhone={agentRow.phone}
              initialSignatureHtml={agentRow.signatureHtml}
              initialColorBg={agentRow.labelColorBg}
              initialColorText={agentRow.labelColorText}
            />
          </div>
        ) : (
          <div className="max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
            Your email <strong>{email}</strong> is not in the agent roster.
            Contact your admin.
          </div>
        )}
      </div>
    </div>
  );
}
