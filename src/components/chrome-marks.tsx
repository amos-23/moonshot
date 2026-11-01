/** Event Connect's mark: two linked rings (people meeting) on a dark tile. */
export function ConnectMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1e1f26" />
      <circle cx="12.5" cy="16" r="6.5" fill="none" stroke="#e8502a" strokeWidth="3" />
      <circle cx="19.5" cy="16" r="6.5" fill="none" stroke="#f6a821" strokeWidth="3" />
    </svg>
  );
}

/** Moonshot's own mark: a sunrise in its colours (used only inside the Moonshot event). */
export function SunriseMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#e8502a" />
      <circle cx="16" cy="24" r="11" fill="#f6a821" />
    </svg>
  );
}
