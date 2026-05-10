import { redirect } from "next/navigation";
import { auth, requireAdmin } from "@/lib/auth";
import { AgentsManager } from "@/components/nexidesk/AgentsManager";

export default async function AgentsPage() {
  const session = await auth();
  if (!session) redirect("/");

  const admin = await requireAdmin(session);
  if (!admin) redirect("/app/tickets");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b border-zinc-200 px-6 py-4 dark:border-slate-700">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-slate-100">Team</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-slate-400">
          Manage agents who can sign in and handle tickets.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6 dark:bg-slate-950">
        <AgentsManager currentAgentId={admin.id} />
      </div>
    </div>
  );
}
