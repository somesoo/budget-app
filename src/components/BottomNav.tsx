import {
  ChartLineUp,
  ChartPieSlice,
  GearSix,
  ListBullets,
  PiggyBank,
  Plus,
  type Icon,
} from '@phosphor-icons/react'
import { NavLink } from 'react-router-dom'
import { useBudgetAlerts } from '../hooks/useBudgetAlerts'
import { AlertCount } from './alerts/AlertList'

export const TABS: { to: string; label: string; icon: Icon }[] = [
  { to: '/', label: 'Add', icon: Plus },
  { to: '/history', label: 'History', icon: ListBullets },
  { to: '/budget', label: 'Budget', icon: ChartPieSlice },
  { to: '/savings', label: 'Savings', icon: PiggyBank },
  { to: '/insights', label: 'Insights', icon: ChartLineUp },
  { to: '/settings', label: 'Settings', icon: GearSix },
]

/** Settings lives behind a gear on the phone, to leave the bar five tabs. */
const PHONE_TABS = TABS.filter((t) => t.to !== '/settings')

/** Phone navigation. On a laptop the SideNav takes over. */
export function BottomNav() {
  const { alerts } = useBudgetAlerts()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-md">
        {PHONE_TABS.map((tab) => (
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
                  <span className="relative">
                    <tab.icon
                      aria-hidden
                      className="text-[22px]"
                      weight={isActive ? 'fill' : 'regular'}
                    />
                    {tab.to === '/budget' && (
                      <span className="absolute -right-2.5 -top-1.5">
                        <AlertCount count={alerts.length} />
                      </span>
                    )}
                  </span>
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
