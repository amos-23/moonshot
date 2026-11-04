"use client";

import { useEffect } from "react";

/**
 * Share links (/m/…, /p/…) exist for their link previews. People who open one go straight on to the
 * real page, keeping the utm tags so Stats can credit the share.
 */
export function GoTo({ path, hash }: { path: string; hash?: string }) {
  useEffect(() => {
    const go = () => {
      const q = new URLSearchParams(window.location.search);
      const target = new URL(path, window.location.origin);
      q.forEach((v, k) => target.searchParams.set(k, v));
      window.location.replace(`${target.pathname}${target.search}${hash ? `#${hash}` : ""}`);
    };
    // Wait for the page to finish loading first: leaving while it's still streaming in makes React report an
    // unfinished render (error #419).
    if (document.readyState === "complete") go();
    else {
      window.addEventListener("load", go, { once: true });
      return () => window.removeEventListener("load", go);
    }
  }, [path, hash]);
  return null;
}
