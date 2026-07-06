interface MagopcoLogoProps {
  size?: number
  color?: string
  textColor?: string
}

const BRAND_PURPLE = '#792482'

export function MagopcoLogoMark({ size = 48, color = BRAND_PURPLE }: MagopcoLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50"  cy="19"  r="18" fill={color} stroke="white" strokeWidth="3" />
      <circle cx="72"  cy="28"  r="18" fill={color} stroke="white" strokeWidth="3" />
      <circle cx="81"  cy="51"  r="18" fill={color} stroke="white" strokeWidth="3" />
      <circle cx="68"  cy="74"  r="18" fill={color} stroke="white" strokeWidth="3" />
      <circle cx="44"  cy="82"  r="18" fill={color} stroke="white" strokeWidth="3" />
      <circle cx="21"  cy="70"  r="18" fill={color} stroke="white" strokeWidth="3" />
      <circle cx="14"  cy="46"  r="18" fill={color} stroke="white" strokeWidth="3" />
      <circle cx="28"  cy="24"  r="18" fill={color} stroke="white" strokeWidth="3" />
    </svg>
  )
}

export function MagopcoLogoHorizontal({
  size = 40,
  color = BRAND_PURPLE,
  textColor,
}: MagopcoLogoProps) {
  const tc = textColor ?? color
  const textSize = Math.round(size * 0.44)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.22) }}>
      <MagopcoLogoMark size={size} color={color} />
      <span
        style={{
          fontFamily: "'Roboto', 'Franklin Gothic Medium', sans-serif",
          fontWeight: 700,
          fontSize: textSize,
          color: tc,
          letterSpacing: '0.01em',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        Magopco
      </span>
    </div>
  )
}

export function MagopcoLogoFull({
  size = 48,
  color = BRAND_PURPLE,
  textColor,
}: MagopcoLogoProps) {
  const tc = textColor ?? color
  const textSize = Math.round(size * 0.38)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: Math.round(size * 0.14) }}>
      <MagopcoLogoMark size={size} color={color} />
      <span
        style={{
          fontFamily: "'Roboto', 'Franklin Gothic Medium', sans-serif",
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
