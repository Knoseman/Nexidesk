import { SnippetsManager } from '@/components/nexidesk/SnippetsManager';

export default function SnippetsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b border-zinc-200 px-6 py-4 dark:border-slate-700">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-slate-100">Snippets</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-slate-400">Manage reusable reply templates.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6 bg-zinc-50/50 dark:bg-slate-950">
        <SnippetsManager />
      </div>
    </div>
  );
}
