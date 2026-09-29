<?php
/**
 * Uninstall cleanup file.
 *
 * Runs when the plugin is deleted from the WordPress admin. Drops custom
 * database tables and options ONLY if the user has explicitly enabled
 * data deletion in CodeClove settings, per WordPress.org guidelines.
 *
 * @package CodeClove
 */

declare( strict_types=1 );

// Prevent direct call.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Check authorization.
if ( ! current_user_can( 'activate_plugins' ) ) {
	return;
}

// If Pro is active or installed, preserve all shared database tables and settings.
if ( ( defined( 'CODECLOVE_IS_PRO' ) && CODECLOVE_IS_PRO ) || in_array( 'codeclove-school-management-pro/codeclove-school-management-pro.php', (array) get_option( 'active_plugins', [] ), true ) ) {
	return;
}

// Retrieve settings to check whether the administrator explicitly opted-in to wipe data on uninstall.
$codeclove_settings = get_option( 'codeclove_settings', [] );
if ( empty( $codeclove_settings['system']['delete_data_on_uninstall'] ) ) {
	// Per WordPress.org guidelines, do not destroy institutional data unless explicitly requested.
	return;
}

global $wpdb;

// List of custom tables to drop upon explicit deletion opt-in.
$codeclove_tables = [
	'academic_sessions',
	'academic_terms',
	'academic_units',
	'academic_groups',
	'subjects',
	'academic_unit_subjects',
	'roles',
	'role_permissions',
	'user_roles',
	'admission_applications',
	'admission_status_events',
	'admission_documents',
	'admission_notes',
	'audit_logs',
	'students',
	'student_subjects',
	'guardians',
	'student_guardians',
	'student_enrollments',
	'staff_applications',
	'staff_application_status_events',
	'staff_application_documents',
	'staff_application_notes',
	'staff_members',
	'attendance_records',
	'staff_attendance_records',
	'fee_types',
	'fee_type_class_rates',
	'invoices',
	'invoice_line_items',
	'payments',
	'timetable_periods',
	'timetable_slots',
	'timetable_substitutes',
	'notifications',
];

// Drop each custom table safely using identifier placeholders.
foreach ( $codeclove_tables as $codeclove_table ) {
	$codeclove_table_name = $wpdb->prefix . 'codeclove_' . $codeclove_table;
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery
	$wpdb->query( $wpdb->prepare( 'DROP TABLE IF EXISTS %i', $codeclove_table_name ) );
}

// Delete all options.
delete_option( 'codeclove_settings' );
delete_option( 'codeclove_db_version' );
delete_option( 'codeclove_license' );

// Remove custom WordPress roles.
remove_role( 'codeclove_staff' );
remove_role( 'codeclove_guardian' );
remove_role( 'codeclove_student' );
