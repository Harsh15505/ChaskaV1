/**
 * ChaskaLogo.tsx
 *
 * SVG logo component matching the official Chaska brand:
 *   - Double-ring circle emblem with Devanagari "च" inside
 *   - "CHASKA" in serif tracking below
 *   - "PUNJABI | CHINESE" tagline
 *
 * Works on dark backgrounds (app theme).
 */

interface ChaskaLogoProps {
  /** Height of the full logo. Width scales proportionally. */
  size?: number;
  /** Color of the emblem ring and text. Defaults to white for dark backgrounds. */
  color?: string;
  /** Accent color for tagline. Defaults to the app primary (yellow). */
  accentColor?: string;
  /** Whether to show the text below the emblem. Default true. */
  showText?: boolean;
}

export default function ChaskaLogo({
  size = 120,
  color = "#FFFFFF",
  accentColor = "oklch(0.87 0.19 95)",
  showText = true,
}: ChaskaLogoProps) {
  // Emblem viewbox is 100×100, full logo with text is 100×155
  const viewH = showText ? 155 : 100;

  return (
    <svg
      viewBox={`0 0 100 ${viewH}`}
      width={size * (100 / viewH)}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Chaska — Punjabi | Chinese"
      role="img"
    >
      {/* ── Emblem ─────────────────────────────────────────────────────── */}
      {/* Outer ring */}
      <circle cx="50" cy="50" r="48" fill="none" stroke={color} strokeWidth="3.5" />
      {/* Inner filled circle */}
      <circle cx="50" cy="50" r="40" fill={color} />
      {/* Horizontal divider line — white stripe across the inner circle */}
      <rect x="10" y="46.5" width="80" height="7" fill="none" />

      {/* "च" character — rendered as SVG text using system Devanagari font */}
      {/* 
          We use a <foreignObject> fallback approach: render as SVG text.
          The font stack prioritises Noto Sans Devanagari which is available
          on all modern Android and iOS/macOS devices.
      */}
      <text
        x="50"
        y="67"
        textAnchor="middle"
        fontSize="52"
        fontFamily="'Noto Sans Devanagari', 'Mangal', 'Arial Unicode MS', sans-serif"
        fontWeight="700"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="0"
        style={{ fill: "oklch(0.12 0 0)" }}
      >
        च
      </text>

      {/* Horizontal line cutting through the circle (part of emblem design) */}
      <line x1="12" y1="46" x2="88" y2="46" stroke="oklch(0.12 0 0)" strokeWidth="5" />

      {/* ── Text below emblem ───────────────────────────────────────────── */}
      {showText && (
        <>
          {/* "CHASKA" — wide-spaced serif */}
          <text
            x="50"
            y="115"
            textAnchor="middle"
            fontSize="18"
            fontFamily="'Georgia', 'Times New Roman', serif"
            fontWeight="700"
            letterSpacing="4"
            fill={color}
          >
            CHASKA
          </text>

          {/* "PUNJABI | CHINESE" tagline */}
          <text
            x="50"
            y="128"
            textAnchor="middle"
            fontSize="7"
            fontFamily="'Inter', 'Arial', sans-serif"
            fontWeight="700"
            letterSpacing="2.5"
            fill={accentColor}
          >
            PUNJABI | CHINESE
          </text>
        </>
      )}
    </svg>
  );
}
