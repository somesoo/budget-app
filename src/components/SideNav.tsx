import { NavLink } from 'react-router-dom'
import { APP_NAME } from '../config'
import { useBudgetAlerts } from '../hooks/useBudgetAlerts'
import { AlertCount } from './alerts/AlertList'
import { TABS } from './BottomNav'

/** The four tiles from public/icon.svg. */
const MARK_TILES = ['#22c55e', '#f97316', '#38bdf8', '#a855f7']

/**
 * Laptop navigation: the same tabs as the bottom bar, down the left edge, so
 * the content gets the full height of the screen.
 */
export function SideNav() {
  const { alerts } = useBudgetAlerts()
  return (
    <nav className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-white/10 bg-ink px-4 py-6 lg:flex">
      <div className="mb-8 flex items-center gap-3 px-2">
        <span aria-hidden className="grid w-7 grid-cols-2 gap-[3px]">
          {MARK_TILES.map((color) => (
            <span
              key={color}
              className="aspect-square rounded-[3px]"
              style={{ backgroundColor: color }}
            />
          ))}
        </span>
        <span className="text-lg font-bold tracking-tight text-white">{APP_NAME}</span>
      </div>
      <ul className="grid gap-1">
        {TABS.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-muted hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <tab.icon
                    aria-hidden
                    className="text-xl"
                    weight={isActive ? 'fill' : 'regular'}
                  />
                  <span className="flex-1">{tab.label}</span>
                  {tab.to === '/budget' && <AlertCount count={alerts.length} />}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
