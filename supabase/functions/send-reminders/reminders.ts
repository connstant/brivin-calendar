// Which reminders are due right now. No imports, so it can be tested on its own.
// Items are stored the way the page stores them: dates "YYYY-MM-DD", times "HH:MM" in the item's
// time zone (`tz`), and repeating items as one doc with repeat {days: [0-6, Sun=0], every: N weeks, until}.

export const REMIND_MINS = [15, 30, 60, 1440];
export const LOOKBACK_MS = 3 * 60_000;  // catch up after a late or skipped run, but never send a stale "in 15 minutes"
export const LOOKAHEAD_MS = 30_000;     // a run a few seconds early still counts

export type Item = {
  title?: string; kind?: string; who?: string; start: string; end?: string;
  tStart?: string; tEnd?: string; tz?: string; done?: boolean;
  notify?: boolean; remind?: number[];
  repeat?: { days: number[]; every?: number; until?: string } | null;
  exceptions?: Record<string, boolean>; doneDates?: Record<string, boolean>;
};
export type Due = { key: string; id: string; it: Item; day: string; off: number; at: number };

const pad = (n: number) => String(n).padStart(2, "0");
const dayNum = (s: string) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const fromDayNum = (n: number) => new Date(n * 864e5).toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => fromDayNum(dayNum(s) + n);
const dow = (s: string) => new Date(dayNum(s) * 864e5).getUTCDay();
const mondayOf = (s: string) => addDays(s, -((dow(s) + 6) % 7));

// same rule as the page: weekly on the chosen days, every N weeks counted from the start's Monday
export function seriesHits(s: Item, d: string): boolean {
  const r = s.repeat!;
  if (d < s.start || (r.until && d > r.until) || (s.exceptions && s.exceptions[d])) return false;
  if (!r.days.includes(dow(d))) return false;
  const wk = Math.round((dayNum(mondayOf(d)) - dayNum(mondayOf(s.start))) / 7);
  return wk % (r.every || 1) === 0;
}

export function validTz(tz: unknown): string | null {
  if (typeof tz !== "string" || !tz) return null;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return null; }
}
// minutes the zone is ahead of UTC at that instant
function tzOffsetMin(tz: string, utcMs: number): number {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(utcMs))) p[x.type] = x.value;
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(utcMs / 1000) * 1000) / 60_000;
}
// "2026-11-13" + "18:30" in America/Chicago -> UTC milliseconds
export function localToUtc(day: string, hhmm: string, tz: string): number {
  const [y, m, d] = day.split("-").map(Number), [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - tzOffsetMin(tz, guess) * 60_000;
  t = guess - tzOffsetMin(tz, t) * 60_000; // second pass settles days when the clocks change
  return t;
}

export function dueReminders(items: { id: string; data: Item }[], now: number, fallbackTz: string): Due[] {
  const out: Due[] = [];
  const today = new Date(now).toISOString().slice(0, 10);
  for (const { id, data: it } of items) {
    if (!it || !it.start || it.notify === false) continue;
    if (!it.tStart || !/^\d\d:\d\d$/.test(it.tStart)) continue;
    const tz = validTz(it.tz) || validTz(fallbackTz) || "UTC";
    const offs = [0, ...(Array.isArray(it.remind) ? it.remind.filter(m => REMIND_MINS.includes(m)) : [])];
    const repeating = !!(it.repeat && Array.isArray(it.repeat.days) && it.repeat.days.length);
    // the start day can be up to a day ahead (1-day reminders) or behind, depending on the zone
    for (let k = -2; k <= 2; k++) {
      const day = addDays(today, k);
      if (repeating ? !seriesHits(it, day) : day !== it.start) continue;
      if (repeating ? !!(it.doneDates && it.doneDates[day]) : !!it.done) continue; // chore already done
      const startAt = localToUtc(day, it.tStart, tz);
      for (const off of offs) {
        const at = startAt - off * 60_000;
        if (at > now + LOOKAHEAD_MS || at <= now - LOOKBACK_MS) continue;
        // the time is part of the key, so moving an item to a new time sends its reminders again
        out.push({ key: `${id}@${day}T${it.tStart}#${off}`, id, it, day, off, at });
      }
    }
  }
  return out;
}

export function clock(t: string): string {
  const [h, m] = t.split(":").map(Number), ap = h < 12 ? "am" : "pm", h12 = h % 12 || 12;
  return m ? `${h12}:${pad(m)} ${ap}` : `${h12} ${ap}`;
}

export function message(x: Due, names: { a: string; b: string }) {
  const it = x.it, when = clock(it.tStart!) + (it.tEnd ? ` – ${clock(it.tEnd)}` : "");
  const lead = x.off === 0 ? "Starting now" : x.off === 1440 ? "Tomorrow" : x.off === 60 ? "In 1 hour" : `In ${x.off} minutes`;
  const who = it.who === "a" ? names.a : it.who === "b" ? names.b : "";
  return {
    title: (it.kind === "dinner" ? `Dinner: ${it.title || ""}` : it.title || "Our Week").slice(0, 120),
    body: [`${lead} · ${when}`, who].filter(Boolean).join(" · "),
    tag: `${x.id}@${x.day}`,
    day: x.day,
  };
}

// a device set to one person still hears about shared ("both") items
export const wants = (subWho: string, itemWho?: string) => subWho === "all" || !itemWho || itemWho === "both" || itemWho === subWho;
