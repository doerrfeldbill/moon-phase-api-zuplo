import type { ZuploContext, ZuploRequest } from "@zuplo/runtime";

/**
 * NOTE: This is intentionally "good enough for demo".
 * If you want astronomical accuracy, swap the fallback for a real ephemeris library or upstream API.
 */

type PhaseName =
  | "New Moon"
  | "Waxing Crescent"
  | "First Quarter"
  | "Waxing Gibbous"
  | "Full Moon"
  | "Waning Gibbous"
  | "Last Quarter"
  | "Waning Crescent";

type PhaseResult = {
  date: string;              // YYYY-MM-DD
  phase: PhaseName;
  phaseIndex: number;        // 0..7
  illumination: number;      // 0..1 (approx)
  emoji: string;
  source: "dummy" | "approx";
  attribution?: string;
  planHint?: string;         // example metadata-driven messaging
};

// A few dummy “known” values (replace with whatever you want).
const DUMMY: Record<string, Omit<PhaseResult, "date">> = {
  "2026-03-06": {
    phase: "Waning Crescent",
    phaseIndex: 7,
    illumination: 0.18,
    emoji: "🌘",
    source: "dummy",
    attribution: "Demo dataset"
  },
  "2026-03-21": {
    phase: "First Quarter",
    phaseIndex: 2,
    illumination: 0.5,
    emoji: "🌓",
    source: "dummy",
    attribution: "Demo dataset"
  }
};

const PHASES: { name: PhaseName; emoji: string }[] = [
  { name: "New Moon", emoji: "🌑" },
  { name: "Waxing Crescent", emoji: "🌒" },
  { name: "First Quarter", emoji: "🌓" },
  { name: "Waxing Gibbous", emoji: "🌔" },
  { name: "Full Moon", emoji: "🌕" },
  { name: "Waning Gibbous", emoji: "🌖" },
  { name: "Last Quarter", emoji: "🌗" },
  { name: "Waning Crescent", emoji: "🌘" }
];

// Reference new moon (UTC-ish). Used only for approximation.
// 2000-01-06 is a commonly used reference point in simple calculators.
const REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);
const SYNODIC_MONTH_DAYS = 29.530588853;

function yyyyMmDd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateParam(value: string | null): { ok: true; date: Date } | { ok: false; error: string } {
  if (!value) return { ok: true, date: new Date() }; // default today
  // Strict-ish YYYY-MM-DD check
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, error: "Invalid date format. Use YYYY-MM-DD." };
  }
  const [y, m, d] = value.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)); // mid-day UTC avoids DST edges
  if (Number.isNaN(dt.getTime())) return { ok: false, error: "Invalid date." };
  // Validate round-trip
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return { ok: false, error: "Invalid date." };
  }
  return { ok: true, date: dt };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function approxMoonPhase(date: Date): Omit<PhaseResult, "date"> {
  const msSinceRef = date.getTime() - REF_NEW_MOON;
  const daysSinceRef = msSinceRef / (1000 * 60 * 60 * 24);
  const lunations = daysSinceRef / SYNODIC_MONTH_DAYS;

  // Normalize 0..1 through the cycle
  const cycle = ((lunations % 1) + 1) % 1;

  // 8 bins (0..7)
  const phaseIndex = Math.floor(cycle * 8) % 8;
  const phase = PHASES[phaseIndex];

  // Very rough illumination curve (sinusoid).
  // 0 at new (cycle 0), 1 at full (cycle 0.5)
  const illumination = clamp01(0.5 - 0.5 * Math.cos(2 * Math.PI * cycle));

  return {
    phase: phase.name,
    phaseIndex,
    illumination: Number(illumination.toFixed(3)),
    emoji: phase.emoji,
    source: "approx",
    attribution: "Simple synodic-month approximation (demo)"
  };
}

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init?.headers
    }
  });
}

export async function health(_req: ZuploRequest, _ctx: ZuploContext): Promise<Response> {
  return json({ ok: true, service: "moon-phase-api", ts: new Date().toISOString() });
}

function buildResult(dateStr: string, req: ZuploRequest): PhaseResult {
  const dummy = DUMMY[dateStr];
  const base: Omit<PhaseResult, "date"> = dummy ?? approxMoonPhase(new Date(dateStr + "T12:00:00Z"));

  // Example: show how you *could* use Zuplo API key metadata for tiering messaging
  // (e.g. request.user.data.plan = "free" | "pro").
  const plan = (req as any).user?.data?.plan as string | undefined;

  return {
    date: dateStr,
    ...base,
    planHint: plan ? `Detected plan metadata: ${plan}` : undefined
  };
}

export async function getMoonPhase(request: ZuploRequest, _ctx: ZuploContext): Promise<Response> {
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const parsed = parseDateParam(dateParam);

  if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });

  const dateStr = yyyyMmDd(parsed.date);
  return json(buildResult(dateStr, request));
}

export async function getMoonPhaseToday(request: ZuploRequest, _ctx: ZuploContext): Promise<Response> {
  const dateStr = yyyyMmDd(new Date());
  return json(buildResult(dateStr, request));
}

export async function getMoonPhaseByPath(request: ZuploRequest, _ctx: ZuploContext): Promise<Response> {
  const dateParam = (request as any).params?.date as string | undefined;
  const parsed = parseDateParam(dateParam ?? null);

  if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });

  const dateStr = yyyyMmDd(parsed.date);
  return json(buildResult(dateStr, request));
}

export async function getMoonCalendar(request: ZuploRequest, _ctx: ZuploContext): Promise<Response> {
  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month"); // YYYY-MM
  const now = new Date();
  const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const month = monthParam ?? defaultMonth;
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return json({ error: "Invalid month format. Use YYYY-MM." }, { status: 400 });
  }

  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
  if (Number.isNaN(first.getTime())) return json({ error: "Invalid month." }, { status: 400 });

  // last day: day 0 of next month
  const last = new Date(Date.UTC(y, m, 0, 12, 0, 0));
  const daysInMonth = last.getUTCDate();

  const days: PhaseResult[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const dateStr = yyyyMmDd(dt);
    days.push(buildResult(dateStr, request));
  }

  return json({
    month,
    daysInMonth,
    days
  });
}
