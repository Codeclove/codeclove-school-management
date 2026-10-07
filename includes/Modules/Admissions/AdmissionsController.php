<?php
/**
 * Admissions REST API controller.
 *
 * Exposes REST routes to query, create, update, and transition status of:
 *   - Admissions Applications
 *
 * @package CodeClove\Modules\Admissions
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Admissions;

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
 * Class AdmissionsController
 */
final class AdmissionsController extends BaseController {

	private AdmissionsService $service;

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->service = new AdmissionsService();
	}

	/**
	 * Registers REST routes.
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/public/admissions',
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
			'/public/admissions/status',
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
			'/admissions',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_applications' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'admissions.view', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/admissions/bulk-action',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'bulk_admissions_action' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool {
						$action = $request->get_json_params()['action'] ?? '';
						$cap    = ( 'delete' === $action ) ? 'admissions.delete' : 'admissions.edit';
						return $this->can( $cap, $request );
					},
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/admissions/(?P<id>\d+)',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_application' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'admissions.view', $request ); },
				],
				[
					'methods'             => 'PATCH',
					'callback'            => [ $this, 'update_application' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'admissions.edit', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/admissions/(?P<id>\d+)/status',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'update_application_status' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'admissions.edit', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/admissions/(?P<id>\d+)/convert',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'convert_application' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'admissions.edit', $request ); },
				],
			]
		);
	}

	/**
	 * Gets applications matching arguments.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_applications( WP_REST_Request $request ): WP_REST_Response {
		$pagination = $this->get_pagination( $request );
		$args       = [
			'limit'               => $pagination['per_page'],
			'offset'              => $pagination['offset'],
			'search'              => $request->get_param( 'search' ) ? sanitize_text_field( $request->get_param( 'search' ) ) : '',
			'status'              => $request->get_param( 'status' ) ? sanitize_text_field( $request->get_param( 'status' ) ) : '',
			'academic_session_id' => $request->get_param( 'academic_session_id' ) ? (int) $request->get_param( 'academic_session_id' ) : null,
			'academic_unit_id'    => $request->get_param( 'academic_unit_id' ) ? (int) $request->get_param( 'academic_unit_id' ) : null,
			'date_from'           => $request->get_param( 'date_from' ) ? sanitize_text_field( $request->get_param( 'date_from' ) ) : '',
			'date_to'             => $request->get_param( 'date_to' ) ? sanitize_text_field( $request->get_param( 'date_to' ) ) : '',
			'orderby'             => $request->get_param( 'orderby' ) ? sanitize_text_field( $request->get_param( 'orderby' ) ) : '',
			'order'               => $request->get_param( 'order' ) ? sanitize_text_field( $request->get_param( 'order' ) ) : '',
		];

		$result = $this->service->get_applications( $args );

		return $this->paginated(
			$result['applications'],
			$result['total'],
			$pagination['page'],
			$pagination['per_page']
		);
	}

	/**
	 * Gets a single admissions application profile.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_application( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id  = (int) $request->get_param( 'id' );
		$app = $this->service->get_application( $id );

		if ( null === $app ) {
			return $this->error( 'not_found', __( 'Admissions application not found.', 'codeclove-school-management' ), 404 );
		}

		return $this->success( $app );
	}

	/**
	 * Updates admissions application parameters.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_application( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->service->update_application( $id, $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'admissions_application.updated',
			[
				'application_id' => $id,
				'student_name'   => $result['student_first_name'] . ' ' . $result['student_last_name'],
			]
		);

		return $this->success( $result );
	}

	/**
	 * Updates admissions pipeline status.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_application_status( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		if ( empty( $params['status'] ) ) {
			return $this->error( 'validation_failed', __( 'Status parameter is required.', 'codeclove-school-management' ), 400 );
		}

		$to_status = sanitize_text_field( $params['status'] );
		$reason    = isset( $params['reason'] ) ? sanitize_text_field( $params['reason'] ) : '';
		$message   = isset( $params['message'] ) ? sanitize_text_field( $params['message'] ) : '';
		$userId    = get_current_user_id();

		$result = $this->service->update_application_status( $id, $to_status, $reason, $message, $userId );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'admissions_application.status_changed',
			[
				'application_id' => $id,
				'to_status'      => $to_status,
			]
		);

		return $this->success( $result );
	}

	/**
	 * Converts an admission application to a registered student record.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function convert_application( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->service->convert_application( $id, $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'admissions_application.converted',
			[
				'application_id' => $id,
				'student_id'     => $result['converted_student_id'],
				'student_number' => $result['student_number'] ?? '',
			]
		);

		return $this->success( $result );
	}

	/**
	 * Performs bulk actions on admissions applications.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function bulk_admissions_action( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->service->bulk_action( $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'admissions_application.bulk_action',
			[
				'action' => $params['action'] ?? '',
				'count'  => count( $params['ids'] ?? [] ),
			]
		);

		return $this->success( $result );
	}

	/**
	 * Handles public admission form submissions.
	 */
	public function public_submit_application( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		if ( ! $this->check_rate_limit( 'admissions_public_submit', 15, 600 ) ) {
			return $this->error( 'rate_limit_exceeded', __( 'Too many submission requests. Please try again later.', 'codeclove-school-management' ), 429 );
		}

		$settings = get_option( 'codeclove_settings', [] );
		$enabled  = ! isset( $settings['admissions']['enable_public_form'] ) || ! empty( $settings['admissions']['enable_public_form'] );
		if ( ! $enabled ) {
			return $this->error( 'admissions_closed', __( 'Public admissions submissions are currently closed.', 'codeclove-school-management' ), 403 );
		}

		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			$params = $request->get_body_params();
		}

		$result = $this->service->submit_public_application( $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return $this->success( $result, 201 );
	}

	/**
	 * Handles public status lookups with mandatory secondary DOB verification and rate limiting.
	 */
	public function public_lookup_status( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		if ( empty( get_option( 'codeclove_settings', [] )['admissions']['enable_status_lookup'] ?? true ) ) {
			return $this->error( 'lookup_disabled', __( 'Status lookup service is currently unavailable.', 'codeclove-school-management' ), 403 );
		}
		if ( ! $this->check_rate_limit( 'admissions_status_lookup', 20, 600 ) ) {
			return $this->error( 'rate_limit_exceeded', __( 'Too many lookup requests. Please try again in a few minutes.', 'codeclove-school-management' ), 429 );
		}

		$ref = $request->get_param( 'reference_number' ) ? sanitize_text_field( $request->get_param( 'reference_number' ) ) : '';
		$dob = $request->get_param( 'student_date_of_birth' ) ? sanitize_text_field( $request->get_param( 'student_date_of_birth' ) ) : '';

		if ( empty( $ref ) || empty( $dob ) ) {
			return $this->error( 'validation_failed', __( 'Both reference number and student date of birth are required.', 'codeclove-school-management' ), 400 );
		}

		$result = $this->service->lookup_application_status( $ref, $dob );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return $this->success( $result );
	}
}
