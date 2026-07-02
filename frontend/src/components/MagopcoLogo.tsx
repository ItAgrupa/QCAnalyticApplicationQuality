/**
 * Magopco berry-cluster logo — SVG recreation of the official logo mark.
 * 8 circles arranged in a ring with white separation gaps, in Magopco purple.
 */

interface MagopcoLogoProps {
  size?: number
  color?: string
  withText?: boolean
  textColor?: string
}

export function MagopcoLogoMark({ size = 48, color = '#7B1FA2' }: MagopcoLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 8 circles arranged as a berry / grape cluster — top to bottom-left, clockwise */}
      <circle cx="50"  cy="19"  r="18" fill={color} stroke="white" strokeWidth="2.8" />
      <circle cx="72"  cy="28"  r="18" fill={color} stroke="white" strokeWidth="2.8" />
      <circle cx="81"  cy="51"  r="18" fill={color} stroke="white" strokeWidth="2.8" />
      <circle cx="68"  cy="74"  r="18" fill={color} stroke="white" strokeWidth="2.8" />
      <circle cx="44"  cy="82"  r="18" fill={color} stroke="white" strokeWidth="2.8" />
      <circle cx="21"  cy="70"  r="18" fill={color} stroke="white" strokeWidth="2.8" />
      <circle cx="14"  cy="46"  r="18" fill={color} stroke="white" strokeWidth="2.8" />
      <circle cx="28"  cy="24"  r="18" fill={color} stroke="white" strokeWidth="2.8" />
    </svg>
  )
}

export function MagopcoLogoFull({
  size = 48,
  color = '#7B1FA2',
  textColor,
}: MagopcoLogoProps) {
  const tc = textColor ?? color
  const textSize = size * 0.4

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.12 }}>
      <MagopcoLogoMark size={size} color={color} />
      <span
        style={{
          fontFamily: "'Roboto', sans-serif",
          fontWeight: 700,
          fontSize: textSize,
          color: tc,
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
      >
        Magopco
      </span>
    </div>
  )
}

export function MagopcoLogoHorizontal({
  size = 40,
  color = '#7B1FA2',
  textColor,
}: MagopcoLogoProps) {
  const tc = textColor ?? color
  const textSize = size * 0.42

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.2 }}>
      <MagopcoLogoMark size={size} color={color} />
      <span
        style={{
          fontFamily: "'Roboto', sans-serif",
          fontWeight: 700,
          fontSize: textSize,
          color: tc,
          letterSpacing: '0.01em',
          lineHeight: 1,
        }}
      >
        Magopco
      </span>
    </div>
  )
}
