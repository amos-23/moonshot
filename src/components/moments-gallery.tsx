"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Heart, Images, MapPin, MessageCircle, Play, Plus, X } from "lucide-react";
import type { MomentView } from "./moment";
import { ReportLink } from "./client";
import { MomentForm } from "./forms";
import { track } from "./tracker";
import { Avatar, cx } from "./ui";

// Rhythm for the photo wall: varied shapes so it reads like a contact sheet, not a grid of squares.
const SHAPES = ["aspect-[4/5]", "aspect-square", "aspect-[3/4]", "aspect-[5/4]", "aspect-[4/5]", "aspect-[3/4]"];
// Words-only moments get a warm card instead of a photo.
const QUOTE_TONES = ["bg-gradient-to-br from-flame to-sun text-white", "bg-[#1f1d26] text-sun ring-1 ring-white/10", "bg-gradient-to-br from-sun to-[#ffcf73] text-ink"];

function Img({ m, i = 0, className, eager }: { m: MomentView; i?: number; className?: string; eager?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={m.images[i]}
      alt={i === 0 ? (m.text ? m.text.slice(0, 120) : `Photo from ${m.who}`) : `Photo ${i + 1} from ${m.who}`}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy={m.fromXImages ? "no-referrer" : undefined}
      className={className}
    />
  );
}

/**
 * Two rows of photos drifting in opposite directions under the title, slightly tilted. Each row is
 * the list twice over, so sliding it by half loops seamlessly. Hover pauses; a tap opens the photo.
 */
function FilmStrip({ moments, onOpen }: { moments: MomentView[]; onOpen: (id: string) => void }) {
  const pics = moments.filter((m) => m.images.length).slice(0, 16);
  if (pics.length < 4) return null;
  const half = Math.ceil(pics.length / 2);
  const rows = [pics.slice(0, half), pics.slice(half).length >= 2 ? pics.slice(half) : [...pics].reverse()];
  return (
    <div aria-label="Moments in motion" className="film-strip relative -mx-4 mb-8 overflow-hidden py-3 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] sm:mb-10">
      <div className="-rotate-2 scale-[1.06] space-y-3">
        {rows.map((row, r) => (
          <div key={r} className={cx("film-row flex w-max gap-3", r === 1 && "film-row-reverse")} style={{ animationDuration: `${Math.max(28, row.length * 7)}s` }}>
            {[...row, ...row].map((m, i) => {
              const copy = i >= row.length; // the second copy is only there to make the loop seamless
              return (
                <button
                  key={`${m.id}-${i}`}
                  type="button"
                  onClick={() => onOpen(m.id)}
                  tabIndex={copy ? -1 : undefined}
                  aria-hidden={copy || undefined}
                  aria-label={copy ? undefined : label(m)}
                  data-track="moments_strip_open"
                  data-track-id={m.id}
                  className={cx("group relative h-28 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10 sm:h-40", i % 3 === 0 ? "aspect-[4/5]" : i % 3 === 1 ? "aspect-[3/2]" : "aspect-square")}
                >
                  <Img m={m} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                  {m.video && <span aria-hidden className="absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-white"><Play size={11} fill="currentColor" /></span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

const SLIDE_MS = 7000;

/**
 * Featured as a slideshow: each top moment crossfades in with a slow pan-and-zoom, story-style
 * progress bars on top. Swipe or tap a bar to jump; hovering, an open viewer or a hidden tab pauses
 * it; with reduced motion it only moves when asked.
 */
function FeaturedShow({ slides, onOpen, paused }: { slides: MomentView[]; onOpen: (id: string) => void; paused: boolean }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const [still, setStill] = useState(false);
  const touch = useRef<number | null>(null);
  const n = slides.length;
  const go = useCallback((to: number) => setI(((to % n) + n) % n), [n]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onVis = () => setStill(mq.matches || document.visibilityState === "hidden");
    onVis();
    mq.addEventListener("change", onVis);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mq.removeEventListener("change", onVis);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  const running = n > 1 && !paused && !hold && !still;
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => go(i + 1), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [running, i, go]);

  const m = slides[i];
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured moments"
      className="moment-rise relative mb-4 overflow-hidden rounded-[28px] bg-white/5 ring-1 ring-white/10 sm:mb-6"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="relative aspect-[4/5] sm:aspect-[21/9]">
        {slides.map((s, k) => (
          <a
            key={s.id}
            href={`#m-${s.id}`}
            onClick={(e) => (e.preventDefault(), onOpen(s.id))}
            data-track="moments_featured"
            data-track-id={s.id}
            aria-label={label(s)}
            aria-hidden={k !== i || undefined}
            tabIndex={k === i ? undefined : -1}
            className={cx("group absolute inset-0 block transition-opacity duration-[1200ms] ease-out", k === i ? "z-[1] opacity-100" : "pointer-events-none opacity-0")}
          >
            {s.images.length ? (
              // Re-keyed when it becomes the current slide, so the pan-and-zoom starts fresh each time.
              <Img key={k === i ? `on-${i}` : "off"} m={s} eager={k === 0} className={cx("h-full w-full object-cover", k === i && "ken-burns")} />
            ) : (
              // A pinned words-only moment: a big warm quote card instead of a photo.
              <span aria-hidden className="block h-full w-full bg-gradient-to-br from-flame via-[#ef6a2c] to-sun" />
            )}
            <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            {s.video && <PlayBadge gif={s.video.gif} big />}
          </a>
        ))}
      </div>

      {n > 1 && (
        <div className="absolute inset-x-4 top-4 z-[2] flex gap-1.5 sm:inset-x-8 sm:top-6">
          {slides.map((s, k) => (
            <button key={s.id} type="button" onClick={() => go(k)} aria-label={`Show featured moment ${k + 1} of ${n}`} aria-current={k === i || undefined} className="group h-6 flex-1 py-2.5">
              <span className="block h-1 overflow-hidden rounded-full bg-white/25">
                <span
                  key={k === i ? `run-${i}` : "idle"}
                  className={cx("block h-full rounded-full bg-white", k < i && "w-full", k > i && "w-0", k === i && (running ? "featured-progress" : "w-full opacity-70"))}
                  style={k === i ? { animationDuration: `${SLIDE_MS}ms` } : undefined}
                />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* The caption sits outside the links so screen readers hear it once, for the current slide. */}
      <div key={m.id} aria-live={running ? "off" : "polite"} className="moment-fade pointer-events-none absolute inset-x-0 bottom-0 z-[2] p-5 text-left sm:p-8">
        <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur">
          Featured{n > 1 && <span className="font-semibold tracking-normal text-white/70">{i + 1}/{n}</span>}
        </span>
        {m.text && <span className="line-clamp-3 block max-w-2xl text-lg font-semibold leading-snug text-white sm:text-2xl">{m.text}</span>}
        <span className="mt-2 block text-sm text-white/70">
          {m.xUrl ? "𝕏 " : ""}
          {m.who} · {m.ago}
          {m.likes > 0 && ` · ♥ ${m.likes.toLocaleString()}`}
        </span>
      </div>

      {n > 1 && (
        <>
          <button type="button" onClick={() => go(i - 1)} aria-label="Previous featured moment" className="absolute left-3 top-1/2 z-[2] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur hover:bg-black/55 sm:grid">
            <ChevronLeft size={22} aria-hidden />
          </button>
          <button type="button" onClick={() => go(i + 1)} aria-label="Next featured moment" className="absolute right-3 top-1/2 z-[2] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur hover:bg-black/55 sm:grid">
            <ChevronRight size={22} aria-hidden />
          </button>
        </>
      )}
    </section>
  );
}

/** Tiles rise into place as they scroll into view (those already on screen show straight away). */
function useReveal<T extends HTMLElement>(deps: unknown) {
  const root = useRef<T>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]:not(.in)"));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("in");
          io.unobserve(e.target);
        }),
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const item of items) {
      if (item.getBoundingClientRect().top < window.innerHeight) item.classList.add("in");
      else io.observe(item);
    }
    el.classList.add("motion-ready");
    return () => io.disconnect();
  }, [deps]);
  return root;
}

function PlayBadge({ gif, big }: { gif: boolean; big?: boolean }) {
  if (gif) return null;
  return (
    <span aria-hidden className={cx("absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/30 backdrop-blur-md transition group-hover:scale-110", big ? "h-20 w-20" : "h-12 w-12")}>
      <Play size={big ? 30 : 20} fill="currentColor" className="translate-x-0.5" />
    </span>
  );
}

/** An X video in the viewer: starts muted (browsers only autoplay muted), tap for sound. Falls back to the still. */
function MomentVideo({ m }: { m: MomentView }) {
  const [failed, setFailed] = useState(false);
  const played = useRef(false);
  const v = m.video!;
  if (failed) return <Img m={m} eager className="moment-fade max-h-full max-w-full rounded-2xl object-contain" />;
  const small = typeof window !== "undefined" && window.innerWidth < 640;
  return (
    <video
      key={m.id}
      src={small ? v.small : v.src}
      poster={m.images[0]}
      autoPlay
      muted
      playsInline
      loop={v.gif}
      controls={!v.gif}
      preload="metadata"
      onError={() => setFailed(true)}
      onPlaying={() => {
        if (played.current) return;
        played.current = true;
        track(v.gif ? "gif_play" : "video_play", m.id);
      }}
      aria-label={v.gif ? `GIF from ${m.who}` : `Video from ${m.who}`}
      className="moment-fade max-h-full max-w-full rounded-2xl bg-black shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
    />
  );
}

const label = (m: MomentView) => {
  const words = m.note ?? m.text;
  return `Open moment from ${m.who}${words ? `: ${words.slice(0, 80)}` : ""}`;
};

/** The whole Moments experience: featured moment, photo wall, full-screen viewer and the share sheet. */
export function MomentsGallery({ moments, featured, myName, shareOpen, posted, total }: { moments: MomentView[]; featured: MomentView[]; myName: string | null; shareOpen: boolean; posted?: string; total: number }) {
  // The wall shows every moment; the slideshow re-shows the best of them up top. The viewer walks
  // through the wall in order (featured moments from older pages are added in front).
  const { wall, ordered } = useMemo(() => {
    const onWall = new Set(moments.map((m) => m.id));
    return { wall: moments, ordered: [...featured.filter((f) => !onWall.has(f.id)), ...moments] };
  }, [moments, featured]);
  // Tracked by id, so a refreshed list (e.g. after a report hides a moment) never shows the wrong one.
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? ordered.findIndex((m) => m.id === openId) : -1;
  const [sharing, setSharing] = useState(shareOpen);
  // Each post comes back with a new ?posted=…, which closes the sheet.
  useEffect(() => {
    if (posted) setSharing(false);
  }, [posted]);
  // The floating "+" only shows once the big "Add your moment" button has scrolled away.
  const heroCta = useRef<HTMLButtonElement>(null);
  const [fab, setFab] = useState(false);
  useEffect(() => {
    const el = heroCta.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setFab(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const show = useCallback(
    (i: number | null) => {
      const id = i === null ? null : ordered[i].id;
      setOpenId(id);
      history.replaceState(null, "", id ? `#m-${id}` : location.pathname + location.search);
    },
    [ordered],
  );

  // A link to /moments#m-<id> (from the homepage highlights) opens that moment straight away.
  useEffect(() => {
    const id = location.hash.match(/^#m-(.+)$/)?.[1];
    if (id && ordered.some((m) => m.id === id)) setOpenId(id);
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wallRef = useReveal<HTMLUListElement>(wall);
  const openById = (id: string) => show(ordered.findIndex((m) => m.id === id));

  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[520px] max-w-4xl rounded-full bg-[radial-gradient(closest-side,rgba(232,80,42,0.45),rgba(246,168,33,0.12)_55%,transparent)] blur-2xl" />
        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-12 text-center sm:pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-sun">Moonshot 2026 · Lagos</p>
          <h1 className="mt-3 bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-6xl font-black uppercase leading-[0.9] tracking-tight text-transparent sm:text-8xl">Moments</h1>
          <p className="mx-auto mt-4 max-w-md text-white/70">Photos and highlights from two days at the National Theatre, shared by the people who were there.</p>
          {total > 0 && (
            <p className="mt-4 text-sm text-white/50">
              {total} moment{total === 1 ? "" : "s"} shared
            </p>
          )}
          <button ref={heroCta} type="button" onClick={() => setSharing(true)} data-track="moments_share_open" className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-sun px-6 font-bold text-ink shadow-[0_8px_30px_rgba(246,168,33,0.35)] transition hover:-translate-y-0.5 hover:bg-[#ffb93d]">
            <Plus size={18} aria-hidden /> Add your moment
          </button>
        </div>
        <FilmStrip moments={ordered} onOpen={openById} />
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-24">
        {featured.length > 0 && <FeaturedShow slides={featured} onOpen={openById} paused={open >= 0 || sharing} />}

        {moments.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-white/15 px-6 py-16 text-center">
            <p className="text-lg font-semibold">No moments yet</p>
            <p className="mt-1 text-white/60">Be the first to share a photo or highlight from Moonshot.</p>
          </div>
        ) : (
          <ul ref={wallRef} className="columns-2 gap-3 sm:gap-4 md:columns-3 lg:columns-4 [&>li]:mb-3 [&>li]:break-inside-avoid sm:[&>li]:mb-4">
            {wall.map((m, i) => (
              <li key={m.id} id={`m-${m.id}`} data-reveal style={{ transitionDelay: `${(i % 4) * 70}ms` }}>
                <a
                  href={`#m-${m.id}`}
                  onClick={(e) => (e.preventDefault(), openById(m.id))}
                  data-track="moment_open"
                  data-track-id={m.id}
                  aria-label={label(m)}
                  className="group relative block overflow-hidden rounded-3xl ring-1 ring-white/10 transition duration-300 hover:-translate-y-0.5 hover:ring-white/25"
                >
                  {m.images.length ? (
                    <>
                      <Img m={m} className={cx("w-full bg-white/5 object-cover transition duration-700 group-hover:scale-105", SHAPES[i % SHAPES.length])} />
                      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-90" />
                      {m.video && <PlayBadge gif={m.video.gif} />}
                      <span className="absolute right-2.5 top-2.5 flex gap-1.5">
                        {m.video && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                            {m.video.gif ? "GIF" : <><Play size={11} fill="currentColor" aria-hidden /> Video</>}
                          </span>
                        )}
                        {m.images.length > 1 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                            <Images size={12} aria-hidden /> {m.images.length}
                          </span>
                        )}
                        {m.xUrl && <span className="rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">𝕏</span>}
                      </span>
                      <span className="absolute inset-x-0 bottom-0 p-3 text-left">
                        {m.text && <span className="mb-1 line-clamp-2 block max-h-0 overflow-hidden text-sm leading-snug text-white/90 opacity-0 transition-all duration-300 group-hover:max-h-12 group-hover:opacity-100">{m.text}</span>}
                        <span className="block truncate text-xs font-semibold text-white">{m.who}</span>
                      </span>
                    </>
                  ) : (
                    <span className={cx("flex min-h-44 flex-col justify-between gap-6 p-5 text-left", QUOTE_TONES[i % QUOTE_TONES.length])}>
                      <span aria-hidden className="font-serif text-5xl leading-none opacity-50">“</span>
                      <span className="line-clamp-6 text-lg font-semibold leading-snug">{m.text}</span>
                      <span className="truncate text-xs font-semibold opacity-80">
                        {m.xUrl ? "𝕏 " : ""}
                        {m.who} · {m.ago}
                      </span>
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {fab && (
        <button type="button" onClick={() => setSharing(true)} data-track="moments_share_fab" aria-label="Add your moment" className="moment-rise fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-sun text-ink shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition hover:scale-105">
          <Plus size={24} aria-hidden />
        </button>
      )}

      {open >= 0 && <Viewer moments={ordered} index={open} onIndex={show} />}
      {sharing && <ShareSheet myName={myName} onClose={() => setSharing(false)} />}
    </>
  );
}

/** Full-screen viewer: swipe or use the arrow keys to move through photos and moments. */
function Viewer({ moments, index, onIndex }: { moments: MomentView[]; index: number; onIndex: (i: number | null) => void }) {
  const m = moments[index];
  const [photo, setPhoto] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touch = useRef<number | null>(null);

  useEffect(() => setPhoto(0), [index]);
  // Moving on to another moment inside the viewer (the first one opened is already counted as a click).
  const firstIndex = useRef(index);
  useEffect(() => {
    if (index !== firstIndex.current) track("moment_browse", moments[index].id);
    // Only when the moment changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  useEffect(() => {
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      const nextPhoto = photo + dir;
      if (nextPhoto >= 0 && nextPhoto < m.images.length) return setPhoto(nextPhoto);
      const next = index + dir;
      if (next >= 0 && next < moments.length) onIndex(next);
    },
    [photo, m.images.length, index, moments.length, onIndex],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onIndex(null);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onIndex]);

  const onTouchStart = (e: TouchEvent) => (touch.current = e.touches[0].clientX);
  const onTouchEnd = (e: TouchEvent) => {
    if (touch.current === null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    touch.current = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  };

  const atStart = index === 0 && photo === 0;
  const atEnd = index === moments.length - 1 && photo >= m.images.length - 1;

  return (
    <div role="dialog" aria-modal="true" aria-label={`Moment from ${m.who}`} className="moment-fade fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#0b0a0e] text-white">
      {m.images.length > 0 && (
        // Ambient glow: the photo itself, heavily blurred, behind everything.
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`glow-${m.id}-${photo}`} src={m.images[photo]} alt="" aria-hidden referrerPolicy={m.fromXImages ? "no-referrer" : undefined} className="moment-fade pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-25 blur-3xl" />
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />
      <div className="relative flex items-center justify-between px-4 py-3 text-sm text-white/60">
        <span>
          {index + 1} / {moments.length}
        </span>
        <button ref={closeRef} type="button" onClick={() => onIndex(null)} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
          <X size={20} aria-hidden />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {m.video && photo === 0 ? (
          <MomentVideo m={m} />
        ) : m.images.length ? (
          <Img key={`${m.id}-${photo}`} m={m} i={photo} eager className="moment-fade max-h-full max-w-full rounded-2xl object-contain shadow-[0_30px_80px_rgba(0,0,0,0.6)]" />
        ) : (
          <blockquote key={m.id} className="moment-fade max-w-2xl px-4 text-center text-2xl font-semibold leading-snug sm:text-4xl">
            <span aria-hidden className="mb-2 block font-serif text-6xl leading-none text-sun">“</span>
            {m.text}
          </blockquote>
        )}
        <button type="button" onClick={() => step(-1)} disabled={atStart} aria-label="Previous" className="absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-0 sm:grid">
          <ChevronLeft size={24} aria-hidden />
        </button>
        <button type="button" onClick={() => step(1)} disabled={atEnd} aria-label="Next" className="absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-0 sm:grid">
          <ChevronRight size={24} aria-hidden />
        </button>
      </div>

      {m.images.length > 1 && (
        <div className="relative flex justify-center gap-1.5 pt-3" aria-label={`Photo ${photo + 1} of ${m.images.length}`}>
          {m.images.map((_, i) => (
            <button key={i} type="button" onClick={() => setPhoto(i)} aria-label={`Photo ${i + 1}`} className={cx("h-1.5 rounded-full transition-all", i === photo ? "w-6 bg-sun" : "w-1.5 bg-white/30")} />
          ))}
        </div>
      )}

      <div className="safe-bottom relative mx-auto w-full max-w-2xl space-y-3 px-5 pb-5 pt-4">
        <div className="flex items-center gap-2.5 text-sm">
          {m.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.avatar} alt="" width={32} height={32} referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <Avatar name={m.who} size={32} />
          )}
          <span className="min-w-0 flex-1 truncate">
            {m.whoHref ? (
              <a href={m.whoHref} target={m.whoHref.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer nofollow" className="font-semibold hover:underline" data-track="moment_author">
                {m.who}
              </a>
            ) : (
              <span className="font-semibold">{m.who}</span>
            )}
            <span className="text-white/50"> · {m.ago}</span>
          </span>
          {m.place && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70">
              <MapPin size={12} aria-hidden /> {m.place}
            </span>
          )}
        </div>
        {m.note && <p className="font-medium">{m.note}</p>}
        {m.text && m.images.length > 0 && <p className={cx("max-h-28 overflow-y-auto whitespace-pre-line text-sm leading-relaxed", m.note ? "text-white/60" : "text-white/85")}>{m.text}</p>}
        {m.people.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="font-semibold text-sun">👋 Follow up:</span>
            {m.people.map((p) => (
              <Link key={p.key} href={`/?q=${encodeURIComponent(p.q)}`} data-track="moment_person" data-track-id={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-semibold hover:bg-white/20">
                <Avatar name={p.name} size={18} /> {p.name}
              </Link>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 pt-1 [&_button]:text-white/50">
          {m.xUrl ? (
            <span className="flex items-center gap-4">
              <a href={m.xUrl} target="_blank" rel="noopener noreferrer nofollow" data-track="moment_x_open" data-track-id={m.id} className="inline-flex items-center gap-1 text-sm font-semibold text-sun hover:underline">
                View on X <ExternalLink size={13} aria-hidden />
              </a>
              {(m.likes > 0 || m.replies > 0) && (
                <span className="flex items-center gap-3 text-xs text-white/50" aria-label={`${m.likes} likes and ${m.replies} replies on X`}>
                  <span className="inline-flex items-center gap-1">
                    <Heart size={13} aria-hidden /> {m.likes.toLocaleString()}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle size={13} aria-hidden /> {m.replies.toLocaleString()}
                  </span>
                </span>
              )}
            </span>
          ) : (
            <span />
          )}
          <ReportLink type="moment" id={m.id} />
        </div>
      </div>
    </div>
  );
}

/** "Add your moment" as a sheet over the gallery (bottom sheet on phones). */
function ShareSheet({ myName, onClose }: { myName: string | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input, textarea, button")?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div className="moment-fade fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="share-h" className="moment-rise max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white p-5 text-ink shadow-2xl sm:rounded-[28px] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="share-h" className="text-xl font-extrabold">
              Add your moment
            </h2>
            <p className="text-sm text-muted">Photos, a highlight, or an X post. Tag people with @handle.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-canvas hover:bg-line">
            <X size={18} aria-hidden />
          </button>
        </div>
        <MomentForm myName={myName} />
      </div>
    </div>
  );
}
