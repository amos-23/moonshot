"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Pause, Play, Plus, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { quoteSize, quoteText, type MomentView } from "./moment";
import { ReactionBar, type Reactions } from "./reactions";
import { XLogo } from "./share";
import { track } from "./tracker";
import { Avatar, cx } from "./ui";
import { HASHTAG, momentPost, withUtm, xIntent } from "@/lib/share";

const PHOTO_MS = 6000;
const textMs = (t: string | null) => Math.min(9000, 4000 + (t?.length ?? 0) * 40);

/**
 * "Watch the highlights": every moment full screen, one after another, like a story. Tap the right
 * side for next, the left for back, hold to pause, swipe down or press Esc to close. Videos play
 * with sound when the browser allows it; photos get the slow pan-and-zoom.
 */
export function MomentsStory({ slides, onClose, onAdd, reactions, origin }: { slides: MomentView[]; onClose: () => void; onAdd: () => void; reactions: Reactions; origin: string }) {
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const press = useRef<{ x: number; y: number; t: number; timer: number } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const done = i >= slides.length;
  const m = done ? null : slides[i];
  const isVideo = Boolean(m?.video && !videoFailed);
  const stopped = held || paused;

  const go = useCallback((to: number) => {
    setVideoFailed(false);
    setVideoProgress(0);
    setI(Math.max(0, Math.min(to, slides.length)));
  }, [slides.length]);
  const next = useCallback(() => go(i + 1), [go, i]);
  const prev = useCallback(() => go(i - 1), [go, i]);

  useEffect(() => {
    track("story_open");
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);
  useEffect(() => {
    if (done) track("story_end");
  }, [done]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key.toLowerCase() === "m") setMuted((x) => !x);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  // Videos follow play/pause; if the browser won't play with sound, play muted instead.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (stopped) v.pause();
    else
      v.play().catch(() => {
        setMuted(true);
        v.muted = true;
        v.play().catch(() => setVideoFailed(true));
      });
  }, [stopped, i, isVideo]);

  const onPointerDown = (e: PointerEvent) => {
    const timer = window.setTimeout(() => setHeld(true), 180);
    press.current = { x: e.clientX, y: e.clientY, t: Date.now(), timer };
  };
  const onPointerUp = (e: PointerEvent) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    window.clearTimeout(p.timer);
    const wasHold = Date.now() - p.t > 180;
    setHeld(false);
    if (e.clientY - p.y > 90) return onClose(); // swipe down
    if (Math.abs(e.clientX - p.x) > 60) return e.clientX < p.x ? next() : prev(); // swipe sideways
    if (wasHold) return;
    if (e.clientX < window.innerWidth / 3) prev();
    else next();
  };

  const duration = m ? (m.images.length ? PHOTO_MS : textMs(m.text)) : 0;
  const nextImg = slides[i + 1]?.images[0];
  const many = slides.length > 30;

  return (
    <div role="dialog" aria-modal="true" aria-label="Moonshot highlights" className="moment-fade fixed inset-0 z-[60] flex select-none flex-col overflow-hidden bg-black text-white">
      {/* Backdrop: the photo itself, blurred, so every shape of photo fills the screen. */}
      {m?.images[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`bg-${m.id}`} src={m.images[0]} alt="" aria-hidden referrerPolicy={m.fromXImages ? "no-referrer" : undefined} className="moment-fade pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-3xl" />
      )}
      {m && !m.images.length && <div aria-hidden className={cx("absolute inset-0", ["bg-gradient-to-br from-flame to-sun", "bg-gradient-to-br from-[#2a1d3a] to-flame", "bg-gradient-to-br from-sun to-flame"][i % 3])} />}
      {nextImg && (
        // Warm up the next photo so it appears instantly.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={nextImg} alt="" aria-hidden className="hidden" referrerPolicy="no-referrer" />
      )}

      {/* Progress */}
      <div className="relative z-10 px-3 pt-3">
        {many ? (
          <div className="flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${(Math.min(i, slides.length) / slides.length) * 100}%` }} />
            </div>
          </div>
        ) : (
          <div className="flex gap-1">
            {slides.map((s, k) => (
              <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                {k < i || done ? (
                  <div className="h-full w-full bg-white" />
                ) : k === i && m ? (
                  isVideo ? (
                    <div className="h-full bg-white" style={{ width: `${videoProgress * 100}%` }} />
                  ) : (
                    <div key={`p-${i}`} className="story-progress h-full bg-white" style={{ animationDuration: `${duration}ms`, animationPlayState: stopped ? "paused" : "running" }} onAnimationEnd={next} />
                  )
                ) : null}
              </div>
            ))}
          </div>
        )}
        {many && m && !isVideo && <div key={`p-${i}`} className="story-progress mt-1 h-0.5 bg-sun" style={{ animationDuration: `${duration}ms`, animationPlayState: stopped ? "paused" : "running" }} onAnimationEnd={next} />}
        {many && m && isVideo && <div className="mt-1 h-0.5 bg-sun" style={{ width: `${videoProgress * 100}%` }} />}
        <div className="mt-3 flex items-center gap-2.5">
          {m && (
            <>
              {m.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatar} alt="" width={32} height={32} referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover ring-2 ring-white/30" />
              ) : (
                <Avatar name={m.who} size={32} />
              )}
              <p className="min-w-0 flex-1 truncate text-sm">
                <span className="font-semibold">{m.who}</span> <span className="text-white/60">· {m.ago}</span>
                {many && <span className="text-white/60"> · {i + 1}/{slides.length}</span>}
              </p>
            </>
          )}
          {done && <p className="flex-1 text-sm font-semibold">Moonshot 2026</p>}
          {isVideo && (
            <button type="button" onClick={() => setMuted((x) => !x)} aria-label={muted ? "Turn sound on" : "Turn sound off"} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              {muted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
            </button>
          )}
          {!done && (
            <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play" : "Pause"} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              {paused ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20">
            <X size={20} aria-hidden />
          </button>
        </div>
      </div>

      {/* The slide. Taps and holds here drive the story. */}
      <div className="relative z-0 flex min-h-0 flex-1 items-center justify-center" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => setHeld(false)} onContextMenu={(e) => e.preventDefault()}>
        {m && isVideo && (
          <video
            ref={video}
            key={`v-${m.id}`}
            src={typeof window !== "undefined" && window.innerWidth < 640 ? m.video!.small : m.video!.src}
            poster={m.images[0]}
            autoPlay
            playsInline
            muted={muted}
            loop={false}
            // Long videos move on after 20 seconds, so one clip never holds up the story.
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.currentTime >= 20) return next();
              setVideoProgress(v.duration ? v.currentTime / Math.min(v.duration, 20) : 0);
            }}
            onEnded={next}
            onError={() => setVideoFailed(true)}
            className="moment-fade max-h-full max-w-full object-contain"
          />
        )}
        {m && !isVideo && m.images.length > 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`i-${m.id}`} src={m.images[0]} alt={m.text?.slice(0, 120) ?? `Photo from ${m.who}`} referrerPolicy={m.fromXImages ? "no-referrer" : undefined} draggable={false} className={cx("moment-fade max-h-full max-w-full object-contain", !stopped && "ken-burns")} />
        )}
        {m && !m.images.length && (
          <blockquote key={`t-${m.id}`} className={cx("moment-rise max-h-full max-w-2xl overflow-y-auto px-8 py-6 text-center font-bold leading-snug", quoteSize(m.text, "story"))}>
            <span aria-hidden className="mb-3 block font-serif text-7xl leading-none opacity-60">“</span>
            {quoteText(m.text)}
          </blockquote>
        )}
        {done && (
          <div className="moment-rise max-w-md px-8 text-center" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-sun">That was</p>
            <p className="mt-2 text-5xl font-black uppercase leading-[0.95]">Moonshot 2026 ✨</p>
            <p className="mt-3 text-white/70">
              {slides.length} moments, shared by the people who were there.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3">
              <a
                href={xIntent(`Relive ${HASHTAG} in ${slides.length} moments ✨📸`, withUtm(`${origin}/moments?story=1`, "x", "story"))}
                target="_blank"
                rel="noopener noreferrer"
                data-track="story_share_x"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-sun px-6 font-bold text-ink"
              >
                <XLogo /> Share the highlights on X
              </a>
              <button type="button" onClick={onAdd} className="inline-flex h-12 items-center gap-2 rounded-full bg-white/10 px-6 font-semibold hover:bg-white/20">
                <Plus size={18} aria-hidden /> Add your moment
              </button>
              <button type="button" onClick={() => go(0)} className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white">
                <RotateCcw size={15} aria-hidden /> Watch again
              </button>
            </div>
          </div>
        )}
        {stopped && !done && <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/40 backdrop-blur" aria-hidden><Pause size={26} /></span>}
      </div>

      {/* Caption and reactions */}
      {m && (
        <div className="safe-bottom relative z-10 flex items-end gap-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-5 pt-10">
          <div className="min-w-0 flex-1">
            {m.note && <p className="mb-1 font-semibold">{m.note}</p>}
            {m.text && m.images.length > 0 && <p className="line-clamp-4 whitespace-pre-line text-[15px] leading-snug text-white/90">{m.text}</p>}
            <a
              href={xIntent(momentPost({ text: m.text, who: m.who, fromX: Boolean(m.xUrl) }), withUtm(`${origin}/m/${m.id}`, "x", "story"))}
              target="_blank"
              rel="noopener noreferrer"
              data-track="moment_share_x"
              data-track-id={m.id}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-sm font-semibold backdrop-blur hover:bg-white/25"
            >
              <XLogo size={13} /> Post on X
            </a>
          </div>
          <div onPointerDown={(e) => e.stopPropagation()}>
            <ReactionBar id={m.id} reactions={reactions} variant="rail" />
          </div>
        </div>
      )}
    </div>
  );
}
