import { redirect } from "next/navigation";
import { auth, requireAdmin } from "@/lib/auth";
import { TagsManager } from "@/components/nexidesk/TagsManager";

export default async function TagsPage() {
  const session = await auth();
  if (!session) redirect("/");

  const admin = await requireAdmin(session);
  if (!admin) redirect("/app/tickets");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b border-zinc-200 px-6 py-4 dark:border-slate-700">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-slate-100">Tags</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-slate-400">
          Create and manage tags. Drag rows or use the arrows to set the order
          agents see when adding tags to a ticket.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6 dark:bg-slate-950">
        <TagsManager />
      </div>
    </div>
  );
}
