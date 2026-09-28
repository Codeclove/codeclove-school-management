<?php
/**
 * Students REST API controller.
 *
 * Exposes REST routes to query, create, and update:
 *   - Student directory records
 *   - Linked Guardian profiles
 *   - Section capacity enrollment counts
 *
 * @package CodeClove\Modules\Students
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Students;

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
 * Class StudentsController
 */
final class StudentsController extends BaseController {

	private StudentsService $service;

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->service = new StudentsService();
	}

	/**
	 * Registers REST routes.
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/students',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_students' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'students.view', $request ); },
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'create_student' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'students.add', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/students/bulk-action',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'bulk_students_action' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'students.edit', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/students/bulk-import',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'bulk_import' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'students.add', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/students/import-template',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_import_template' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'students.view', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/students/enrollment-counts',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_enrollment_counts' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'students.view', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/students/guardians',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_guardians' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'guardians.view', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/students/(?P<id>\d+)',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_student' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'students.view', $request ); },
				],
				[
					'methods'             => 'PATCH',
					'callback'            => [ $this, 'update_student' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'students.edit', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/students/(?P<id>\d+)/transfer',
			[
				[
					'methods'             => 'PATCH',
					'callback'            => [ $this, 'transfer_student' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'students.edit', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/students/(?P<id>\d+)/portal-account',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'create_portal_account' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'students.edit', $request ); },
				],
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'unlink_portal_account' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'students.edit', $request ); },
				],
			]
		);
	}

	/**
	 * Gets students directory matching query filters.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_students( WP_REST_Request $request ): WP_REST_Response {
		$pagination = $this->get_pagination( $request );
		$args       = [
			'limit'               => $pagination['per_page'],
			'offset'              => $pagination['offset'],
			'search'              => $request->get_param( 'search' ) ? sanitize_text_field( $request->get_param( 'search' ) ) : '',
			'status'              => $request->get_param( 'status' ) ? sanitize_text_field( $request->get_param( 'status' ) ) : '',
			'academic_session_id' => $request->get_param( 'academic_session_id' ) ? (int) $request->get_param( 'academic_session_id' ) : null,
			'academic_unit_id'    => $request->get_param( 'academic_unit_id' ) ? (int) $request->get_param( 'academic_unit_id' ) : null,
			'academic_group_id'   => $request->get_param( 'academic_group_id' ) ? (int) $request->get_param( 'academic_group_id' ) : null,
			'orderby'             => $request->get_param( 'orderby' ) ? sanitize_text_field( $request->get_param( 'orderby' ) ) : '',
			'order'               => $request->get_param( 'order' ) ? sanitize_text_field( $request->get_param( 'order' ) ) : '',
		];

		$result = $this->service->get_students( $args );

		return $this->paginated(
			$result['students'],
			$result['total'],
			$pagination['page'],
			$pagination['per_page']
		);
	}

	/**
	 * Gets a single student directory record.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_student( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id      = (int) $request->get_param( 'id' );
		$student = $this->service->get_student( $id );

		if ( null === $student ) {
			return $this->error( 'not_found', __( 'Student not found.', 'codeclove-school-management' ), 404 );
		}

		return $this->success( $student );
	}

	/**
	 * Admits a new student record manually.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function create_student( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->service->create_student( $params );
		if ( is_wp_error( $result ) ) {
			$code = str_replace( 'codeclove_', '', $result->get_error_code() );
			return $this->error( $code, $result->get_error_message(), 400 );
		}

		AuditLogger::log(
			'student.admitted',
			[
				'student_id'     => $result['id'],
				'student_number' => $result['student_number'],
				'name'           => $result['first_name'] . ' ' . $result['last_name'],
			]
		);

		return $this->success( $result, 201 );
	}

	/**
	 * Updates a student and guardian profile.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_student( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->service->update_student( $id, $params );
		if ( is_wp_error( $result ) ) {
			$code = str_replace( 'codeclove_', '', $result->get_error_code() );
			return $this->error( $code, $result->get_error_message(), 400 );
		}

		AuditLogger::log(
			'student.updated',
			[
				'student_id' => $id,
				'name'       => $result['first_name'] . ' ' . $result['last_name'],
			]
		);

		return $this->success( $result );
	}

	/**
	 * Gets active enrollment counts grouped by group ID.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_enrollment_counts( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->service->get_group_enrollment_counts();
		return $this->success( $result );
	}

	/**
	 * Gets active guardians list.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_guardians( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->service->get_guardians();
		return $this->success( $result );
	}

	/**
	 * Transfers a student to a different class/section within the same session.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function transfer_student( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->service->transfer_student( $id, $params );
		if ( is_wp_error( $result ) ) {
			$code = str_replace( 'codeclove_', '', $result->get_error_code() );
			return $this->error( $code, $result->get_error_message(), (int) ( $result->get_error_data() ?? 400 ) );
		}

		AuditLogger::log(
			'student.transferred',
			[
				'student_id'     => $id,
				'target_unit_id' => $params['target_unit_id'] ?? null,
			]
		);

		return $this->success( $result );
	}

	/**
	 * Performs bulk actions on students.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function bulk_students_action( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->service->bulk_action( $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'students.bulk_action',
			[
				'action' => $params['action'] ?? '',
				'count'  => count( $params['ids'] ?? [] ),
			]
		);

		return $this->success( $result );
	}

	/**
	 * Bulk imports students from array of parsed CSV rows.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function bulk_import( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->service->import_students_bulk( $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'students.bulk_imported',
			[
				'imported_count' => $result['imported_count'] ?? 0,
				'failed_count'   => $result['failed_count'] ?? 0,
			]
		);

		return $this->success( $result );
	}

	/**
	 * Returns standard CSV template header and sample rows for download.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_import_template( WP_REST_Request $request ): WP_REST_Response {
		$headers = [
			'first_name', 'middle_name', 'last_name', 'date_of_birth', 'gender',
			'admission_number', 'admission_date',
			'father_first_name', 'father_last_name', 'father_email', 'father_phone',
			'mother_first_name', 'mother_last_name', 'mother_email', 'mother_phone',
			'guardian_first_name', 'guardian_last_name', 'guardian_email', 'guardian_phone', 'relationship',
			'address', 'city', 'state', 'postal_code', 'country'
		];
		$sample_us = [
			'John', 'Robert', 'Smith', '2012-05-14', 'male',
			'ADM-2026-001', '2026-06-01',
			'Michael', 'Smith', 'michael.smith@example.com', '+1-555-0199',
			'Sarah', 'Smith', 'sarah.smith@example.com', '+1-555-0198',
			'', '', '', '', '',
			'123 Maple St', 'New York', 'NY', '10001', 'US'
		];
		$sample_in = [
			'Aarav', '', 'Sharma', '2013-08-22', 'male',
			'ADM-2026-002', '2026-06-01',
			'Rajesh', 'Sharma', 'rajesh.sharma@example.com', '+91-9876543210',
			'Priya', 'Sharma', 'priya.sharma@example.com', '+91-9876543211',
			'', '', '', '', '',
			'45 MG Road', 'Bengaluru', 'Karnataka', '560001', 'IN'
		];

		return $this->success( [
			'headers' => $headers,
			'samples' => [ $sample_us, $sample_in ],
		] );
	}

	/**
	 * Creates a portal account for a student or guardian.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function create_portal_account( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$student_id = (int) $request->get_param( 'id' );
		$params     = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$type = isset( $params['type'] ) ? sanitize_key( (string) $params['type'] ) : 'student';
		if ( ! in_array( $type, [ 'student', 'guardian' ], true ) ) {
			return new WP_Error( 'invalid_type', __( 'Entity type must be "student" or "guardian".', 'codeclove-school-management' ), 400 );
		}

		if ( 'student' === $type ) {
			$entity_id = $student_id;
		} else {
			$entity_id = ! empty( $params['guardian_id'] ) ? (int) $params['guardian_id'] : 0;
			if ( $entity_id <= 0 ) {
				return new WP_Error( 'missing_guardian_id', __( 'guardian_id is required when creating a guardian portal account.', 'codeclove-school-management' ), 400 );
			}
		}

		$result = $this->service->create_portal_account( $entity_id, $type, $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'students.portal_account_created',
			[
				'student_id'  => $student_id,
				'type'        => $type,
				'entity_id'   => $entity_id,
				'wp_user_id'  => $result['user_id'] ?? null,
				'wp_username' => $result['username'] ?? null,
			]
		);

		return $this->success( $result, 201 );
	}

	/**
	 * Unlinks a portal account from a student or guardian.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function unlink_portal_account( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$student_id = (int) $request->get_param( 'id' );

		// Check query param first, then json body
		$type        = $request->get_param( 'type' );
		$guardian_id = $request->get_param( 'guardian_id' );

		$body = $this->json_body( $request );
		if ( ! is_wp_error( $body ) && is_array( $body ) ) {
			if ( empty( $type ) && isset( $body['type'] ) ) {
				$type = $body['type'];
			}
			if ( empty( $guardian_id ) && isset( $body['guardian_id'] ) ) {
				$guardian_id = $body['guardian_id'];
			}
		}

		$type = $type ? sanitize_key( (string) $type ) : 'student';
		if ( ! in_array( $type, [ 'student', 'guardian' ], true ) ) {
			return new WP_Error( 'invalid_type', __( 'Entity type must be "student" or "guardian".', 'codeclove-school-management' ), 400 );
		}

		if ( 'student' === $type ) {
			$entity_id = $student_id;
		} else {
			$entity_id = ! empty( $guardian_id ) ? (int) $guardian_id : 0;
			if ( $entity_id <= 0 ) {
				return new WP_Error( 'missing_guardian_id', __( 'guardian_id is required when unlinking a guardian portal account.', 'codeclove-school-management' ), 400 );
			}
		}

		$result = $this->service->unlink_portal_account( $entity_id, $type );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'students.portal_account_unlinked',
			[
				'student_id' => $student_id,
				'type'       => $type,
				'entity_id'  => $entity_id,
			]
		);

		return $this->success( [ 'unlinked' => true ] );
	}
}
