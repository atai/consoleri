import { useEffect, useMemo, useRef, useState } from 'react'
import {
  applyTagSuggestion,
  getActiveTagToken,
  parseTagsInput,
  suggestHostTags
} from '@consoleri/core'

interface TagInputProps {
  value: string
  onChange: (value: string) => void
  existingTags: string[]
  placeholder?: string
  id?: string
}

export function TagInput({
  value,
  onChange,
  existingTags,
  placeholder,
  id
}: TagInputProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeToken = getActiveTagToken(value)
  const suggestions = useMemo(
    () => suggestHostTags(existingTags, activeToken, parseTagsInput(value)),
    [existingTags, activeToken, value]
  )

  useEffect(() => {
    setHighlightedIndex(0)
  }, [suggestions])

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    }
  }, [])

  const showSuggestions = open && activeToken.trim().length > 0 && suggestions.length > 0

  const selectSuggestion = (tag: string): void => {
    onChange(applyTagSuggestion(value, tag))
    setOpen(true)
    inputRef.current?.focus()
  }

  const handleFocus = (): void => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current)
      blurTimerRef.current = null
    }
    setOpen(true)
  }

  const handleBlur = (): void => {
    blurTimerRef.current = setTimeout(() => setOpen(false), 120)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!showSuggestions) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((index) => (index + 1) % suggestions.length)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((index) => (index - 1 + suggestions.length) % suggestions.length)
      return
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      const tag = suggestions[highlightedIndex]
      if (tag) {
        e.preventDefault()
        selectSuggestion(tag)
      }
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-autocomplete="list"
        aria-controls={showSuggestions ? `${id ?? 'tag-input'}-listbox` : undefined}
      />

      {showSuggestions && (
        <ul
          id={`${id ?? 'tag-input'}-listbox`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded border border-[#30363d] bg-[#0d1117] py-1 shadow-lg"
        >
          {suggestions.map((tag, index) => (
            <li key={tag} role="option" aria-selected={index === highlightedIndex}>
              <button
                type="button"
                className={`block w-full px-2 py-1.5 text-left text-sm ${
                  index === highlightedIndex
                    ? 'bg-[#21262d] text-gray-100'
                    : 'text-gray-300 hover:bg-[#21262d]/70'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(tag)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                #{tag}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
