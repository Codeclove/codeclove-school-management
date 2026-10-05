<?php
/**
 * Roles & Permissions REST API controller.
 *
 * @package CodeClove\Modules\Roles
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Roles;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Api\BaseController;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class RolesController
 */
final class RolesController extends BaseController {

	/**
	 * Available system permissions grouped by category.
	 */
	private const SYSTEM_PERMISSIONS = [
		'Academics' => [
			'academic_sessions.view' => 'View Academic Sessions',
			'academic_sessions.add' => 'Add Academic Sessions',
			'academic_sessions.edit' => 'Edit Academic Sessions',
			'academic_sessions.manage' => 'Manage Academic Sessions',
			'academic_sessions.view_archived' => 'View Archived Sessions',
			'academic_sessions.plan_future' => 'Plan Future Sessions',
			'academic_terms.view' => 'View Academic Terms',
			'academic_terms.add' => 'Add Academic Terms',
			'academic_terms.edit' => 'Edit Academic Terms',
			'academic_terms.delete' => 'Delete Academic Terms',
			'academic_units.view' => 'View Academic Units',
			'academic_units.add' => 'Add Academic Units',
			'academic_units.edit' => 'Edit Academic Units',
			'academic_units.delete' => 'Delete Academic Units',
			'academic_groups.view' => 'View Academic Groups',
			'academic_groups.add' => 'Add Academic Groups',
			'academic_groups.edit' => 'Edit Academic Groups',
			'academic_groups.delete' => 'Delete Academic Groups',
			'subjects.view' => 'View Subjects',
			'subjects.add' => 'Add Subjects',
			'subjects.edit' => 'Edit Subjects',
			'subjects.delete' => 'Delete Subjects',
		],
		'Students & Admissions' => [
			'students.view' => 'View Students',
			'students.add' => 'Add Students',
			'students.edit' => 'Edit Students',
			'students.delete' => 'Delete Students',
			'guardians.view' => 'View Guardians',
			'guardians.add' => 'Add Guardians',
			'guardians.edit' => 'Edit Guardians',
			'guardians.delete' => 'Delete Guardians',
			'admissions.view' => 'View Admissions',
			'admissions.add' => 'Add Admissions',
			'admissions.edit' => 'Edit Admissions',
			'admissions.delete' => 'Delete Admissions',
			'admissions.approve' => 'Approve Admissions',
			'admissions.convert' => 'Convert Applicant to Student',
			'admission_documents.view' => 'View Admission Documents',
			'admission_documents.edit' => 'Edit Admission Documents',
		],
		'Attendance' => [
			'attendance.view' => 'View Attendance',
			'attendance.add' => 'Add Attendance',
			'attendance.edit' => 'Edit Attendance',
			'attendance.delete' => 'Delete Attendance',
		],
		'Staff & HR' => [
			'staff.view' => 'View Staff',
			'staff.add' => 'Add Staff',
			'staff.edit' => 'Edit Staff',
			'staff.delete' => 'Delete Staff',
			'staff_attendance.view' => 'View Staff Attendance',
			'staff_attendance.add' => 'Add Staff Attendance',
			'staff_attendance.edit' => 'Edit Staff Attendance',
			'staff_attendance.delete' => 'Delete Staff Attendance',
			'staff_onboarding.view' => 'View Staff Onboarding',
			'staff_onboarding.add' => 'Add Staff Onboarding',
			'staff_onboarding.edit' => 'Edit Staff Onboarding',
			'staff_applications.view' => 'View Staff Applications',
			'staff_applications.add' => 'Add Staff Applications',
			'staff_applications.edit' => 'Edit Staff Applications',
			'staff_applications.approve' => 'Approve Staff Applications',
			'staff_applications.convert' => 'Convert Staff Application',
			'leave_requests.view' => 'View Leave Requests',
			'leave_requests.add' => 'Add Leave Requests',
			'leave_requests.edit' => 'Edit Leave Requests',
			'leave_requests.delete' => 'Delete Leave Requests',
			'leave_requests.approve' => 'Approve Leave Requests',
		],
		'Finance' => [
			'finance.view' => 'View Finance Dashboard',
			'fee_types.view' => 'View Fee Types',
			'fee_types.add' => 'Add Fee Types',
			'fee_types.edit' => 'Edit Fee Types',
			'fee_types.delete' => 'Delete Fee Types',
			'invoices.view' => 'View Invoices',
			'invoices.add' => 'Add Invoices',
			'invoices.edit' => 'Edit Invoices',
			'invoices.delete' => 'Delete Invoices',
			'payments.view' => 'View Payments',
			'payments.add' => 'Add Payments',
			'payments.edit' => 'Edit Payments',
			'payments.delete' => 'Delete Payments',
		],
		'Settings & System' => [
			'dashboard.view' => 'View Dashboard',
			'settings.manage' => 'Manage Settings',
			'roles_permissions.manage' => 'Manage Roles & Permissions',
			'notifications.manage' => 'Manage Notifications',
			'imports.manage' => 'Manage Imports',
			'exports.manage' => 'Manage Exports',
			'system.manage' => 'Manage System Settings',
		],
	];

	/**
	 * Roles service instance.
	 *
	 * @var RolesService
	 */
	private RolesService $service;

	/**
	 * RolesController Constructor.
	 */
	public function __construct() {
		$this->service = new RolesService();
	}

	/**
	 * Registers REST routes.
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/roles',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_roles' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'roles_permissions.manage', $request ); },
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'create_role' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'roles_permissions.manage', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/roles/permissions',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_system_permissions' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'roles_permissions.manage', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/roles/(?P<id>\d+)',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_role' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'roles_permissions.manage', $request ); },
				],
				[
					'methods'             => 'PATCH',
					'callback'            => [ $this, 'update_role' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'roles_permissions.manage', $request ); },
				],
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'delete_role' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'roles_permissions.manage', $request ); },
				],
			]
		);
	}

	/**
	 * Lists all roles and allowed permission counts.
	 *
	 * @return WP_REST_Response
	 */
	public function get_roles(): WP_REST_Response {
		$roles = $this->service->get_roles();
		return $this->success( $roles );
	}

	/**
	 * Returns available grouped system permissions.
	 *
	 * @return WP_REST_Response
	 */
	public function get_permission_matrix(): array {
		return apply_filters( 'codeclove_permission_matrix', self::SYSTEM_PERMISSIONS );
	}

	public function get_system_permissions(): WP_REST_Response {
		return $this->success( $this->get_permission_matrix() );
	}

	/**
	 * Gets a single role by ID along with its checklist of permission keys.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_role( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id = (int) $request->get_param( 'id' );
		$role = $this->service->get_role( $id );

		if ( ! $role ) {
			return $this->error( 'not_found', __( 'Role not found.', 'codeclove-school-management' ), 404 );
		}

		return $this->success( $role );
	}

	/**
	 * Creates a new custom role.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function create_role( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->service->create_role( $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return $this->success( $result, 201 );
	}

	/**
	 * Updates role details and permissions.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_role( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->service->update_role( $id, $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return $this->success( $result );
	}

	/**
	 * Deletes a custom role.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function delete_role( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id = (int) $request->get_param( 'id' );
		$result = $this->service->delete_role( $id );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return $this->success( [ 'deleted' => true ] );
	}
}
