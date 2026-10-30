"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function send(data: Record<string, string | number | boolean | undefined>) {
  const body = JSON.stringify(data);
  if (navigator.sendBeacon?.(`/api/track`, new Blob([body], { type: "application/json" }))) return;
  fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
}

/** Records a click-like moment that isn't a click (a video starting, swiping to the next moment). */
export function track(target: string, targetId?: string) {
  if (typeof window === "undefined" || window.location.pathname.startsWith("/admin")) return;
  send({ type: "click", path: window.location.pathname, target, targetId });
}

/** Whether this browser has been here before. Only a yes/no is kept on the device, never an id. */
function seenBefore(): boolean {
  try {
    const seen = localStorage.getItem("mc_seen") === "1";
    if (!seen) localStorage.setItem("mc_seen", "1");
    return seen;
  } catch {
    return false;
  }
}

/** The campaign a visitor arrived from, e.g. ?utm_source=x&utm_campaign=recap → "x/recap". */
function campaign(): string | undefined {
  const q = new URLSearchParams(window.location.search);
  const src = q.get("utm_source") ?? q.get("ref");
  if (!src) return undefined;
  const c = q.get("utm_campaign");
  return c ? `${src}/${c}` : src;
}

/**
 * Sends a page view on every navigation (with device, campaign and new/returning), how long each page
 * was on screen when you leave it, and a click for any element marked with data-track.
 */
export function Tracker() {
  const path = usePathname();

  useEffect(() => {
    if (path.startsWith("/admin")) return;
    send({ type: "view", path, ref: document.referrer, campaign: campaign(), returning: seenBefore() });
    // Time on page counts only while the tab is visible.
    let visibleSince: number | null = document.visibilityState === "visible" ? Date.now() : null;
    let total = 0;
    const pause = () => {
      if (visibleSince !== null) total += Date.now() - visibleSince;
      visibleSince = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") visibleSince = Date.now();
      else {
        pause();
        flush();
      }
    };
    // Sends the visible time so far (when the tab is hidden, the page closes or you move on); the
    // stats add up every piece, so coming back to a tab keeps counting.
    const flush = () => {
      pause();
      if (total >= 1000) send({ type: "leave", path, ms: Math.min(total, 30 * 60_000) });
      total = 0;
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush(); // navigating to another page in the app
    };
  }, [path]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-track]");
      if (!el || window.location.pathname.startsWith("/admin")) return;
      send({ type: "click", path: window.location.pathname, target: el.dataset.track, targetId: el.dataset.trackId });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
