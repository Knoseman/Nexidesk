import { describe, it, expect } from "vitest";
import { formatDuration } from "@/lib/dashboard-metrics";

// ── formatDuration ───────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("returns em-dash for null", () => {
    expect(formatDuration(null)).toBe("—");
  });

  it("returns em-dash for undefined", () => {
    expect(formatDuration(undefined as any)).toBe("—");
  });

  it("returns em-dash for Infinity", () => {
    expect(formatDuration(Infinity)).toBe("—");
  });

  it("returns em-dash for NaN", () => {
    expect(formatDuration(NaN)).toBe("—");
  });

  it("formats seconds under 60", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(59)).toBe("59s");
  });

  it("formats minutes under 60", () => {
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(300)).toBe("5m");
    expect(formatDuration(3540)).toBe("59m");
  });

  it("formats hours under 24", () => {
    expect(formatDuration(3600)).toBe("1.0h");
    expect(formatDuration(7200)).toBe("2.0h");
    expect(formatDuration(82800)).toBe("23.0h");
  });

  it("formats days", () => {
    expect(formatDuration(86400)).toBe("1.0d");
    expect(formatDuration(172800)).toBe("2.0d");
    expect(formatDuration(604800)).toBe("7.0d");
  });

  it("rounds seconds", () => {
    expect(formatDuration(44.4)).toBe("44s");
    expect(formatDuration(44.6)).toBe("45s");
  });
});

// ── aggregation helpers (pure logic extracted for testability) ───────────────

describe("dashboard aggregation helpers", () => {
  function build14DaySeries(
    rows: Array<{ day: string; count: number }>,
    startOfToday: Date,
  ): Array<{ date: string; count: number }> {
    const seriesByDay = new Map<string, number>();
    for (const r of rows) {
      const key = String(r.day).slice(0, 10);
      seriesByDay.set(key, Number(r.count));
    }
    const created14d: Array<{ date: string; count: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      created14d.push({ date: key, count: seriesByDay.get(key) ?? 0 });
    }
    return created14d;
  }

  function computeAvgMedian(seconds: number[]): {
    avg: number | null;
    median: number | null;
  } {
    const valid = seconds.filter(Number.isFinite);
    if (valid.length === 0) return { avg: null, median: null };
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    const sorted = [...valid].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    return { avg, median };
  }

  function aggregateByAgent(
    rows: Array<{
      agentId: number | null;
      name: string | null;
      status: string;
      count: number;
    }>,
  ): Array<{
    agentId: number | null;
    name: string;
    open: number;
    pending: number;
  }> {
    const buckets = new Map<
      string,
      { agentId: number | null; name: string; open: number; pending: number }
    >();
    for (const row of rows) {
      const key = row.agentId == null ? "unassigned" : String(row.agentId);
      const entry = buckets.get(key) ?? {
        agentId: row.agentId ?? null,
        name: row.name ?? (row.agentId == null ? "Unassigned" : "Unknown"),
        open: 0,
        pending: 0,
      };
      if (row.status === "pending") {
        entry.pending += row.count;
      } else {
        entry.open += row.count;
      }
      buckets.set(key, entry);
    }
    return [...buckets.values()].sort(
      (a, b) => b.open + b.pending - (a.open + a.pending),
    );
  }

  it("14-day series fills gaps with zero", () => {
    const today = new Date("2026-05-24T00:00:00Z");
    const rows = [{ day: "2026-05-22", count: 5 }];
    const series = build14DaySeries(rows, today);
    expect(series).toHaveLength(14);
    expect(series[13]).toEqual({ date: "2026-05-24", count: 0 });
    expect(series[11]).toEqual({ date: "2026-05-22", count: 5 });
  });

  it("14-day series sorts ascending", () => {
    const today = new Date("2026-05-24T00:00:00Z");
    const series = build14DaySeries([], today);
    expect(series[0].date).toBe("2026-05-11");
    expect(series[13].date).toBe("2026-05-24");
  });

  it("computes avg and median for odd sample", () => {
    const { avg, median } = computeAvgMedian([10, 20, 30]);
    expect(avg).toBe(20);
    expect(median).toBe(20);
  });

  it("computes avg and median for even sample", () => {
    const { avg, median } = computeAvgMedian([10, 20, 30, 40]);
    expect(avg).toBe(25);
    expect(median).toBe(25);
  });

  it("returns null for empty sample", () => {
    const { avg, median } = computeAvgMedian([]);
    expect(avg).toBeNull();
    expect(median).toBeNull();
  });

  it("filters out Infinity/NaN", () => {
    const { avg, median } = computeAvgMedian([10, Infinity, NaN, 30]);
    expect(avg).toBe(20);
    expect(median).toBe(20);
  });

  it("aggregates per-agent open+pending", () => {
    const rows = [
      { agentId: 1, name: "Alice", status: "open", count: 3 },
      { agentId: 1, name: "Alice", status: "pending", count: 2 },
      { agentId: 2, name: "Bob", status: "open", count: 6 },
    ];
    const result = aggregateByAgent(rows);
    expect(result).toHaveLength(2);
    // Bob has higher total (6 vs 5) so he sorts first
    expect(result[0]).toEqual({ agentId: 2, name: "Bob", open: 6, pending: 0 });
    expect(result[1]).toEqual({
      agentId: 1,
      name: "Alice",
      open: 3,
      pending: 2,
    });
  });

  it("handles unassigned agents", () => {
    const rows = [
      { agentId: null, name: null, status: "open", count: 4 },
      { agentId: null, name: null, status: "pending", count: 1 },
    ];
    const result = aggregateByAgent(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      agentId: null,
      name: "Unassigned",
      open: 4,
      pending: 1,
    });
  });

  it("sorts by total load descending", () => {
    const rows = [
      { agentId: 1, name: "Alice", status: "open", count: 1 },
      { agentId: 2, name: "Bob", status: "open", count: 10 },
    ];
    const result = aggregateByAgent(rows);
    expect(result[0].name).toBe("Bob");
    expect(result[1].name).toBe("Alice");
  });
});
