<?php
/**
 * Roles and Permissions Seeder.
 *
 * @package CodeClove\Database\Seeders
 */

declare( strict_types=1 );

namespace CodeClove\Database\Seeders;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Database\Schema;
use CodeClove\Database\SeederInterface;

/**
 * Class RolesSeeder
 */
final class RolesSeeder implements SeederInterface {

	/**
	 * Default system roles templates.
	 */
	private const ROLES = [
		[
			'slug'        => 'owner',
			'name'        => 'Owner',
			'description' => 'Full administrative access and system ownership configuration.',
			'is_system'   => 1,
			'is_locked'   => 1,
		],
		[
			'slug'        => 'administrator',
			'name'        => 'Administrator',
			'description' => 'Full operational access to school databases and workflows.',
			'is_system'   => 1,
			'is_locked'   => 0,
		],
		[
			'slug'        => 'admissions_officer',
			'name'        => 'Admissions Officer',
			'description' => 'Manage candidate inquiries, application reviews, and student conversions.',
			'is_system'   => 1,
			'is_locked'   => 0,
		],
		[
			'slug'        => 'academic_manager',
			'name'        => 'Academic Manager',
			'description' => 'Configure academic sessions, terms, classes, groups, subjects, and timetables.',
			'is_system'   => 1,
			'is_locked'   => 0,
		],
		[
			'slug'        => 'teacher',
			'name'        => 'Teacher',
			'description' => 'View class schedules, log student attendance, and assess student records.',
			'is_system'   => 1,
			'is_locked'   => 0,
		],
		[
			'slug'        => 'accountant',
			'name'        => 'Accountant',
			'description' => 'Configure fee types, issue invoices, and record fee payments.',
			'is_system'   => 1,
			'is_locked'   => 0,
		],
		[
			'slug'        => 'hr_manager',
			'name'        => 'HR Manager',
			'description' => 'Manage employee directory, onboarding workflows, and staff leave requests.',
			'is_system'   => 1,
			'is_locked'   => 0,
		],
		[
			'slug'        => 'receptionist',
			'name'        => 'Receptionist',
			'description' => 'Record student inquiries, edit admissions logs, and view basic records.',
			'is_system'   => 1,
			'is_locked'   => 0,
		],
		[
			'slug'        => 'readonly_staff',
			'name'        => 'Read-only Staff',
			'description' => 'View authorized records without editing capabilities.',
			'is_system'   => 1,
			'is_locked'   => 0,
		],
	];

	/**
	 * Default role-to-permission mappings.
	 */
	private const ROLE_PERMISSIONS = [
		'owner'              => [ '*' ],
		'administrator'      => [
			'academic_sessions.view', 'academic_sessions.add', 'academic_sessions.edit', 'academic_sessions.manage', 'academic_sessions.view_archived', 'academic_sessions.plan_future',
			'academic_terms.view', 'academic_terms.add', 'academic_terms.edit', 'academic_terms.delete',
			'academic_units.view', 'academic_units.add', 'academic_units.edit', 'academic_units.delete',
			'academic_groups.view', 'academic_groups.add', 'academic_groups.edit', 'academic_groups.delete',
			'subjects.view', 'subjects.add', 'subjects.edit', 'subjects.delete',
			'students.view', 'students.add', 'students.edit', 'students.delete',
			'guardians.view', 'guardians.add', 'guardians.edit', 'guardians.delete',
			'admissions.view', 'admissions.add', 'admissions.edit', 'admissions.delete', 'admissions.approve', 'admissions.convert',
			'admission_documents.view', 'admission_documents.edit',
			'attendance.view', 'attendance.add', 'attendance.edit', 'attendance.delete',
			'staff_attendance.view', 'staff_attendance.add', 'staff_attendance.edit', 'staff_attendance.delete',
			'staff.view', 'staff.add', 'staff.edit',
			'staff_onboarding.view', 'staff_onboarding.add', 'staff_onboarding.edit',
			'staff_applications.view', 'staff_applications.add', 'staff_applications.edit', 'staff_applications.approve', 'staff_applications.convert',
			'leave_requests.view', 'leave_requests.add', 'leave_requests.edit', 'leave_requests.delete', 'leave_requests.approve',
			'fee_types.view', 'fee_types.add', 'fee_types.edit', 'fee_types.delete',
			'invoices.view', 'invoices.add', 'invoices.edit', 'invoices.delete',
			'payments.view', 'payments.add', 'payments.edit', 'payments.delete',
			'settings.manage', 'roles_permissions.manage', 'notifications.manage',
			'imports.manage', 'exports.manage', 'system.manage',
			'finance.view', 'dashboard.view',
		],
		'admissions_officer' => [
			'students.view', 'students.add', 'students.edit',
			'guardians.view', 'guardians.add', 'guardians.edit',
			'admissions.view', 'admissions.add', 'admissions.edit', 'admissions.approve', 'admissions.convert',
			'admission_documents.view', 'admission_documents.edit',
			'academic_sessions.view', 'academic_terms.view', 'academic_units.view', 'academic_groups.view', 'dashboard.view',
		],
		'academic_manager'   => [
			'academic_sessions.view', 'academic_sessions.add', 'academic_sessions.edit', 'academic_sessions.view_archived', 'academic_sessions.plan_future',
			'academic_terms.view', 'academic_terms.add', 'academic_terms.edit', 'academic_terms.delete',
			'academic_units.view', 'academic_units.add', 'academic_units.edit', 'academic_units.delete',
			'academic_groups.view', 'academic_groups.add', 'academic_groups.edit', 'academic_groups.delete',
			'subjects.view', 'subjects.add', 'subjects.edit', 'subjects.delete',
			'dashboard.view',
		],
		'teacher'            => [
			'academic_sessions.view', 'academic_terms.view', 'academic_units.view', 'academic_groups.view', 'subjects.view',
			'students.view',
			'attendance.view', 'attendance.add', 'attendance.edit', 'dashboard.view',
		],
		'accountant'         => [
			'academic_sessions.view', 'academic_units.view', 'academic_groups.view',
			'students.view', 'guardians.view',
			'fee_types.view', 'fee_types.add', 'fee_types.edit',
			'invoices.view', 'invoices.add', 'invoices.edit',
			'payments.view', 'payments.add', 'payments.edit', 'payments.delete',
			'finance.view', 'dashboard.view',
		],
		'hr_manager'         => [
			'academic_sessions.view',
			'staff.view', 'staff.add', 'staff.edit', 'staff.delete',
			'staff_attendance.view', 'staff_attendance.add', 'staff_attendance.edit', 'staff_attendance.delete',
			'staff_onboarding.view', 'staff_onboarding.add', 'staff_onboarding.edit',
			'staff_applications.view', 'staff_applications.add', 'staff_applications.edit', 'staff_applications.approve', 'staff_applications.convert',
			'leave_requests.view', 'leave_requests.add', 'leave_requests.edit', 'leave_requests.delete', 'leave_requests.approve', 'dashboard.view',
		],
		'receptionist'       => [
			'academic_sessions.view', 'academic_units.view', 'academic_groups.view',
			'admissions.view', 'admissions.add',
			'students.view', 'dashboard.view',
		],
		'readonly_staff'     => [
			'academic_sessions.view', 'academic_terms.view', 'academic_units.view', 'academic_groups.view', 'subjects.view',
			'students.view', 'guardians.view', 'admissions.view', 'staff.view', 'fee_types.view', 'invoices.view', 'payments.view', 'dashboard.view',
		],
	];

	/**
	 * Seeds roles and permissions.
	 */
	public function seed( string $country ): void {
		self::run();
	}

	/**
	 * Run the seeding process.
	 */
	public static function run(): void {
		global $wpdb;

// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$role_permissions = apply_filters( 'codeclove_role_permissions', self::ROLE_PERMISSIONS );

		foreach ( self::ROLES as $role ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Role existence check.
			$existing_id = $wpdb->get_var(
				$wpdb->prepare(
					'SELECT id FROM %i WHERE slug = %s',
					Schema::roles(),
					$role['slug']
				)
			);

			if ( ! $existing_id ) {
				$wpdb->insert( Schema::roles(), $role );
				$role_id = $wpdb->insert_id;
			} else {
				$role_id = (int) $existing_id;
			}

			// Seed permissions for this role.
			if ( isset( $role_permissions[ $role['slug'] ] ) ) {
				foreach ( $role_permissions[ $role['slug'] ] as $permission ) {
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Role permission insert ignore.
					$wpdb->query(
						$wpdb->prepare(
							'INSERT IGNORE INTO %i (role_id, permission_key, allowed) VALUES (%d, %s, %d)',
							Schema::role_permissions(),
							$role_id,
							$permission,
							1
						)
					);
				}
			}
		}

		// Assign Owner role to the user who activated the plugin.
		$current_user_id = get_current_user_id();
		if ( 0 === $current_user_id ) {
			// In CLI or automated activation, fallback to first WP administrator.
			$admins = get_users(
				[
					'role'   => 'administrator',
					'number' => 1,
					'fields' => 'ID',
				]
			);
			if ( ! empty( $admins ) ) {
				$current_user_id = (int) $admins[0];
			}
		}

		if ( $current_user_id > 0 ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Owner role lookup.
			$owner_role_id = $wpdb->get_var(
				$wpdb->prepare(
					'SELECT id FROM %i WHERE slug = %s',
					Schema::roles(),
					'owner'
				)
			);

			if ( $owner_role_id ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Assign owner role to activating user.
				$wpdb->query(
					$wpdb->prepare(
						'INSERT IGNORE INTO %i (user_id, role_id) VALUES (%d, %d)',
						Schema::user_roles(),
						$current_user_id,
						$owner_role_id
					)
				);
			}
		}
	}

	/**
	 * Truncate role related tables.
	 */
	public function truncate(): void {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Truncating role tables for dev/tests.
		$wpdb->query( $wpdb->prepare( 'DELETE FROM %i', Schema::user_roles() ) );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Truncating role tables for dev/tests.
		$wpdb->query( $wpdb->prepare( 'DELETE FROM %i', Schema::role_permissions() ) );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Truncating role tables for dev/tests.
		$wpdb->query( $wpdb->prepare( 'DELETE FROM %i', Schema::roles() ) );
	}
}
