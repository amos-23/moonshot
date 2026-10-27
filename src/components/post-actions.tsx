"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Loader2, ThumbsUp, UserPlus } from "lucide-react";
import { inviteAuthorAction, markPostAction } from "@/lib/actions/social";
import { buttonClass, cx } from "./ui";

export function PostActions({ postId, mark, signedIn }: { postId: string; mark: string | null; signedIn: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  if (!signedIn) return null;

  const run = (m: "relevant" | "dismissed" | "clear") =>
    start(async () => {
      const r = await markPostAction(postId, m);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });

  const invite = () => {
    // Open the window synchronously so popup blockers allow it, then point it at the intent URL.
    const w = window.open("about:blank", "_blank");
    start(async () => {
      const r = await inviteAuthorAction(postId);
      if (r.ok) {
        const url = (r.data as { url: string }).url;
        if (w) {
          w.opener = null;
          w.location.href = url;
        } else window.location.href = url;
      } else {
        w?.close();
        setError(r.error);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        aria-pressed={mark === "relevant"}
        onClick={() => run(mark === "relevant" ? "clear" : "relevant")}
        className={buttonClass("secondary", "sm", cx(mark === "relevant" && "border-accent bg-accent-50 text-accent"))}
      >
        <ThumbsUp size={14} aria-hidden /> {mark === "relevant" ? "Marked relevant" : "Relevant"}
      </button>
      <button type="button" disabled={pending} onClick={() => run(mark === "dismissed" ? "clear" : "dismissed")} className={buttonClass("ghost", "sm")}>
        <EyeOff size={14} aria-hidden /> {mark === "dismissed" ? "Restore" : "Dismiss"}
      </button>
      <button type="button" disabled={pending} onClick={invite} className={buttonClass("ghost", "sm")} title="Opens X with a reply you can review before posting">
        <UserPlus size={14} aria-hidden /> Invite author
      </button>
      {pending && <Loader2 size={14} className="animate-spin text-muted" aria-label="Working" />}
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
