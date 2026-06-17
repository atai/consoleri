import type { ReactNode } from 'react'

export type ModalSize = 'md' | 'lg'

const sizeClass: Record<ModalSize, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg'
}

export interface ModalProps {
  size?: ModalSize
  scrollable?: boolean
  children: ReactNode
  onClose?: () => void
}

export function Modal({
  size = 'md',
  scrollable = false,
  children,
  onClose
}: ModalProps): React.JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose ? () => onClose() : undefined}
    >
      <div
        className={`flex w-full ${sizeClass[size]} flex-col overflow-hidden rounded-lg border border-[#30363d] bg-[#161b22] shadow-xl ${
          scrollable ? 'max-h-[85vh]' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
