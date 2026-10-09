<?php
/**
 * Review Prompt REST API Controller.
 *
 * Handles dismissal and snoozing actions for the WordPress.org review prompt banner.
 *
 * @package CodeClove\Api
 */

declare( strict_types=1 );

namespace CodeClove\Api;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Modules\Settings\ReviewPromptService;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class ReviewPromptController
 */
final class ReviewPromptController extends BaseController {

	/**
	 * Registers REST routes for the review prompt.
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/review-prompt/dismiss',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'dismiss' ],
					'permission_callback' => [ $this, 'check_permission' ],
					'args'                => [
						'action' => [
							'required'          => true,
							'type'              => 'string',
							'enum'              => [ 'reviewed', 'maybe_later', 'never' ],
							'sanitize_callback' => 'sanitize_text_field',
						],
					],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/review-prompt/status',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'status' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
				'schema' => [ $this, 'get_item_schema' ],
			]
		);

		register_rest_route(
			$this->namespace,
			'/review-prompt',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'status' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
				'schema' => [ $this, 'get_item_schema' ],
			]
		);
	}

	/**
	 * Permission callback requiring manage_options capability.
	 *
	 * @param WP_REST_Request $request REST request instance.
	 * @return bool
	 */
	public function check_permission( WP_REST_Request $request ): bool {
		if ( ! is_user_logged_in() ) {
			return false;
		}

		if ( ! $this->verify_nonce( $request ) ) {
			return false;
		}

		return current_user_can( 'manage_options' );
	}

	/**
	 * Dismisses or snoozes the review prompt.
	 *
	 * @param WP_REST_Request $request REST request instance.
	 * @return WP_REST_Response|WP_Error
	 */
	public function dismiss( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$action = (string) $request->get_param( 'action' );

		if ( ! in_array( $action, [ 'reviewed', 'maybe_later', 'never' ], true ) ) {
			return new WP_Error(
				'rest_invalid_param',
				__( 'Invalid review prompt action.', 'codeclove-school-management' ),
				[ 'status' => 400 ]
			);
		}

		$result = ReviewPromptService::dismiss( $action );

		if ( ! $result ) {
			return new WP_Error(
				'dismiss_failed',
				__( 'Failed to record review prompt dismissal.', 'codeclove-school-management' ),
				[ 'status' => 500 ]
			);
		}

		return $this->success( [
			'dismissed' => true,
			'action'    => $action,
		] );
	}

	/**
	 * Returns current review prompt status.
	 *
	 * @param WP_REST_Request $request REST request instance.
	 * @return WP_REST_Response
	 */
	public function status( WP_REST_Request $request ): WP_REST_Response {
		$status = ReviewPromptService::get_status();

		return $this->success( $status );
	}

}
