/** Il pallone del "mi piace": vuoto col bordo, pieno arancione quando ti piace. */
export function BallIcon({
  size = 34,
  filled = false,
  className,
}: {
  size?: number;
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden
      className={className}
    >
      <circle
        cx="16"
        cy="16"
        r="13.2"
        fill={filled ? "#ef7d2d" : "rgba(0,0,0,0.25)"}
        stroke={filled ? "#1d1a16" : "currentColor"}
        strokeWidth="2.4"
      />
      <g
        fill="none"
        stroke={filled ? "#1d1a16" : "currentColor"}
        strokeWidth="1.9"
        strokeLinecap="round"
      >
        <path d="M16 2.8v26.4" />
        <path d="M2.8 16h26.4" />
        <path d="M7 6.6c3.6 2.6 5.6 5.9 5.6 9.4S10.6 22.8 7 25.4" />
        <path d="M25 6.6c-3.6 2.6-5.6 5.9-5.6 9.4s2 6.8 5.6 9.4" />
      </g>
    </svg>
  );
}
