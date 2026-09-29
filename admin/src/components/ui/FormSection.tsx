/**
 * FormSection — re-exports shared form-section primitives from the settings module
 * so they can be used globally across all plugin pages.
 *
 * Available components:
 *   FormGroup        — Card with icon header + grid body. Use for full-page form sections.
 *   FormGroupHeader  — Header only (no Card). Use inside modals / existing Card layouts.
 *   FormCheckbox     — Styled checkbox wired via react-hook-form's useController.
 */
export {
  FormGroup,
  FormGroupHeader,
  FormCheckbox,
} from '@/modules/settings/components/SettingsFormPrimitives'
