import type { ComponentType, ReactNode } from 'react'
import type { Control, UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form'
import type { LucideIcon } from 'lucide-react'
import type { CodeCloveSettings } from '@/api/settings'
import type { PermissionKey } from '@/lib/permissions'

export interface ProRouteDef {
  path: string
  element: ReactNode
}

export interface ProSettingsTabProps {
  control: Control<CodeCloveSettings>
  register: UseFormRegister<CodeCloveSettings>
  watch: UseFormWatch<CodeCloveSettings>
  setValue: UseFormSetValue<CodeCloveSettings>
}

export interface ProNavItemDef {
  groupId: string
  label: string
  to: string
  icon: LucideIcon
  permission?: PermissionKey
  end?: boolean
  pro?: boolean
}

export const proRoutes: ProRouteDef[] = []
export const proSettingsTabs: Record<string, ComponentType<ProSettingsTabProps>> = {}
export const proNavItems: ProNavItemDef[] = []
