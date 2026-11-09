import "server-only";

// Sending email. Production uses Resend's HTTP API (set RESEND_API_KEY, and ADS_MAIL_FROM to an address on a
// domain verified in Resend). Without a key, local work prints the email to the server log instead, and
// production logs that nothing was sent (unless MAIL_TO_LOG=true, for local trials).

export type Mail = { to: string; subject: string; text: string; html: string };

let override: ((m: Mail) => Promise<void>) | null = null;
/** Tests: capture mail instead of sending it. Pass null to go back to normal. */
export function setMailTransport(fn: ((m: Mail) => Promise<void>) | null) {
  override = fn;
}

export const mailFrom = () => process.env.ADS_MAIL_FROM?.trim() || "AdsSim <noreply@latars.xyz>";

/** Sends one email. Returns whether it went out; failures are logged, never thrown. */
export async function sendMail(m: Mail): Promise<boolean> {
  try {
    if (override) {
      await override(m);
      return true;
    }
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) {
      // MAIL_TO_LOG=true prints emails (with their links) to the server log: for trying things out locally only.
      if (process.env.NODE_ENV === "production" && process.env.MAIL_TO_LOG !== "true") {
        console.error("Email not sent: RESEND_API_KEY isn't set.");
        return false;
      }
      console.log(`\n--- email to ${m.to} ---\nSubject: ${m.subject}\n\n${m.text}\n---\n`);
      return true;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: mailFrom(), to: [m.to], subject: m.subject, text: m.text, html: m.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`Email to the mail service failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Email failed:", err instanceof Error ? err.message : err);
    return false;
  }
}
