import { Box } from '@mui/material'

interface AgrupaMarcaLogoProps {
  size?: number
  className?: string
  color?: string
  textColor?: string
  style?: React.CSSProperties
}

export function AgrupaMarcaLogoMark({ size = 48, className, style }: AgrupaMarcaLogoProps) {
  return (
    <Box
      component="img"
      src="/agrupa-marca-logo.png"
      alt="Agrupa Marca"
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
        ...style,
      }}
      className={className}
    />
  )
}

export function AgrupaMarcaLogoHorizontal({ size = 36, className, style }: AgrupaMarcaLogoProps) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: size,
        ...style,
      }}
      className={className}
    >
      <Box
        component="img"
        src="/agrupa-marca-logo.png"
        alt="Agrupa Marca"
        sx={{
          height: size,
          width: 'auto',
          maxHeight: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </Box>
  )
}

export function AgrupaMarcaLogoFull({ size = 56, className, style }: AgrupaMarcaLogoProps) {
  return (
    <Box
      component="img"
      src="/agrupa-marca-logo.png"
      alt="Agrupa Marca Logo"
      sx={{
        height: size,
        width: 'auto',
        objectFit: 'contain',
        display: 'block',
        ...style,
      }}
      className={className}
    />
  )
}

export default AgrupaMarcaLogoMark
