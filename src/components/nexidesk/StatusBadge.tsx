import type { TicketStatus } from '@/types/ticket';

interface StatusBadgeProps {
  status: TicketStatus;
  size?: 'sm' | 'md';
}

const CONFIG: Record<TicketStatus, { label: string; bg: string; text: string; dot: string }> = {
  new:      { label: 'New',      bg: 'bg-violet-100 dark:bg-violet-950/40',  text: 'text-violet-700 dark:text-violet-400',  dot: 'bg-violet-500 dark:bg-violet-400'  },
  open:     { label: 'Open',     bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500 dark:bg-emerald-400' },
  pending:  { label: 'Pending',  bg: 'bg-amber-100 dark:bg-amber-950/40',   text: 'text-amber-700 dark:text-amber-400',   dot: 'bg-amber-500 dark:bg-amber-400'   },
  resolved: { label: 'Resolved', bg: 'bg-blue-100 dark:bg-blue-950/40',    text: 'text-blue-700 dark:text-blue-400',    dot: 'bg-blue-500 dark:bg-blue-400'    },
  closed:   { label: 'Closed',   bg: 'bg-slate-100 dark:bg-slate-800',   text: 'text-slate-500 dark:text-slate-400',   dot: 'bg-slate-400 dark:bg-slate-500'   },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const c = CONFIG[status] ?? CONFIG.open;
  const sz = size === 'sm' ? 'px-2 py-0.5 text-[11px] gap-1' : 'px-2.5 py-1 text-[12px] gap-1.5';
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${c.bg} ${c.text} ${sz}`}>
      <span className={`rounded-full flex-shrink-0 ${c.dot} ${size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'}`} />
      {c.label}
    </span>
  );
}
