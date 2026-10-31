"use client";

import { createContext, useContext } from "react";

/** The event a Moments page belongs to, for links and ready-made posts inside the gallery. */
export type GalleryEvent = { slug: string; short: string; name: string; tag: string; dates: string | null; venue: string | null };

export const GalleryEventContext = createContext<GalleryEvent>({ slug: "moonshot", short: "Moonshot", name: "Moonshot", tag: "", dates: null, venue: null });
export const useGalleryEvent = () => useContext(GalleryEventContext);
