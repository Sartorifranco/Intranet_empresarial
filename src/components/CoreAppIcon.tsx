import {
  Database,
  LayoutGrid,
  Monitor,
  Shield,
  Ticket,
  Truck,
  type LucideIcon,
} from 'lucide-react'

export const CORE_APP_ICON_MAP: Record<string, LucideIcon> = {
  Monitor,
  Truck,
  Shield,
  Ticket,
  Database,
  LayoutGrid,
}

export const CORE_APP_ICON_NAMES = Object.keys(CORE_APP_ICON_MAP)

interface CoreAppIconProps {
  name?: string
  className?: string
}

export function CoreAppIcon({ name, className }: CoreAppIconProps) {
  const Icon = (name && CORE_APP_ICON_MAP[name]) || LayoutGrid
  return <Icon className={className} />
}
