import { GearSix } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'

/** Settings on the phone, where the bottom bar has no room left for it (the side nav has it on a laptop). */
export function SettingsLink() {
  return (
    <Link
      to="/settings"
      aria-label="Settings"
      className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-muted hover:bg-white/5 hover:text-white lg:hidden"
    >
      <GearSix aria-hidden />
    </Link>
  )
}
