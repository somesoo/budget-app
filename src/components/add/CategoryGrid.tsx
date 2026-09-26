import { MagnifyingGlass } from '@phosphor-icons/react'
import type { KeyboardEvent, RefObject } from 'react'
import type { Category } from '../../types'
import { CategoryTile } from '../CategoryTile'

interface Props {
  categories: Category[]
  /** Trips and other projects, each with its whole budget as the tile's limit. */
  projects?: Category[]
  spentByCategory: Record<string, number>
  selectedId: string | null
  onSelect: (category: Category) => void
  query: string
  onQueryChange: (query: string) => void
  searchRef: RefObject<HTMLInputElement>
  onSearchKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
}

const TILE_HEIGHT = 104

/**
 * Every category at once, with a filter on top: on a laptop there's room for
 * all the tiles, and typing a few letters is quicker than aiming the mouse.
 */
export function CategoryGrid({
  categories,
  projects = [],
  spentByCategory,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  searchRef,
  onSearchKeyDown,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <label className="relative mb-4 block shrink-0">
        <MagnifyingGlass
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Find a category"
          aria-label="Find a category, Enter picks the first match"
          className="w-full rounded-xl bg-white/5 py-2.5 pl-10 pr-16 text-white outline-none ring-1 ring-white/10 placeholder:text-muted focus:ring-white/30"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-xs text-muted ring-1 ring-white/15">
          /
        </kbd>
      </label>

      {categories.length === 0 && projects.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No category matches “{query}”.</p>
      ) : (
        <div className="-m-1 min-h-0 flex-1 overflow-y-auto p-1">
          <Tiles
            list={categories}
            spentByCategory={spentByCategory}
            selectedId={selectedId}
            highlightFirst={!!query}
            onSelect={onSelect}
          />
          {projects.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-sm font-semibold text-white">Trips and projects</h3>
              <Tiles
                list={projects}
                spentByCategory={spentByCategory}
                selectedId={selectedId}
                highlightFirst={!!query && categories.length === 0}
                onSelect={onSelect}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Tiles({
  list,
  spentByCategory,
  selectedId,
  highlightFirst,
  onSelect,
}: {
  list: Category[]
  spentByCategory: Record<string, number>
  selectedId: string | null
  highlightFirst: boolean
  onSelect: (category: Category) => void
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
      {list.map((category, i) => (
        <div
          key={category.id}
          className={`rounded-2xl transition ${
            category.id === selectedId
              ? 'ring-2 ring-accent ring-offset-2 ring-offset-ink'
              : highlightFirst && i === 0
                ? 'ring-1 ring-white/40 ring-offset-2 ring-offset-ink'
                : ''
          }`}
        >
          <CategoryTile
            category={category}
            spent={spentByCategory[category.id] ?? 0}
            height={TILE_HEIGHT}
            onClick={() => onSelect(category)}
          />
        </div>
      ))}
    </div>
  )
}
