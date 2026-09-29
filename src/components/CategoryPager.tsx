import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { CategoryTile } from './CategoryTile'
import type { Category } from '../types'

interface Props {
  categories: Category[]
  spentByCategory: Record<string, number>
  onSelect: (category: Category) => void
  /** One more tile after the categories (the Goals tile), given its height. */
  trailing?: (height: number) => ReactNode
}

const GAP = 8
/** Smallest tile that still fits its three lines of text. */
const TILE_MIN = 66
const TILE_MAX = 104
/** Room kept under the grid for the page dots. */
const DOTS = 22

/**
 * Category tiles sized to the space that's left on screen, so the Add tab
 * never scrolls vertically. Tiles that don't fit go onto further pages,
 * swiped left and right (native scroll-snap, so it feels like the OS).
 */
export function CategoryPager({ categories, spentByCategory, onSelect, trailing }: Props) {
  const viewport = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [page, setPage] = useState(0)

  useLayoutEffect(() => {
    const el = viewport.current
    if (!el) return
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const tiles: (Category | 'trailing')[] = trailing ? [...categories, 'trailing'] : categories
  const { cols, rows, tileHeight } = fit(size, tiles.length)
  const perPage = cols * rows
  const pages: (Category | 'trailing')[][] = []
  for (let i = 0; i < tiles.length; i += perPage) pages.push(tiles.slice(i, i + perPage))

  const goTo = (index: number) =>
    viewport.current?.scrollTo({ left: index * size.width, behavior: 'smooth' })

  return (
    <div data-tour="tiles" className="flex min-h-0 flex-1 flex-col">
      <div
        ref={viewport}
        onScroll={(e) => {
          const el = e.currentTarget
          if (el.clientWidth) setPage(Math.round(el.scrollLeft / el.clientWidth))
        }}
        className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {size.height > 0 &&
          pages.map((pageTiles, index) => (
            <div
              key={index}
              aria-label={
                pages.length > 1 ? `Categories, page ${index + 1} of ${pages.length}` : undefined
              }
              className="grid w-full shrink-0 snap-start snap-always content-start"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: GAP }}
            >
              {pageTiles.map((category) =>
                category === 'trailing' ? (
                  <div key="trailing">{trailing?.(tileHeight)}</div>
                ) : (
                  <CategoryTile
                    key={category.id}
                    category={category}
                    spent={spentByCategory[category.id] ?? 0}
                    height={tileHeight}
                    onClick={() => onSelect(category)}
                  />
                ),
              )}
            </div>
          ))}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-2" style={{ height: DOTS }}>
        {pages.length > 1 &&
          pages.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Page ${index + 1}`}
              aria-current={index === page}
              className="flex h-6 w-6 items-center justify-center"
            >
              <span
                className={`block h-1.5 rounded-full transition-all ${
                  index === page ? 'w-4 bg-slate-50' : 'w-1.5 bg-white/30'
                }`}
              />
            </button>
          ))}
      </div>
    </div>
  )
}

/**
 * Columns, rows per page and tile height for the available space: as many rows
 * as fit at TILE_MIN (fewer pages to swipe through), no more rows than there
 * are categories for, then the tiles stretch to fill the height, up to TILE_MAX.
 */
function fit(size: { width: number; height: number }, count: number) {
  const cols = size.width >= 330 ? 3 : 2
  const avail = Math.max(size.height - DOTS, TILE_MIN)
  const fitting = Math.max(1, Math.floor((avail + GAP) / (TILE_MIN + GAP)))
  const rows = Math.min(fitting, Math.max(Math.ceil(count / cols), 1))
  const tileHeight = Math.min(TILE_MAX, Math.floor((avail - GAP * (rows - 1)) / rows))
  return { cols, rows, tileHeight }
}
