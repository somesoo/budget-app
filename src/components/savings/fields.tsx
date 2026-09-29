import { Check, CaretDown } from '@phosphor-icons/react'
import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

/** Label above, the control, optional help below: the form pattern of the savings sheets. */
export function Field({
  label,
  help,
  children,
}: {
  label: string
  help?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
      {help && <span className="text-xs leading-snug text-muted">{help}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl bg-white/5 px-3 py-2.5 text-[15px] text-white outline-none ring-1 ring-white/10 placeholder:text-muted focus:ring-white/40'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

/** The `<option>` children, as data: callers keep writing options the usual way. */
function optionsOf(children: ReactNode): SelectOption[] {
  const out: SelectOption[] = []
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    const props = child.props as { value?: unknown; children?: ReactNode; disabled?: boolean }
    if (child.type === Fragment) {
      out.push(...optionsOf(props.children))
      return
    }
    if (child.type !== 'option') return
    out.push({
      value: String(props.value ?? ''),
      label: textOf(props.children),
      disabled: props.disabled,
    })
  })
  return out
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return ''
}

/**
 * A dropdown drawn by the app rather than the browser: the browser's own list
 * ignores the dark theme on some systems (white text on a white list on
 * Windows). The list opens below the field, or above when there's no room,
 * in a portal so a sheet's scrolling can't clip it. Arrow keys, Enter and
 * Escape work as in a native one.
 */
export function Select({
  value,
  onChange,
  children,
  size = 'md',
}: {
  value: string
  onChange: (value: string) => void
  children: ReactNode
  /** 'sm' for a compact one inside a line of text. */
  size?: 'md' | 'sm'
}) {
  const options = optionsOf(children)
  const selected = options.find((o) => o.value === value)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number }>()
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const id = useId()

  const position = () => {
    const r = button.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom
    // up when the list wouldn't fit below and there's more room above
    const up = below < 240 && r.top > below
    setPlace(
      up
        ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 6 }
        : { left: r.left, width: r.width, top: r.bottom + 6 },
    )
  }

  const show = () => {
    position()
    setActive(Math.max(options.findIndex((o) => o.value === value), 0))
    setOpen(true)
  }
  const pick = (o: SelectOption) => {
    if (o.disabled) return
    onChange(o.value)
    setOpen(false)
    button.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      const t = e.target as Node
      if (!button.current?.contains(t) && !list.current?.contains(t)) setOpen(false)
    }
    // follow the field when a sheet scrolls; a resize just closes it
    const reposition = () => position()
    const close = () => setOpen(false)
    document.addEventListener('pointerdown', outside)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const step = (from: number, by: number) => {
    for (let i = 1; i <= options.length; i++) {
      const next = (from + by * i + options.length) % options.length
      if (!options[next].disabled) return next
    }
    return from
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        show()
      }
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => step(a, e.key === 'ArrowDown' ? 1 : -1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (options[active]) pick(options[active])
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') e.preventDefault()
      // a sheet around this closes on Escape too; only the list should
      e.stopPropagation()
      setOpen(false)
    }
  }

  const small = size === 'sm'
  return (
    <>
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={
          small
            ? 'flex min-w-0 max-w-full items-center gap-1 rounded-lg bg-white/5 px-2 py-0.5 text-left text-xs text-slate-200 outline-none ring-1 ring-white/10 focus-visible:ring-white/40'
            : `${inputClass} flex items-center gap-2 text-left ${open ? 'ring-white/40' : ''}`
        }
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? '' : 'text-muted'}`}>
          {selected?.label ?? 'Choose…'}
        </span>
        <CaretDown
          aria-hidden
          className={`shrink-0 text-muted transition ${open ? 'rotate-180' : ''} ${small ? 'text-[10px]' : ''}`}
        />
      </button>
      {open &&
        place &&
        createPortal(
          <ul
            ref={list}
            id={id}
            role="listbox"
            style={{
              position: 'fixed',
              left: place.left,
              width: Math.max(place.width, small ? 180 : 0),
              top: place.top,
              bottom: place.bottom,
            }}
            className="z-[60] max-h-64 overflow-y-auto overscroll-contain rounded-xl bg-card p-1 shadow-2xl ring-1 ring-white/15"
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-${i}`}
                role="option"
                aria-selected={o.value === value}
                aria-disabled={o.disabled}
                onPointerEnter={() => !o.disabled && setActive(i)}
                onClick={() => pick(o)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-[15px] ${
                  o.disabled
                    ? 'cursor-default text-muted/60'
                    : i === active
                      ? 'bg-white/10 text-white'
                      : 'text-slate-200'
                }`}
              >
                <span className="min-w-0 flex-1">{o.label}</span>
                {o.value === value && (
                  <Check weight="bold" aria-hidden className="shrink-0 text-accent-soft" />
                )}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  )
}

/** Segmented choice between a few options. */
export function Segments<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col rounded-full bg-white/5 p-1 ring-1 ring-white/10">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`min-w-0 truncate rounded-full px-3 py-1.5 text-sm font-semibold transition ${
            value === o.value ? 'bg-slate-50 text-ink' : 'text-muted hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SubmitRow({
  label,
  disabled,
  pending,
  error,
}: {
  label: string
  disabled: boolean
  pending: boolean
  error: string | null
}) {
  return (
    <div className="grid gap-2 pt-1">
      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={disabled || pending}
        className="h-12 rounded-2xl bg-slate-100 text-base font-bold text-ink transition hover:bg-slate-50 active:scale-[0.99] disabled:opacity-40"
      >
        {pending ? 'Saving…' : label}
      </button>
    </div>
  )
}

/** On/off, with its label on the left: a row of the settings. */
export function Switch({
  label,
  help,
  checked,
  onChange,
}: {
  label: string
  help?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-white">{label}</span>
        {help && <span className="block text-xs leading-snug text-muted">{help}</span>}
      </span>
      <span
        aria-hidden
        className={`relative h-6 w-10 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-white/15'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-slate-50 shadow transition-[left] ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  )
}
