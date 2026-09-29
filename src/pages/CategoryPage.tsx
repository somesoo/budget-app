import { ArrowLeft, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CategoryDetail } from '../components/category/CategoryDetail'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { PLAN_AHEAD_MONTHS } from '../config'
import { useCategories } from '../hooks/useCategories'
import { useDeviceUser } from '../hooks/useDeviceUser'
import { ownCategories } from '../lib/allowance'
import { currentMonthKey, shiftMonth } from '../lib/calculations'
import { t } from '../i18n'

/**
 * `/category/:id?month=YYYY-MM`: one category's history, forecast and share,
 * reached from the Budget tab. The month is in the URL so a laptop tab can be
 * reloaded or bookmarked without losing its place.
 */
export function CategoryPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const current = currentMonthKey()
  const requested = params.get('month')
  const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : current

  const { data: categories = [] } = useCategories()
  const { person: me } = useDeviceUser()
  const category = categories.find((c) => c.id === id)
  const active = ownCategories(
    categories.filter((c) => !c.archived && c.kind !== 'project'),
    me,
  )
  const index = active.findIndex((c) => c.id === id)
  const neighbour = (step: number) =>
    index === -1 ? null : active[(index + step + active.length) % active.length]
  const prev = neighbour(-1)
  const next = neighbour(1)
  const withMonth = (to: string) => `${to}?month=${month}`

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1rem)] lg:h-[100dvh] lg:max-w-none lg:px-8 lg:pb-6 lg:pt-6">
      <header className="mb-4 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          to="/budget"
          aria-label={t('common.backToBudget')}
          className="-ml-2 rounded-full px-2 py-1 text-2xl leading-none text-muted hover:bg-white/5 active:bg-white/10"
        >
          <ArrowLeft />
        </Link>
        <h1 className="flex min-w-0 flex-1 items-center gap-2.5 text-2xl font-bold text-white lg:text-3xl lg:tracking-tight">
          {category && (
            <span
              aria-hidden
              className="h-3.5 w-3.5 shrink-0 rounded"
              style={{ backgroundColor: category.color }}
            />
          )}
          <span className="truncate">{category?.name ?? t('entry.category')}</span>
        </h1>
        <div className="flex w-full items-center justify-between gap-2 lg:w-auto">
          {prev && next && active.length > 1 && (
            <nav aria-label={t('planner.otherCategories')} className="flex items-center gap-1 text-sm">
              <Link
                to={withMonth(`/category/${prev.id}`)}
                aria-label={t('planner.previousCategory', { name: prev.name })}
                className="rounded-full px-3 py-1.5 text-muted ring-1 ring-white/10 hover:bg-white/5 hover:text-white"
              >
                <CaretLeft aria-hidden className="inline-block align-[-0.125em]" />
                <span className="ml-1.5 hidden lg:inline">{prev.name}</span>
              </Link>
              <Link
                to={withMonth(`/category/${next.id}`)}
                aria-label={t('planner.nextCategory', { name: next.name })}
                className="rounded-full px-3 py-1.5 text-muted ring-1 ring-white/10 hover:bg-white/5 hover:text-white"
              >
                <span className="mr-1.5 hidden lg:inline">{next.name}</span>
                <CaretRight aria-hidden className="inline-block align-[-0.125em]" />
              </Link>
            </nav>
          )}
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-white/10 lg:block" />
          <MonthSwitcher
            month={month}
            max={shiftMonth(current, PLAN_AHEAD_MONTHS)}
            onChange={(m) => setParams({ month: m }, { replace: true })}
          />
        </div>
      </header>

      <div className="lg:min-h-0 lg:flex-1">
        <CategoryDetail
          categoryId={id}
          month={month}
          onSelectCategory={(other) => navigate(withMonth(`/category/${other}`))}
        />
      </div>
    </div>
  )
}
