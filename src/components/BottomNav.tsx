import { ChartLineUp, ChartPieSlice, GearSix, ListBullets, Plus, type Icon } from '@phosphor-icons/react'
import { NavLink } from 'react-router-dom'

export const TABS: { to: string; label: string; icon: Icon }[] = [
  { to: '/', label: 'Add', icon: Plus },
  { to: '/history', label: 'History', icon: ListBullets },
  { to: '/budget', label: 'Budget', icon: ChartPieSlice },
  { to: '/insights', label: 'Insights', icon: ChartLineUp },
  { to: '/settings', label: 'Settings', icon: GearSix },
]

/** Phone navigation. On a laptop the SideNav takes over. */
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                  isActive ? 'text-white' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <tab.icon aria-hidden className="text-[22px]" weight={isActive ? 'fill' : 'regular'} />
                  {tab.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
