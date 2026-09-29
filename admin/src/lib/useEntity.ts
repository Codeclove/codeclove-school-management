import { useLabels } from '@/lib/labels'
import {
  Users,
  UserCog,
  ClipboardList,
  GraduationCap,
  BookMarked,
  Layers,
  Calendar,
  FileText,
  DollarSign,
  type LucideIcon
} from 'lucide-react'

export type EntityType =
  | 'student'
  | 'staff'
  | 'admission'
  | 'class_level'
  | 'section'
  | 'subject'
  | 'session'
  | 'invoice'
  | 'payment'

export interface EntityConfig {
  singular: string
  plural: string
  icon: LucideIcon
  route: string
}

export function useEntity(type: EntityType): EntityConfig {
  const { getLabel } = useLabels()

  const config: Record<EntityType, EntityConfig> = {
    student: {
      singular: getLabel('student', false, 'Student'),
      plural: getLabel('student', true, 'Students'),
      icon: Users,
      route: '/students',
    },
    staff: {
      singular: getLabel('staff_member', false, 'Staff Member'),
      plural: getLabel('staff_member', true, 'Staff Members'),
      icon: UserCog,
      route: '/staff',
    },
    admission: {
      singular: getLabel('admission_application', false, 'Admission Application'),
      plural: getLabel('admission_application', true, 'Admission Applications'),
      icon: ClipboardList,
      route: '/admissions',
    },
    class_level: {
      singular: getLabel('academic_unit', false, 'Class Level'),
      plural: getLabel('academic_unit', true, 'Class Levels'),
      icon: GraduationCap,
      route: '/academics/classes',
    },
    section: {
      singular: getLabel('academic_group', false, 'Section'),
      plural: getLabel('academic_group', true, 'Sections'),
      icon: Layers,
      route: '/academics/sections',
    },
    subject: {
      singular: getLabel('subject', false, 'Subject'),
      plural: getLabel('subject', true, 'Subjects'),
      icon: BookMarked,
      route: '/academics/subjects',
    },
    session: {
      singular: getLabel('academic_session', false, 'Academic Year'),
      plural: getLabel('academic_session', true, 'Academic Years'),
      icon: Calendar,
      route: '/academics/sessions',
    },
    invoice: {
      singular: getLabel('invoice', false, 'Invoice'),
      plural: getLabel('invoice', true, 'Invoices'),
      icon: FileText,
      route: '/finance/invoices',
    },
    payment: {
      singular: getLabel('payment', false, 'Payment'),
      plural: getLabel('payment', true, 'Payments'),
      icon: DollarSign,
      route: '/finance/payments',
    },
  }

  return config[type]
}
