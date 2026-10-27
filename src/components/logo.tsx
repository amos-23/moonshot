export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#4b3fe0" />
      <path d="M20.5 7.5a9 9 0 1 0 4 13.2A7 7 0 0 1 20.5 7.5Z" fill="#fff" />
      <circle cx="22.5" cy="11" r="2" fill="#ffd166" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <LogoMark />
      <span>
        Moonshot <span className="text-accent">Connect</span>
      </span>
    </span>
  );
}
