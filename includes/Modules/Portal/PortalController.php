<?php
/**
 * Portal REST API controller.
 *
 * Exposes REST routes for the Student & Guardian Portal:
 * - /portal/me (User context, current roles, student list)
 * - /portal/dashboard (Dashboard statistics & overview)
 * - /portal/attendance (Monthly attendance register & counts)
 * - /portal/finance (Invoice history & fee summaries)
 * - /portal/timetable (Weekly class schedule)
 * - /portal/academics (Enrollment details & subjects)
 * - /portal/notifications (User notification inbox)
 * - /portal/notifications/read (Mark notifications read)
 * - /portal/documents (Admission documents)
 * - /portal/profile (Student and linked guardian details)
 *
 * @package CodeClove\Modules\Portal
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Portal;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Api\BaseController;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class PortalController
 */
final class PortalController extends BaseController {

	/**
	 * Portal service instance.
	 */
	private PortalService $service;

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->service = new PortalService();
	}

	/**
	 * Registers REST routes for the portal.
	 */
	public function register_routes(): void {
		// User Context & Student Selector
		register_rest_route(
			$this->namespace,
			'/portal/me',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_me' ],
					'permission_callback' => [ $this, 'check_auth' ],
				],
			]
		);

		// Dashboard Overview
		register_rest_route(
			$this->namespace,
			'/portal/dashboard',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_dashboard' ],
					'permission_callback' => [ $this, 'check_auth' ],
					'args'                => [
						'student_id' => [
							'required'          => false,
							'validate_callback' => static fn( $param ) => is_numeric( $param ),
							'sanitize_callback' => 'absint',
						],
					],
				],
			]
		);

		// Attendance View
		register_rest_route(
			$this->namespace,
			'/portal/attendance',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_attendance' ],
					'permission_callback' => [ $this, 'check_auth' ],
					'args'                => [
						'student_id' => [
							'required'          => false,
							'validate_callback' => static fn( $param ) => is_numeric( $param ),
							'sanitize_callback' => 'absint',
						],
						'month'      => [
							'required'          => false,
							'validate_callback' => static fn( $param ) => is_string( $param ),
							'sanitize_callback' => 'sanitize_text_field',
						],
					],
				],
			]
		);

		// Finance & Invoices View
		register_rest_route(
			$this->namespace,
			'/portal/finance',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_finance' ],
					'permission_callback' => [ $this, 'check_auth' ],
					'args'                => [
						'student_id' => [
							'required'          => false,
							'validate_callback' => static fn( $param ) => is_numeric( $param ),
							'sanitize_callback' => 'absint',
						],
					],
				],
			]
		);

		// Timetable Schedule View
		register_rest_route(
			$this->namespace,
			'/portal/timetable',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_timetable' ],
					'permission_callback' => [ $this, 'check_auth' ],
					'args'                => [
						'student_id' => [
							'required'          => false,
							'validate_callback' => static fn( $param ) => is_numeric( $param ),
							'sanitize_callback' => 'absint',
						],
					],
				],
			]
		);

		// Academics & Subjects View
		register_rest_route(
			$this->namespace,
			'/portal/academics',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_academics' ],
					'permission_callback' => [ $this, 'check_auth' ],
					'args'                => [
						'student_id' => [
							'required'          => false,
							'validate_callback' => static fn( $param ) => is_numeric( $param ),
							'sanitize_callback' => 'absint',
						],
					],
				],
			]
		);

		// Notifications View
		register_rest_route(
			$this->namespace,
			'/portal/notifications',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_notifications' ],
					'permission_callback' => [ $this, 'check_auth' ],
					'args'                => [
						'student_id' => [
							'required'          => false,
							'validate_callback' => static fn( $param ) => is_numeric( $param ),
							'sanitize_callback' => 'absint',
						],
						'page'       => [
							'required'          => false,
							'default'           => 1,
							'sanitize_callback' => 'absint',
						],
						'per_page'   => [
							'required'          => false,
							'default'           => 20,
							'sanitize_callback' => 'absint',
						],
					],
				],
			]
		);

		// Mark Notification(s) as Read
		register_rest_route(
			$this->namespace,
			'/portal/notifications/read',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'mark_notification_read' ],
					'permission_callback' => [ $this, 'check_auth' ],
					'args'                => [
						'student_id' => [
							'required'          => false,
							'validate_callback' => static fn( $param ) => is_numeric( $param ),
							'sanitize_callback' => 'absint',
						],
						'id'         => [
							'required'          => false,
							'validate_callback' => static fn( $param ) => is_numeric( $param ),
							'sanitize_callback' => 'absint',
						],
					],
				],
			]
		);

		// Documents View
		register_rest_route(
			$this->namespace,
			'/portal/documents',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_documents' ],
					'permission_callback' => [ $this, 'check_auth' ],
					'args'                => [
						'student_id' => [
							'required'          => false,
							'validate_callback' => static fn( $param ) => is_numeric( $param ),
							'sanitize_callback' => 'absint',
						],
					],
				],
			]
		);

		// Profile View
		register_rest_route(
			$this->namespace,
			'/portal/profile',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_profile' ],
					'permission_callback' => [ $this, 'check_auth' ],
					'args'                => [
						'student_id' => [
							'required'          => false,
							'validate_callback' => static fn( $param ) => is_numeric( $param ),
							'sanitize_callback' => 'absint',
						],
					],
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'update_profile' ],
					'permission_callback' => [ $this, 'check_auth' ],
					'args'                => [
						'student_id' => [
							'required'          => false,
							'validate_callback' => static fn( $param ) => is_numeric( $param ),
							'sanitize_callback' => 'absint',
						],
					],
				],
			]
		);
	}

	/**
	 * Checks authentication and CSRF nonce verification for portal requests.
	 *
	 * @param WP_REST_Request $request Incoming request.
	 * @return bool True if logged in and nonce valid.
	 */
	public function check_auth( WP_REST_Request $request ): bool {
		if ( ! is_user_logged_in() ) {
			return false;
		}

		return $this->verify_nonce( $request );
	}

	/**
	 * Helper to resolve and authorize the student ID for a request.
	 * Falls back to default student if omitted.
	 *
	 * @param WP_REST_Request $request
	 * @return int|WP_Error Student ID or WP_Error on failure.
	 */
	private function resolve_student_id( WP_REST_Request $request ): int|WP_Error {
		$user_id    = get_current_user_id();
		$student_id = (int) $request->get_param( 'student_id' );

		if ( $student_id <= 0 ) {
			$context    = $this->service->get_portal_user_context( $user_id );
			$student_id = (int) ( $context['default_student_id'] ?? 0 );
		}

		if ( $student_id <= 0 ) {
			return $this->error( 'not_found', __( 'No student profile found for this account.', 'codeclove-school-management' ), 404 );
		}

		if ( ! $this->service->verify_student_access( $user_id, $student_id ) ) {
			return $this->error( 'forbidden', __( 'You do not have access to this student.', 'codeclove-school-management' ), 403 );
		}

		return $student_id;
	}

	/**
	 * GET /portal/me
	 */
	public function get_me(): WP_REST_Response {
		$context = $this->service->get_portal_user_context( get_current_user_id() );
		return $this->success( $context );
	}

	/**
	 * GET /portal/dashboard
	 */
	public function get_dashboard( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$student_id = $this->resolve_student_id( $request );
		if ( is_wp_error( $student_id ) ) {
			return $student_id;
		}

		$summary = $this->service->get_dashboard_summary( $student_id, get_current_user_id() );
		return $this->success( $summary );
	}

	/**
	 * GET /portal/attendance
	 */
	public function get_attendance( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$student_id = $this->resolve_student_id( $request );
		if ( is_wp_error( $student_id ) ) {
			return $student_id;
		}

		$month = sanitize_text_field( (string) $request->get_param( 'month' ) );
		$data  = $this->service->get_attendance( $student_id, $month );
		return $this->success( $data );
	}

	/**
	 * GET /portal/finance
	 */
	public function get_finance( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$student_id = $this->resolve_student_id( $request );
		if ( is_wp_error( $student_id ) ) {
			return $student_id;
		}

		$data = $this->service->get_finance( $student_id );
		return $this->success( $data );
	}

	/**
	 * GET /portal/timetable
	 */
	public function get_timetable( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$student_id = $this->resolve_student_id( $request );
		if ( is_wp_error( $student_id ) ) {
			return $student_id;
		}

		return $this->success( $this->service->get_timetable( $student_id ) );
	}

	/**
	 * GET /portal/academics
	 */
	public function get_academics( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$student_id = $this->resolve_student_id( $request );
		if ( is_wp_error( $student_id ) ) {
			return $student_id;
		}

		$data = $this->service->get_academics( $student_id );
		return $this->success( $data );
	}

	/**
	 * GET /portal/notifications
	 */
	public function get_notifications( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$student_id = $this->resolve_student_id( $request );
		if ( is_wp_error( $student_id ) ) {
			return $student_id;
		}

		$page     = max( 1, (int) $request->get_param( 'page' ) );
		$per_page = min( 100, max( 1, (int) $request->get_param( 'per_page' ) ) );

		$data = $this->service->get_notifications( $student_id, $page, $per_page );
		return $this->success( $data );
	}

	/**
	 * POST /portal/notifications/read
	 */
	public function mark_notification_read( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$student_id = $this->resolve_student_id( $request );
		if ( is_wp_error( $student_id ) ) {
			return $student_id;
		}

		$id = absint( $request->get_param( 'id' ) );

		$this->service->mark_notification_read( $student_id, $id );
		return $this->success( [ 'success' => true ] );
	}

	/**
	 * GET /portal/documents
	 */
	public function get_documents( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$student_id = $this->resolve_student_id( $request );
		if ( is_wp_error( $student_id ) ) {
			return $student_id;
		}

		$data = $this->service->get_documents( $student_id );
		return $this->success( $data );
	}

	/**
	 * GET /portal/profile
	 */
	public function get_profile( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$student_id = $this->resolve_student_id( $request );
		if ( is_wp_error( $student_id ) ) {
			return $student_id;
		}

		$data = $this->service->get_profile( $student_id );
		return $this->success( $data );
	}

	/**
	 * POST /portal/profile
	 */
	public function update_profile( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$student_id = $this->resolve_student_id( $request );
		if ( is_wp_error( $student_id ) ) {
			return $student_id;
		}

		$payload = $request->get_json_params() ?: [];
		$user_id = (int) get_current_user_id();

		$result = $this->service->update_profile( $user_id, $student_id, $payload );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return $this->success( $result );
	}
}
