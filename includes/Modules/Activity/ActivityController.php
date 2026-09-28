<?php
/**
 * Activity log REST API controller.
 *
 * Exposes GET /codeclove/v1/activity-log to retrieve school audit trail.
 * Gated by 'settings.manage' (which WP admins bypass).
 *
 * @package CodeClove\Modules\Activity
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Activity;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Api\BaseController;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Class ActivityController
 */
final class ActivityController extends BaseController {

	private ActivityService $service;

	public function __construct() {
		$this->service = new ActivityService();
	}

	/**
	 * Registers REST routes.
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/activity-log',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_log' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'settings.manage', $request ); },
				],
			]
		);
	}

	/**
	 * Returns filterable and paginated activity logs.
	 */
	public function get_log( WP_REST_Request $request ): WP_REST_Response {
		$params = [
			'page'      => (int) ( $request->get_param( 'page' ) ?: 1 ),
			'per_page'  => (int) ( $request->get_param( 'per_page' ) ?: 25 ),
			'category'  => $request->get_param( 'category' ),
			'search'    => $request->get_param( 'search' ),
			'date_from' => $request->get_param( 'date_from' ),
			'date_to'   => $request->get_param( 'date_to' ),
		];

		$result = $this->service->get_log( $params );

		return $this->paginated(
			$result['items'],
			$result['total'],
			$params['page'],
			$params['per_page']
		);
	}
}
