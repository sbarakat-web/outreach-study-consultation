import { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Consultation } from "../../lib/types";
import { Alert, Card, Spinner } from "../../components/ui";

type Row = Consultation & { documents?: { count: number }[] };

const RANGES = [
  { key: "week", label: "This week", days: 7 },
  { key: "month", label: "Last 30 days", days: 30 },
  { key: "quarter", label: "Last 90 days", days: 90 },
] as const;

const APPLIED = ["application_submitted", "offer_received", "payment", "visa_process", "enrolled"];
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

/** Online-session results: volume, show rate, funnel, by adviser and by programme. */
export function SessionsDashboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("month");

  useEffect(() => {
    supabase
      .from("consultations")
      .select("*, documents(count)")
      .not("session_outcome", "is", null)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setRows((data as Row[]) ?? []);
      });
  }, []);

  const stats = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    const since = Date.now() - days * 86_400_000;
    const list = (rows ?? []).filter((c) => c.session_outcome_at && new Date(c.session_outcome_at).getTime() >= since);
    const interviewed = list.filter((c) => c.session_outcome === "interviewed");
    const noShow = list.filter((c) => c.session_outcome === "no_attendance");
    const withDocs = interviewed.filter((c) => (c.documents?.[0]?.count ?? 0) > 0);
    const applied = interviewed.filter((c) => APPLIED.includes(c.status));
    const rated = interviewed.filter((c) => c.session_rating);

    const group = (key: (c: Row) => string) => {
      const map = new Map<string, Row[]>();
      for (const c of list) map.set(key(c), [...(map.get(key(c)) ?? []), c]);
      return [...map.entries()]
        .map(([name, cs]) => {
          const iv = cs.filter((c) => c.session_outcome === "interviewed");
          const ns = cs.filter((c) => c.session_outcome === "no_attendance").length;
          const r = iv.filter((c) => c.session_rating);
          return {
            name,
            sessions: cs.length,
            interviewed: iv.length,
            noShow: ns,
            showRate: pct(iv.length, iv.length + ns),
            docs: pct(iv.filter((c) => (c.documents?.[0]?.count ?? 0) > 0).length, iv.length),
            applied: iv.filter((c) => APPLIED.includes(c.status)).length,
            rating: r.length ? (r.reduce((n, c) => n + c.session_rating!, 0) / r.length).toFixed(1) : "—",
          };
        })
        .sort((a, b) => b.sessions - a.sessions);
    };

    return {
      total: list.length,
      interviewed: interviewed.length,
      noShow: noShow.length,
      showRate: pct(interviewed.length, interviewed.length + noShow.length),
      withDocs: withDocs.length,
      applied: applied.length,
      rating: rated.length ? (rated.reduce((n, c) => n + c.session_rating!, 0) / rated.length).toFixed(1) : "—",
      byAdviser: group((c) => c.session_by ?? "Unknown"),
      byProgramme: group((c) => c.desired_course || "Not selected"),
    };
  }, [rows, range]);

  if (!rows) return <Spinner />;

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Online sessions</h1>
        <div role="tablist" className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-slate-200">
          {RANGES.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${range === r.key ? "bg-brand text-white" : "text-navy hover:bg-brand/5"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Sessions", stats.total],
          ["Interviewed", stats.interviewed],
          ["No-shows", stats.noShow],
          ["Show rate", stats.showRate],
          ["Avg. rating", stats.rating],
          ["Applications", stats.applied],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <div className="px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-black text-navy">{value}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="space-y-3 px-5 py-5 sm:px-7">
          <h2 className="text-lg font-black">Funnel</h2>
          {[
            ["Interviewed", stats.interviewed, stats.interviewed],
            ["Uploaded documents", stats.withDocs, stats.interviewed],
            ["Application submitted or further", stats.applied, stats.interviewed],
          ].map(([label, n, of]) => (
            <div key={label as string}>
              <div className="flex justify-between text-sm">
                <span className="font-bold">{label}</span>
                <span className="text-slate-500">
                  {n} · {pct(n as number, of as number)}
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand" style={{ width: (of as number) ? `${((n as number) / (of as number)) * 100}%` : "0%" }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <BreakdownTable title="By presenter" rows={stats.byAdviser} showRating />
      <BreakdownTable title="By programme" rows={stats.byProgramme} />
    </div>
  );
}

function BreakdownTable({
  title,
  rows,
  showRating,
}: {
  title: string;
  rows: { name: string; sessions: number; interviewed: number; noShow: number; showRate: string; docs: string; applied: number; rating: string }[];
  showRating?: boolean;
}) {
  return (
    <Card>
      <div className="px-5 py-5 sm:px-7">
        <h2 className="mb-3 text-lg font-black">{title}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No sessions in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr className="border-b border-slate-100">
                  {["Name", "Sessions", "Interviewed", "No-shows", "Show rate", "Docs uploaded", "Applications", ...(showRating ? ["Rating"] : [])].map((h) => (
                    <th key={h} className="px-2 py-2 font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.name}>
                    <td className="px-2 py-2 font-bold">{r.name}</td>
                    <td className="px-2 py-2">{r.sessions}</td>
                    <td className="px-2 py-2">{r.interviewed}</td>
                    <td className="px-2 py-2">{r.noShow}</td>
                    <td className="px-2 py-2">{r.showRate}</td>
                    <td className="px-2 py-2">{r.docs}</td>
                    <td className="px-2 py-2">{r.applied}</td>
                    {showRating && (
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {r.rating}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
