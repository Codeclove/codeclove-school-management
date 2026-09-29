<?php
/**
 * Database table name constants.
 *
 * Centralises all table names so they are never hard-coded as magic strings
 * anywhere else in the codebase. Use Schema::table() or the typed constants.
 *
 * Example:
 *   $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM %i', Schema::sessions() ) );
 *
 * @package CodeClove\Database
 */

declare( strict_types=1 );

namespace CodeClove\Database;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Schema
 *
 * All table names are resolved at runtime so the WordPress table prefix
 * ($wpdb->prefix) is always respected.
 */
final class Schema {

	// ─── Table Name Accessors ─────────────────────────────────────────────────

	public static function sessions(): string         { return self::t( 'academic_sessions' ); }
	public static function terms(): string            { return self::t( 'academic_terms' ); }
	public static function units(): string            { return self::t( 'academic_units' ); }
	public static function groups(): string           { return self::t( 'academic_groups' ); }
	public static function subjects(): string         { return self::t( 'subjects' ); }
	public static function unit_subjects(): string    { return self::t( 'academic_unit_subjects' ); }

	public static function roles(): string            { return self::t( 'roles' ); }
	public static function role_permissions(): string { return self::t( 'role_permissions' ); }
	public static function user_roles(): string       { return self::t( 'user_roles' ); }

	public static function applications(): string     { return self::t( 'admission_applications' ); }
	public static function app_events(): string       { return self::t( 'admission_status_events' ); }
	public static function app_documents(): string    { return self::t( 'admission_documents' ); }
	public static function app_notes(): string        { return self::t( 'admission_notes' ); }
	public static function app_logs(): string         { return self::t( 'audit_logs' ); }
	public static function notifications(): string     { return self::t( 'notifications' ); }

	public static function students(): string         { return self::t( 'students' ); }
	public static function student_subjects(): string { return self::t( 'student_subjects' ); }
	public static function guardians(): string        { return self::t( 'guardians' ); }
	public static function student_guardians(): string { return self::t( 'student_guardians' ); }
	public static function enrollments(): string      { return self::t( 'student_enrollments' ); }

	public static function staff_apps(): string       { return self::t( 'staff_applications' ); }
	public static function staff_app_events(): string { return self::t( 'staff_application_status_events' ); }
	public static function staff_app_docs(): string   { return self::t( 'staff_application_documents' ); }
	public static function staff_app_notes(): string  { return self::t( 'staff_application_notes' ); }
	public static function staff_members(): string    { return self::t( 'staff_members' ); }

	public static function attendance(): string       { return self::t( 'attendance_records' ); }
	public static function staff_attendance(): string { return self::t( 'staff_attendance_records' ); }

	public static function fee_types(): string             { return self::t( 'fee_types' ); }
	public static function fee_type_class_rates(): string  { return self::t( 'fee_type_class_rates' ); }
	public static function invoices(): string              { return self::t( 'invoices' ); }
	public static function line_items(): string            { return self::t( 'invoice_line_items' ); }
	public static function payments(): string              { return self::t( 'payments' ); }

	public static function timetable_periods(): string     { return self::t( 'timetable_periods' ); }
	public static function timetable_slots(): string       { return self::t( 'timetable_slots' ); }
	public static function timetable_substitutes(): string { return self::t( 'timetable_substitutes' ); }
	// ─── All Tables Accessor ──────────────────────────────────────────────────

	/**
	 * Returns all 35 fully-qualified CodeClove table names.
	 *
	 * @return string[]
	 */
	public static function all(): array {
		return [
			self::sessions(),
			self::terms(),
			self::units(),
			self::groups(),
			self::subjects(),
			self::unit_subjects(),
			self::roles(),
			self::role_permissions(),
			self::user_roles(),
			self::applications(),
			self::app_events(),
			self::app_documents(),
			self::app_notes(),
			self::app_logs(),
			self::notifications(),
			self::students(),
			self::student_subjects(),
			self::guardians(),
			self::student_guardians(),
			self::enrollments(),
			self::staff_apps(),
			self::staff_app_events(),
			self::staff_app_docs(),
			self::staff_app_notes(),
			self::staff_members(),
			self::attendance(),
			self::staff_attendance(),
			self::fee_types(),
			self::fee_type_class_rates(),
			self::invoices(),
			self::line_items(),
			self::payments(),
			self::timetable_periods(),
			self::timetable_slots(),
			self::timetable_substitutes(),
		];
	}

	// ─── Private Helpers ─────────────────────────────────────────────────────

	/**
	 * Returns a fully-qualified table name with WP prefix and codeclove_ prefix.
	 *
	 * @param string $name Short table name (without wp_ or codeclove_).
	 */
	private static function t( string $name ): string {
		global $wpdb;
		return $wpdb->prefix . 'codeclove_' . $name;
	}
}
