import { CategoryTile } from './CategoryTile'
import type { Category } from '../types'

interface Props {
  categories: Category[]
  spentByCategory: Record<string, number>
  onSelect: (category: Category) => void
}

export function CategoryGrid({ categories, spentByCategory, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {categories.map((category) => (
        <CategoryTile
          key={category.id}
          category={category}
          spent={spentByCategory[category.id] ?? 0}
          onClick={() => onSelect(category)}
        />
      ))}
    </div>
  )
}
