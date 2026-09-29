import {
  ChatCircleDots,
  ChartLineUp,
  ChartPieSlice,
  GearSix,
  ListBullets,
  PiggyBank,
  Plus,
  type Icon,
} from '@phosphor-icons/react'
import { NavLink } from 'react-router-dom'
import { t } from '../i18n'
import { useBudgetAlerts } from '../hooks/useBudgetAlerts'
import { AlertCount } from './alerts/AlertList'

/** `id` names the tab for the tour (data-tour="nav-<id>"); the label is translated. */
export const TABS: { to: string; id: string; label: () => string; icon: Icon }[] = [
  { to: '/', id: 'add', label: () => t('nav.add'), icon: Plus },
  { to: '/history', id: 'history', label: () => t('nav.history'), icon: ListBullets },
  { to: '/budget', id: 'budget', label: () => t('nav.budget'), icon: ChartPieSlice },
  { to: '/savings', id: 'savings', label: () => t('nav.savings'), icon: PiggyBank },
  { to: '/insights', id: 'insights', label: () => t('nav.insights'), icon: ChartLineUp },
  { to: '/ask', id: 'ask', label: () => t('nav.ask'), icon: ChatCircleDots },
  { to: '/settings', id: 'settings', label: () => t('nav.settings'), icon: GearSix },
]

/**
 * Five tabs fit the phone's bar: Settings lives behind a gear there, and Ask
 * behind "Ask AI" buttons on the screens it helps with.
 */
const PHONE_TABS = TABS.filter((t) => t.to !== '/settings' && t.to !== '/ask')

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
              data-tour={`nav-${tab.id}`}
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
                  {tab.label()}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
