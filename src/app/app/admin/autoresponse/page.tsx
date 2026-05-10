import { redirect } from "next/navigation";
import { auth, requireAdmin } from "@/lib/auth";
import { AutoresponderManager } from "@/components/nexidesk/AutoresponderManager";

export default async function AutoresponsePage() {
  const session = await auth();
  if (!session) redirect("/");

  const admin = await requireAdmin(session);
  if (!admin) redirect("/app/tickets");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b border-zinc-200 px-6 py-4 dark:border-slate-700">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-slate-100">Auto-reply</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-slate-400">
          Automatically send a confirmation email when a new ticket is received.
          Use{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs dark:bg-slate-800 dark:text-slate-300">
            {"{{ticket.number}}"}
          </code>
          ,{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs dark:bg-slate-800 dark:text-slate-300">
            {"{{ticket.subject}}"}
          </code>
          , and{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs dark:bg-slate-800 dark:text-slate-300">
            {"{{requester.name}}"}
          </code>{" "}
          as template variables.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6 dark:bg-slate-950">
        <AutoresponderManager />
      </div>
    </div>
  );
}
