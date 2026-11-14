// Our Week reminders. Called every minute by pg_cron (supabase/reminders.sql) and sends Web Push
// notifications for timed items that are starting or have a reminder due. The page also calls it
// with {test: true} to send a test notification to one device.
//
// Secrets (Supabase > Edge Functions > Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and optionally
// VAPID_SUBJECT (your site's https:// address or a mailto: address). Deploy with JWT verification off.
import webpush from "npm:web-push@3.6.7";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { dueReminders, message, wants, type Item } from "./reminders.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const VAPID_PUBLIC = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").trim();
const VAPID_PRIVATE = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").trim();
const VAPID_SUBJECT = (Deno.env.get("VAPID_SUBJECT") ?? "").trim() || SUPABASE_URL;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Sub = { endpoint: string; p256dh: string; auth: string; who: string; tz: string };

// true if delivered; drops devices the push service says are gone
async function push(db: SupabaseClient, s: Sub, payload: string): Promise<boolean> {
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: "high" });
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
    else console.error("push failed", code, (e as { body?: string }).body ?? String(e));
    return false;
  }
}

async function runDue(db: SupabaseClient) {
  const now = Date.now();
  const [items, subs, names] = await Promise.all([
    db.from("docs").select("id,data").eq("coll", "items"),
    db.from("push_subscriptions").select("endpoint,p256dh,auth,who,tz"),
    db.from("docs").select("data").eq("coll", "settings").eq("id", "names").maybeSingle(),
  ]);
  if (items.error) throw items.error;
  if (subs.error) throw subs.error;
  const devices = (subs.data ?? []) as Sub[];
  if (!devices.length) return { due: 0, sent: 0, devices: 0 };

  const due = dueReminders((items.data ?? []) as { id: string; data: Item }[], now, devices[0].tz);
  let sent = 0;
  if (due.length) {
    // claim first, so two overlapping runs can't both send the same reminder
    const claim = await db.from("notify_sent").upsert(due.map(x => ({ key: x.key })), { onConflict: "key", ignoreDuplicates: true }).select("key");
    if (claim.error) throw claim.error;
    const mine = new Set((claim.data ?? []).map((r: { key: string }) => r.key));
    const n = (names.data?.data ?? {}) as { a?: string; b?: string };
    const who = { a: n.a || "Him", b: n.b || "Her" };
    for (const x of due) {
      if (!mine.has(x.key)) continue;
      const payload = JSON.stringify(message(x, who));
      for (const s of devices) if (wants(s.who, x.it.who) && await push(db, s, payload)) sent++;
    }
  }
  await db.from("notify_sent").delete().lt("sent_at", new Date(now - 3 * 864e5).toISOString());
  return { due: due.length, sent, devices: devices.length };
}

async function sendTest(req: Request, db: SupabaseClient, endpoint: unknown) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(jwt);
  const email = u?.user?.email?.toLowerCase();
  if (!email) return json({ error: "Your sign-in expired. Reload the page, then try again." });
  const member = await db.from("planner_members").select("email").eq("email", email).maybeSingle();
  if (!member.data) return json({ error: "This login isn't allowed to use the planner." });
  if (typeof endpoint !== "string") return json({ error: "No device given." });
  const s = await db.from("push_subscriptions").select("endpoint,p256dh,auth,who,tz").eq("endpoint", endpoint).maybeSingle();
  if (!s.data) return json({ error: "This device isn't registered. Turn reminders off and on again." });
  const ok = await push(db, s.data as Sub, JSON.stringify({ title: "Our Week", body: "Test reminder: notifications work on this device.", tag: "our-week-test" }));
  return json(ok ? { ok: true } : { error: "The push service refused the test. Turn reminders off and on again; if it keeps happening, check the VAPID keys." });
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!SERVICE_KEY) return json({ error: "The reminder function can't reach the database: its service key is missing." }, 500);
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: "Reminders aren't set up: add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY under Edge Functions > Secrets." }, 500);
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: { test?: boolean; endpoint?: unknown } = {};
  try { body = await req.json(); } catch { /* the timer sends {} */ }
  try {
    if (body.test) return await sendTest(req, db, body.endpoint);
    const sec = await db.from("reminder_secret").select("secret").eq("id", 1).maybeSingle();
    if (!sec.data || req.headers.get("x-cron-secret") !== sec.data.secret) return json({ error: "forbidden" }, 403);
    return json(await runDue(db));
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
