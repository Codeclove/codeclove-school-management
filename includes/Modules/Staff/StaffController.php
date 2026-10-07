<?php
/**
 * Staff Directory REST API controller.
 *
 * @package CodeClove\Modules\Staff
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Staff;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Api\BaseController;
use CodeClove\Shared\AuditLogger;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class StaffController
 */
final class StaffController extends BaseController {

	/**
	 * Staff service instance.
	 *
	 * @var StaffService
	 */
	private StaffService $service;

	/**
	 * StaffController Constructor.
	 */
	public function __construct() {
		$this->service = new StaffService();
	}

	/**
	 * Registers REST routes.
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/staff',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_staff_members' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'staff.view', $request ); },
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'create_staff_member' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'staff.add', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/staff/bulk-action',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'bulk_staff_action' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool {
						$action = $request->get_json_params()['action'] ?? '';
						$cap    = ( 'delete' === $action ) ? 'staff.delete' : 'staff.edit';
						return $this->can( $cap, $request );
					},
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/staff/bulk-import',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'bulk_import' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'staff.add', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/public/staff-applications',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'public_submit_application' ],
					'permission_callback' => '__return_true',
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/public/staff-applications/status',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'public_lookup_status' ],
					'permission_callback' => '__return_true',
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/staff/import-template',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_import_template' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'staff.view', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/staff/(?P<id>\d+)',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_staff_member' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'staff.view', $request ); },
				],
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'update_staff_member' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'staff.edit', $request ); },
				],
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'delete_staff_member' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'staff.delete', $request ); },
				],
			]
		);
	}

	/**
	 * Gets a list of staff members.
	 *
	 * @param WP_REST_Request $request Incoming REST request.
	 */
	public function get_staff_members( WP_REST_Request $request ): WP_REST_Response {
		$pagination = $this->get_pagination( $request );
		$params = [
			'page'     => $pagination['page'],
			'per_page' => $pagination['per_page'],
			'search'   => sanitize_text_field( (string) ( $request->get_param( 'search' ) ?: '' ) ),
			'status'   => sanitize_key( (string) ( $request->get_param( 'status' ) ?: '' ) ),
			'role_id'  => $request->get_param( 'role_id' ),
			'orderby'  => sanitize_key( (string) ( $request->get_param( 'orderby' ) ?: 'id' ) ),
			'order'    => sanitize_key( (string) ( $request->get_param( 'order' ) ?: 'DESC' ) ),
		];

		$result = $this->service->get_staff_members( $params );

		return $this->paginated( $result['items'], $result['total'], $pagination['page'], $pagination['per_page'] );
	}

	/**
	 * Gets a single staff member.
	 *
	 * @param WP_REST_Request $request Incoming REST request.
	 */
	public function get_staff_member( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id = (int) $request->get_param( 'id' );
		$item = $this->service->get_staff_member( $id );

		if ( ! $item ) {
			return $this->error( 'not_found', __( 'Staff member not found.', 'codeclove-school-management' ), 404 );
		}

		return $this->success( $item );
	}

	/**
	 * Creates a new staff member.
	 *
	 * @param WP_REST_Request $request Incoming REST request.
	 */
	public function create_staff_member( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$body = $this->json_body( $request );
		if ( $body instanceof WP_Error ) {
			return $body;
		}

		$result = $this->service->create_staff_member( $body );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log( 'staff_member.created', [ 'staff_member_id' => $result['id'] ?? null ] );

		return $this->success( $result, 201 );
	}

	/**
	 * Updates an existing staff member.
	 *
	 * @param WP_REST_Request $request Incoming REST request.
	 */
	public function update_staff_member( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id = (int) $request->get_param( 'id' );
		$body = $this->json_body( $request );
		if ( $body instanceof WP_Error ) {
			return $body;
		}

		$result = $this->service->update_staff_member( $id, $body );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log( 'staff_member.updated', [ 'staff_member_id' => $id ] );

		return $this->success( $result );
	}

	/**
	 * Soft deletes a staff member.
	 *
	 * @param WP_REST_Request $request Incoming REST request.
	 */
	public function delete_staff_member( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id = (int) $request->get_param( 'id' );
		$result = $this->service->delete_staff_member( $id );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log( 'staff_member.deleted', [ 'staff_member_id' => $id ] );

		return $this->success( [ 'deleted' => true ] );
	}

	/**
	 * Performs bulk actions on staff members.
	 *
	 * @param WP_REST_Request $request Incoming REST request.
	 * @return WP_REST_Response|\WP_Error
	 */
	public function bulk_staff_action( WP_REST_Request $request ): WP_REST_Response|\WP_Error {
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->service->bulk_staff_action( $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log( 'staff_member.bulk_action', [
			'action' => $params['action'] ?? '',
			'ids'    => $params['ids'] ?? [],
		] );

		return $this->success( $result );
	}

	/**
	 * Bulk imports staff members from array of parsed CSV rows.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function bulk_import( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->service->import_staff_bulk( $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log( 'staff_member.bulk_imported', [
			'imported_count' => $result['imported_count'] ?? 0,
			'failed_count'   => $result['failed_count'] ?? 0,
		] );

		return $this->success( $result );
	}

	/**
	 * Returns standard staff CSV template header and sample rows for download.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_import_template( WP_REST_Request $request ): WP_REST_Response {
		$headers = [
			'first_name', 'middle_name', 'last_name', 'email', 'phone',
			'department', 'designation', 'joined_on',
			'address', 'city', 'state', 'postal_code', 'country'
		];
		$sample1 = [
			'David', 'A.', 'Miller', 'david.miller@example.com', '+1-555-0210',
			'Mathematics', 'Senior Lecturer', '2024-08-15',
			'789 Oak Ave', 'Chicago', 'IL', '60601', 'US'
		];
		$sample2 = [
			'Sunita', '', 'Rao', 'sunita.rao@example.com', '+91-9876500000',
			'Science', 'Head of Department', '2023-06-01',
			'12 Church Street', 'Mumbai', 'Maharashtra', '400001', 'IN'
		];

		return $this->success( [
			'headers' => $headers,
			'samples' => [ $sample1, $sample2 ],
		] );
	}

	/**
	 * Handles public career / staff application form submission.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function public_submit_application( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		if ( ! $this->check_rate_limit( 'staff_public_submit', 15, 600 ) ) {
			return $this->error( 'rate_limit_exceeded', __( 'Too many submission requests. Please try again later.', 'codeclove-school-management' ), 429 );
		}

		$settings = get_option( 'codeclove_settings', [] );
		$enabled  = ! isset( $settings['staff_onboarding']['enable_form'] ) || ! empty( $settings['staff_onboarding']['enable_form'] );
		if ( ! $enabled ) {
			return $this->error( 'recruitment_closed', __( 'Staff applications are currently closed.', 'codeclove-school-management' ), 403 );
		}

		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			$params = $request->get_body_params();
		}

		$result = $this->service->submit_public_application( (array) $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return $this->success( $result, 201 );
	}

	/**
	 * Handles public staff application status lookup with mandatory secondary verification and rate limiting.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function public_lookup_status( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		if ( empty( get_option( 'codeclove_settings', [] )['staff_onboarding']['enable_status_lookup'] ?? true ) ) {
			return $this->error( 'lookup_disabled', __( 'Staff application status lookup is currently unavailable.', 'codeclove-school-management' ), 403 );
		}
		if ( ! $this->check_rate_limit( 'staff_status_lookup', 20, 600 ) ) {
			return $this->error( 'rate_limit_exceeded', __( 'Too many lookup requests. Please try again in a few minutes.', 'codeclove-school-management' ), 429 );
		}

		$ref   = $request->get_param( 'reference_number' ) ? sanitize_text_field( $request->get_param( 'reference_number' ) ) : '';
		$email = $request->get_param( 'email' ) ? sanitize_email( $request->get_param( 'email' ) ) : '';
		$dob   = $request->get_param( 'date_of_birth' ) ? sanitize_text_field( $request->get_param( 'date_of_birth' ) ) : '';

		if ( empty( $ref ) || ( empty( $email ) && empty( $dob ) ) ) {
			return $this->error( 'validation_failed', __( 'Reference number and either email address or date of birth are required.', 'codeclove-school-management' ), 400 );
		}

		$result = $this->service->lookup_public_status( $ref, $email, $dob );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return $this->success( $result );
	}
}
