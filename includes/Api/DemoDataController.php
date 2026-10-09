<?php
/**
 * Demo Data REST controller.
 *
 * Provides endpoints for 1-click importing, clearing, and checking the status
 * of demo school data.
 *
 * @package CodeClove\Api
 */

declare( strict_types=1 );

namespace CodeClove\Api;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Modules\Settings\DemoDataService;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class DemoDataController
 */
final class DemoDataController extends BaseController {

	/**
	 * Demo data service instance.
	 */
	private DemoDataService $service;

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->service = new DemoDataService();
	}

	/**
	 * Registers REST routes for demo data management.
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/demo-data/import',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'import' ],
					'permission_callback' => [ $this, 'check_permission' ],
					'args'                => [
						'country' => [
							'required'          => false,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						],
					],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/demo-data/clear',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'clear' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/demo-data/status',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'status' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);
		register_rest_route(
			$this->namespace,
			'/demo-data/dismiss',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'dismiss' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);
	}

	/**
	 * Permission callback requiring manage_options or CodeClove system.manage / settings.manage.
	 *
	 * @param WP_REST_Request $request Request instance.
	 * @return bool
	 */
	public function check_permission( WP_REST_Request $request ): bool {
		if ( ! is_user_logged_in() ) {
			return false;
		}

		if ( ! $this->verify_nonce( $request ) ) {
			return false;
		}

		$user_id = get_current_user_id();

		return current_user_can( 'manage_options' )
			|| ( function_exists( 'codeclove_user_can' ) && ( codeclove_user_can( $user_id, 'system.manage' ) || codeclove_user_can( $user_id, 'settings.manage' ) ) );
	}

	/**
	 * Imports demo data.
	 *
	 * @param WP_REST_Request $request Request instance.
	 * @return WP_REST_Response|WP_Error
	 */
	public function import( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$params  = $this->json_body( $request );
		$country = 'IN';

		if ( is_array( $params ) && ! empty( $params['country'] ) ) {
			$country = sanitize_text_field( (string) $params['country'] );
		} elseif ( $request->get_param( 'country' ) ) {
			$country = sanitize_text_field( (string) $request->get_param( 'country' ) );
		}

		$result = $this->service->import( $country );

		if ( ! $result['success'] ) {
			return $this->error( 'import_failed', $result['message'], 400 );
		}

		return $this->success( $result );
	}

	/**
	 * Clears demo data.
	 *
	 * @param WP_REST_Request $request Request instance.
	 * @return WP_REST_Response|WP_Error
	 */
	public function clear( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$result = $this->service->clear();

		if ( ! $result['success'] ) {
			return $this->error( 'clear_failed', $result['message'], 400 );
		}

		return $this->success( $result );
	}

	/**
	 * Returns current demo data status.
	 *
	 * @param WP_REST_Request $request Request instance.
	 * @return WP_REST_Response
	 */
	public function status( WP_REST_Request $request ): WP_REST_Response {
		$status = $this->service->status();

		return $this->success( $status );
	}

	/**
	 * Dismisses the demo data onboarding prompt.
	 *
	 * @param WP_REST_Request $request Request instance.
	 * @return WP_REST_Response
	 */
	public function dismiss( WP_REST_Request $request ): WP_REST_Response {
		$this->service->dismiss_prompt();

		return $this->success( [
			'success' => true,
			'message' => __( 'Demo data prompt dismissed.', 'codeclove-school-management' ),
		] );
	}
}
