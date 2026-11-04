import { ArrowUpRight, Download } from "lucide-react";
import { getDb } from "@/lib/db";
import { adminGate } from "@/components/admin-gate";
import { AdminShell, AdminTitle } from "@/components/adminx/shell";
import { adsAdminStats } from "@/lib/ads-admin";
import { Card } from "@/components/ui";
import { timeAgo } from "@/lib/time";

export const metadata = { title: "AdsSim · Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PLATFORM_NAMES: Record<string, string> = { meta: "Meta", tiktok: "TikTok", google: "Google", x: "X", chatgpt: "ChatGPT Ads" };
const EVENT_NAMES: Record<string, string> = {
  view: "Visits",
  signup: "New sign-ups",
  signin: "Returning sign-ins",
  platform_start: "Started a platform",
  campaign_saved: "Saved a campaign",
  days_advanced: "Advanced days",
  reset: "Reset an account",
};

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </Card>
  );
}

// AdsSim (ads.latars.xyz): who signed up, what they do, and their emails.
export default async function AdsAdmin() {
  const gate = await adminGate();
  if (gate) return gate;
  const ads = await adsAdminStats(await getDb());
  return (
    <AdminShell project="ads" section="ads">
      <AdminTitle title="AdsSim" sub="ads.latars.xyz: sign-ups, saved progress and what people do." />
      <section aria-labelledby="ads-h">
        <div className="mb-3 flex items-center justify-between">
          <span id="ads-h" className="sr-only">AdsSim</span>
          <div className="flex gap-2 text-sm font-semibold">
            <a href="https://ads.latars.xyz" target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 hover:border-ink/30">Open site <ArrowUpRight size={14} aria-hidden /></a>
            <a href="/adminx/ads-users.csv" className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 hover:border-ink/30"><Download size={14} aria-hidden /> Download emails (CSV)</a>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Sign-ups" value={ads.users} />
          <Stat label="New in 7 days" value={ads.newUsers7} />
          <Stat label="New in 30 days" value={ads.newUsers30} />
          <Stat label="With saved progress" value={ads.withProgress} />
          <Stat label="Visitors, 30 days" value={ads.visitors30} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="font-extrabold">Activity, last 30 days</h3>
            {ads.events30.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No events yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line text-sm">
                {ads.events30.map((e) => (
                  <li key={e.name} className="flex justify-between py-1.5"><span>{EVENT_NAMES[e.name] ?? e.name}</span><span className="font-semibold tabular-nums">{e.n}</span></li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <h3 className="font-extrabold">Platforms started, last 30 days</h3>
            {ads.platforms30.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No platforms started yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line text-sm">
                {ads.platforms30.map((p) => (
                  <li key={p.platform} className="flex justify-between py-1.5"><span>{PLATFORM_NAMES[p.platform] ?? p.platform}</span><span className="font-semibold tabular-nums">{p.n}</span></li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="mt-4 overflow-x-auto p-5">
          <h3 className="font-extrabold">Latest sign-ups</h3>
          {ads.recent.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nobody has signed up yet.</p>
          ) : (
            <table className="mt-2 w-full text-left text-sm">
              <thead className="text-muted"><tr><th className="py-1.5 pr-3 font-semibold">Email</th><th className="pr-3 font-semibold">Name</th><th className="pr-3 font-semibold">Signed up</th><th className="pr-3 font-semibold">Last seen</th><th className="font-semibold">Progress</th></tr></thead>
              <tbody className="divide-y divide-line">
                {ads.recent.map((u) => (
                  <tr key={u.id}>
                    <td className="py-1.5 pr-3">{u.email}</td>
                    <td className="pr-3">{u.name ?? ""}</td>
                    <td className="pr-3 whitespace-nowrap">{timeAgo(new Date(u.created_at))}</td>
                    <td className="pr-3 whitespace-nowrap">{timeAgo(new Date(u.last_seen_at))}</td>
                    <td>{u.has_progress ? "Saved" : "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>
    </AdminShell>
  );
}
