// Leaderboard for "Midnight in the Graveyard".
// Each finished team is saved as its own entry in Netlify Blobs, grouped by class.
import { getStore } from "@netlify/blobs";

const clean = (v, max) =>
  String(v ?? "").replace(/[<>]/g, "").replace(/^[=+\-@]+/, "").trim().slice(0, max);
const toInt = (v, max) => Math.max(0, Math.min(max, parseInt(v, 10) || 0));
const reply = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  const p = new URL(req.url).searchParams;
  const cls = clean(p.get("cls"), 30) || "Class";
  const prefix = encodeURIComponent(cls) + "/";
  const store = getStore({ name: "graveyard-leaderboard", consistency: "strong" });
  const action = p.get("action") || "list";

  if (action === "submit") {
    const id = clean(p.get("id"), 40).replace(/[^a-z0-9]/gi, "");
    if (!id) return reply({ ok: false, error: "missing id" }, 400);
    const key = prefix + id;
    if (!(await store.get(key))) {
      await store.setJSON(key, {
        id,
        team: clean(p.get("team"), 24) || "Team",
        secs: toInt(p.get("secs"), 36000),
        hints: toInt(p.get("hints"), 999),
        stars: toInt(p.get("stars"), 99),
        at: new Date().toISOString(),
      });
    }
  }

  if (action === "reset") {
    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey || p.get("key") !== adminKey) return reply({ ok: false, error: "not allowed" }, 403);
    const { blobs } = await store.list({ prefix });
    await Promise.all(blobs.map((b) => store.delete(b.key)));
    return reply({ ok: true, top: [], cleared: blobs.length });
  }

  const { blobs } = await store.list({ prefix });
  const rows = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))).filter(Boolean);
  rows.sort((a, b) => a.secs - b.secs || b.stars - a.stars);
  return reply({
    ok: true,
    top: rows.slice(0, 10).map(({ id, team, secs, hints, stars }) => ({ id, team, secs, hints, stars })),
  });
};

export const config = { path: "/api/leaderboard" };
