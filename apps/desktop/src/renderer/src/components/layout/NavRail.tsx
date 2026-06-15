import type { AppView } from '@consoleri/core'
import type { LucideIcon } from 'lucide-react'
import { LayoutList, Network, Palette } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

const MAIN_NAV_ITEMS: Array<{ view: AppView; label: string; title: string; Icon: LucideIcon }> = [
  { view: 'list', label: 'List', title: 'Host list and sessions', Icon: LayoutList },
  { view: 'map', label: 'Map', title: 'Network map', Icon: Network }
]

const PROFILE_NAV_ITEM = {
  view: 'profile' as const,
  label: 'Profile',
  title: 'Appearance profiles',
  Icon: Palette
}

function NavRailButton({
  active,
  label,
  title,
  Icon,
  onClick
}: {
  active: boolean
  label: string
  title: string
  Icon: LucideIcon
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-500 hover:bg-[#21262d] hover:text-gray-200'
      }`}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden />
    </button>
  )
}

export function NavRail(): React.JSX.Element {
  const { appView, setAppView } = useAppStore()

  return (
    <nav
      className="flex h-full w-[52px] shrink-0 flex-col items-center border-r border-[#30363d] bg-[#0d1117] py-2"
      aria-label="Main navigation"
    >
      <div className="flex flex-col items-center gap-1">
        {MAIN_NAV_ITEMS.map((item) => (
          <NavRailButton
            key={item.view}
            active={appView === item.view}
            label={item.label}
            title={item.title}
            Icon={item.Icon}
            onClick={() => setAppView(item.view)}
          />
        ))}
      </div>

      <div className="mt-auto flex flex-col items-center pt-2">
        <NavRailButton
          active={appView === PROFILE_NAV_ITEM.view}
          label={PROFILE_NAV_ITEM.label}
          title={PROFILE_NAV_ITEM.title}
          Icon={PROFILE_NAV_ITEM.Icon}
          onClick={() => setAppView(PROFILE_NAV_ITEM.view)}
        />
      </div>
    </nav>
  )
}
