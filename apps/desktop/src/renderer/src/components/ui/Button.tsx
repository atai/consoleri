import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md'

const variantClass: Record<ButtonVariant, string> = {
  default:
    'border border-[#30363d] bg-[#21262d] text-gray-300 hover:bg-[#30363d] hover:text-gray-100',
  primary: 'bg-blue-600 text-white hover:bg-blue-500',
  danger: 'bg-red-900/80 text-red-200 hover:bg-red-800',
  ghost: 'text-gray-400 hover:bg-[#21262d] hover:text-gray-200'
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'rounded px-2 py-1 text-xs',
  md: 'rounded px-3 py-1.5 text-sm'
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

export function Button({
  variant = 'default',
  size = 'sm',
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
