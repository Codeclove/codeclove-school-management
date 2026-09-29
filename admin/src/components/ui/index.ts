/**
 * CodeClove UI component library — barrel export.
 *
 * Import all shared UI components from this single entry point:
 *   import { Button, Badge, Card, Input, Select, Modal } from '@/components/ui'
 */

// ── Atoms ─────────────────────────────────────────────────────────────────────
export { Button, type ButtonProps }     from './Button'
export { Badge, type BadgeProps }       from './Badge'
export { Input, type InputProps }       from './Input'
export { Textarea, type TextareaProps } from './Textarea'
export { Skeleton }                     from './Skeleton'
export { Spinner }                      from './Spinner'

// ── Layout ────────────────────────────────────────────────────────────────────
export { Card, CardHeader, CardContent, CardFooter } from './Card'
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './Accordion'
export { StatCard }                     from './StatCard'
export { PageHeader }                   from './PageHeader'
export { EmptyState }                   from './EmptyState'

// ── Forms ─────────────────────────────────────────────────────────────────────
export { Select, type SelectOption, type SelectGroup } from './Select'
export { FormField }                    from './FormField'
export { DatePicker, type DatePickerProps } from './DatePicker'
export {
  FormGroup,
  FormGroupHeader,
  FormCheckbox,
}                                       from './FormSection'

// ── Overlays ──────────────────────────────────────────────────────────────────
export { Modal, ModalFooter }           from './Modal'
export {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownRoot,
  DropdownTrigger,
}                                       from './Dropdown'

// ── Feedback ──────────────────────────────────────────────────────────────────
export {
  Tooltip,
  TooltipProvider,
}                                       from './Tooltip'
export { Alert, type AlertProps }       from './Alert'


// ── Data ──────────────────────────────────────────────────────────────────────
export { PersonAvatar, type PersonAvatarProps } from './PersonAvatar'
export {
  TableRoot,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableEmpty,
  TableSkeleton,
}                                       from './Table'

// ── Print ─────────────────────────────────────────────────────────────────────
export {
  PrintLetterhead,
  type PrintLetterheadProps,
  type PrintLetterheadMetaRow,
  type SchoolSettings,
} from './PrintLetterhead'
export {
  Barcode,
  type BarcodeProps,
} from './Barcode'

