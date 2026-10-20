/**
 * Helper utilities for StudentSwitcher component.
 */

// Only render switcher when user has multiple enrolled students to switch between
export const shouldShowStudentSwitcher = (count: number): boolean => count > 1
