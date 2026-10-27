import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "About & privacy" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title="About Moonshot Connect" />
      <Card className="space-y-4 p-6 text-sm leading-relaxed">
        <p>
          Moonshot Connect is an <strong>independent prototype</strong> that helps people interested in Moonshot by TechCabal find each other
          and arrange conversations. It is not affiliated with, endorsed by, or operated by TechCabal.
        </p>
        <h2 className="text-base font-semibold">How recommendations work</h2>
        <p>
          Recommendations use a transparent, rule-based score — no AI. Points come from shared interests, goals that match what someone offers
          (for example, you want to meet investors and they offer investment), complementary goals in the other direction, the same industry or
          city, and both attending in person. Every recommendation shows the reasons behind it.
        </p>
        <h2 className="text-base font-semibold">Your privacy</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your email address is never shown to other users.</li>
          <li>You choose whether your profile is public, members-only, or hidden from discovery.</li>
          <li>You choose who can send you connection requests. Messaging is only possible after you accept a request.</li>
          <li>Your social and website links are only shown to accepted connections, and only if you allow it.</li>
          <li>Private notes are visible only to you. Blocking someone hides you from each other and ends any connection.</li>
          <li>Messages are private between participants. Moderators only see a message if a participant reports it.</li>
        </ul>
        <h2 className="text-base font-semibold">Public posts from X</h2>
        <p>
          The Conversation page lists public posts about Moonshot that were added by URL or found through the official X API. Each post links to
          the original and shows its author and source. We don&apos;t scrape X, we don&apos;t create profiles for post authors, and we never invent
          posts. Authors can be invited to opt in. To have a post removed, report it from the Conversation page.
        </p>
        <h2 className="text-base font-semibold">Verification</h2>
        <p>Attendance is self-reported. A “ticket verified” badge only appears if an administrator has actually verified it.</p>
      </Card>
    </div>
  );
}
