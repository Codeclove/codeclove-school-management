<?php
/**
 * Dashboard REST API controller.
 *
 * Single endpoint: GET /nexora/v1/dashboard/stats
 * Returns only the stats the current user is permitted to see.
 * The permission_callback requires dashboard.view; individual
 * stat buckets are gated server-side by their own permissions.
 *
 * @package Nexora\Modules\Dashboard
 */

declare( strict_types=1 );

namespace Nexora\Modules\Dashboard;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Nexora\Api\BaseController;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class DashboardController
 */
final class DashboardController extends BaseController {

	private DashboardService $service;

	public function __construct() {
		$this->service = new DashboardService();
	}

	/**
	 * Registers REST routes.
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/dashboard/stats',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_stats' ],
					'permission_callback' => $this->permission( 'dashboard.view' ),
				],
			]
		);
	}

	/**
	 * Returns dashboard statistics for the current user.
	 *
	 * Query params:
	 *   session_id int  — filters session-scoped stats (optional)
	 *   range      string — 'week'|'month'|'year' for trend data (default month)
	 *
	 * @param WP_REST_Request $request Incoming request.
	 */
	public function get_stats( WP_REST_Request $request ): WP_REST_Response {
		if ( ! is_user_logged_in() ) {
			return $this->success( [] );
		}

		$user_id    = get_current_user_id();
		$session_id = (int) ( $request->get_param( 'session_id' ) ?: 0 );
		$range      = in_array( $request->get_param( 'range' ), [ 'today', 'term', 'session', '30days' ], true )
			? $request->get_param( 'range' )
			: 'term';

		return $this->success(
			$this->service->get_stats( $user_id, $session_id, $range )
		);
	}
}
