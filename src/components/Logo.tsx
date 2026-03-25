export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Dumbbell shape */}
      {/* Left plate */}
      <rect x="5" y="12" width="6" height="16" rx="2" fill="currentColor" opacity="0.9" />
      {/* Right plate */}
      <rect x="29" y="12" width="6" height="16" rx="2" fill="currentColor" opacity="0.9" />
      {/* Bar */}
      <rect x="10" y="17" width="20" height="6" rx="1" fill="currentColor" opacity="0.5" />
      {/* Left inner plate */}
      <rect x="9" y="14" width="4" height="12" rx="1.5" fill="currentColor" opacity="0.7" />
      {/* Right inner plate */}
      <rect x="27" y="14" width="4" height="12" rx="1.5" fill="currentColor" opacity="0.7" />
      {/* Upward trend line overlay */}
      <polyline
        points="8,30 16,24 22,27 32,14"
        stroke="var(--accent, #4f9cf7)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Trend arrow tip */}
      <polyline
        points="28,14 32,14 32,18"
        stroke="var(--accent, #4f9cf7)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
