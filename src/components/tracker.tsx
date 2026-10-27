"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function send(data: Record<string, string | undefined>) {
  const body = JSON.stringify(data);
  if (navigator.sendBeacon?.(`/api/track`, new Blob([body], { type: "application/json" }))) return;
  fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
}

/** Sends a page view on every navigation, and a click for any element marked with data-track. */
export function Tracker() {
  const path = usePathname();
  useEffect(() => {
    if (path.startsWith("/admin")) return;
    send({ type: "view", path, ref: document.referrer });
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
