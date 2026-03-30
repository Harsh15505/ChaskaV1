"use client";

/**
 * ChaskaLogo.tsx
 * SVG logo matching the official Chaska brand.
 *
 * Structure:
 *   - Outer double-ring circle (dark)
 *   - Inner filled dark circle with horizontal divider
 *   - "च" Devanagari character in WHITE on dark circle
 *   - "CHASKA" wide-spaced serif below
 *   - "PUNJABI | CHINESE" tagline
 */

interface ChaskaLogoProps {
  size?: number;
  /** Outer ring + text color. Defaults to dark navy (for light backgrounds). */
  ringColor?: string;
  /** Accent color for tagline. Defaults to cyan. */
  accentColor?: string;
  /** Background color for the double-ring spacer. Defaults to white. */
  bgColor?: string;
  showText?: boolean;
}

export default function ChaskaLogo({
  size = 120,
  ringColor = "oklch(0.18 0.04 242)",
  accentColor = "oklch(0.58 0.20 222)",
  bgColor = "oklch(0.97 0.008 220)", // matches app background
  showText = true,
}: ChaskaLogoProps) {
  const W = 180;
  const emblemH = 100;
  const totalH = showText ? 148 : emblemH;
  const cx = W / 2; // 90

  const scale = size / totalH;
  const displayW = W * scale;

  return (
    <svg
      viewBox={`0 0 ${W} ${totalH}`}
      width={displayW}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Chaska — Punjabi | Chinese"
      role="img"
    >
      {/* ── Emblem ─────────────────────────────────────── */}

      {/* Outer thin ring */}
      <circle cx={cx} cy="50" r="47" fill="none" stroke={ringColor} strokeWidth="2.5" />
      {/* White spacer to create double-ring effect */}
      <circle cx={cx} cy="50" r="43" fill="none" stroke={bgColor} strokeWidth="3" />
      {/* Inner filled circle */}
      <circle cx={cx} cy="50" r="40" fill={ringColor} />

      {/* "च" Devanagari — centered in the circle */}
      <text
        x={cx}
        y="64"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="46"
        fontFamily="'Noto Sans Devanagari', 'Mangal', 'Arial Unicode MS', sans-serif"
        fontWeight="700"
        fill="white"
      >
        च
      </text>

      {/* ── Text below emblem ───────────────────────────── */}
      {showText && (
        <>
          {/* "CHASKA" */}
          <text
            x={cx}
            y="118"
            textAnchor="middle"
            fontSize="22"
            fontFamily="'Georgia', 'Times New Roman', serif"
            fontWeight="700"
            letterSpacing="5"
            fill={ringColor}
          >
            CHASKA
          </text>

          {/* "PUNJABI | CHINESE" */}
          <text
            x={cx}
            y="133"
            textAnchor="middle"
            fontSize="8"
            fontFamily="'Inter', 'Arial', sans-serif"
            fontWeight="700"
            letterSpacing="2"
            fill={accentColor}
          >
            PUNJABI | CHINESE
          </text>
        </>
      )}
    </svg>
  );
}
