<?php
/**
 * Base REST controller.
 *
 * All Nexora module controllers extend this class to get:
 *   - Consistent response formatting (success/error envelopes)
 *   - RBAC permission checking (Nexora roles or WP admin fallback)
 *   - Pagination helpers
 *   - Validated request data helpers
 *
 * @package Nexora\Api
 */

declare( strict_types=1 );

namespace Nexora\Api;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Nexora\Core\Logger;
use Nexora\Licensing\License;
use WP_Error;
use WP_REST_Controller;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class BaseController
 */
abstract class BaseController extends WP_REST_Controller {

	/**
	 * REST API namespace shared by all Nexora routes.
	 *
	 * @var string
	 */
	protected $namespace = RestApi::NAMESPACE;

	/**
	 * Default per-page limit for paginated list endpoints.
	 */
	protected int $default_per_page = 25;

	/**
	 * Maximum per-page limit to prevent over-fetching.
	 */
	protected int $max_per_page = 100;

	// ─── Permission Helpers ───────────────────────────────────────────────────

	/**
	 * Checks whether the current user has a given Nexora permission key.
	 *
	 * WordPress administrators bypass Nexora RBAC and always have access.
	 * This is the standard WP admin recovery mechanism documented in PERMISSIONS.md.
	 *
	 * @param string $permission Dot-notation key, e.g. 'students.view'.
	 */
	protected function can( string $permission, ?WP_REST_Request $request = null ): bool {
		if ( ! is_user_logged_in() ) {
			return false;
		}

		// License gate — applies to everyone, including WP admins (Pro only).
		if ( class_exists( '\Nexora\Licensing\License' ) && ( ! \Nexora\Licensing\License::verified() || ! \Nexora\Licensing\License::verify_integrity() ) ) {
			return false;
		}

		// CSRF nonce verification for cookie-authenticated requests.
		if ( ! $this->verify_nonce( $request ) ) {
			return false;
		}

		// WP admins bypass Nexora RBAC.
		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}

		return \Nexora\Core\Permissions::check( get_current_user_id(), $permission );
	}

	/**
	 * Verifies the WordPress REST nonce for cookie-authenticated requests.
	 *
	 * @param WP_REST_Request|null $request
	 * @return bool True if nonce is valid or not required; false if verification fails.
	 */
	protected function verify_nonce( ?WP_REST_Request $request = null ): bool {
		// ponytail: bypass CLI contexts and requests where LOGGED_IN_COOKIE is absent.
		$is_cli = defined( 'WP_CLI' ) && WP_CLI;
		if ( $is_cli && defined( 'NEXORA_TEST_NONCE' ) ) {
			$is_cli = false;
		}
		if ( ! $is_cli && defined( 'LOGGED_IN_COOKIE' ) && isset( $_COOKIE[ LOGGED_IN_COOKIE ] ) ) {
			$nonce = '';
			if ( $request instanceof WP_REST_Request ) {
				$nonce = $request->get_header( 'X-WP-Nonce' ) ?: '';
			}
			if ( empty( $nonce ) && isset( $_SERVER['HTTP_X_WP_NONCE'] ) ) {
				$nonce = sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_WP_NONCE'] ) );
			}
			if ( ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Returns a permission callback that accepts a specific permission key.
	 *
	 * Usage in register_routes():
	 *   'permission_callback' => $this->permission( 'students.view' )
	 *
	 * @param string $permission Dot-notation permission key.
	 * @return callable
	 */
	protected function permission( string $permission ): callable {
		return function ( WP_REST_Request $request ) use ( $permission ): bool {
			return $this->can( $permission, $request );
		};
	}

	/**
	 * Returns a permission callback that passes if any of the given permission keys are allowed.
	 *
	 * @param string ...$permissions Dot-notation permission keys.
	 * @return callable
	 */
	protected function any_permission( string ...$permissions ): callable {
		return function ( WP_REST_Request $request ) use ( $permissions ): bool {
			foreach ( $permissions as $p ) {
				if ( $this->can( $p, $request ) ) {
					return true;
				}
			}
			return false;
		};
	}

	/**
	 * Returns a permission callback requiring an authenticated user with a valid nonce.
	 */
	protected function authenticated(): callable {
		return function ( ?WP_REST_Request $request = null ): bool {
			$license_ok = ! class_exists( '\Nexora\Licensing\License' ) || ( \Nexora\Licensing\License::verified() && \Nexora\Licensing\License::verify_integrity() );
			return is_user_logged_in()
				&& $license_ok
				&& $this->verify_nonce( $request );
		};
	}

	// ─── Response Helpers ────────────────────────────────────────────────────

	/**
	 * Returns a standardised success response.
	 *
	 * @param mixed $data   Response payload.
	 * @param int   $status HTTP status code. Default 200.
	 */
	protected function success( mixed $data, int $status = 200 ): WP_REST_Response {
		return new WP_REST_Response(
			[
				'success' => true,
				'data'    => $data,
			],
			$status
		);
	}

	/**
	 * Returns a standardised success response with pagination metadata.
	 *
	 * @param mixed $data     List of items.
	 * @param int   $total    Total record count (before pagination).
	 * @param int   $page     Current page.
	 * @param int   $per_page Items per page.
	 */
	protected function paginated(
		mixed $data,
		int $total,
		int $page,
		int $per_page
	): WP_REST_Response {
		return new WP_REST_Response(
			[
				'success'    => true,
				'data'       => $data,
				'pagination' => [
					'total'        => $total,
					'per_page'     => $per_page,
					'current_page' => $page,
					'total_pages'  => (int) ceil( $total / max( 1, $per_page ) ),
				],
			],
			200
		);
	}

	/**
	 * Returns a standardised error response.
	 *
	 * @param string $code    Machine-readable error code, e.g. 'not_found'.
	 * @param string $message Human-readable error message.
	 * @param int    $status  HTTP status code. Default 400.
	 */
	protected function error(
		string $code,
		string $message,
		int $status = 400
	): WP_Error {
		if ( $status >= 500 ) {
			Logger::error( sprintf( 'REST API Error [%s]: %s', $code, $message ), [ 'status' => $status ] );
		}

		return new WP_Error(
			'nexora_' . $code,
			$message,
			[ 'status' => $status ]
		);
	}

	// ─── Request Helpers ─────────────────────────────────────────────────────

	/**
	 * Extracts and sanitises pagination parameters from a REST request.
	 *
	 * @param WP_REST_Request $request Incoming request.
	 * @return array{page: int, per_page: int, offset: int}
	 */
	protected function get_pagination( WP_REST_Request $request ): array {
		$raw_per_page = $request->get_param( 'per_page' );
		$all          = 'all' === $raw_per_page || -1 === (int) $raw_per_page;
		$page         = $all ? 1 : max( 1, (int) $request->get_param( 'page' ) );
		$per_page     = $all ? 10000 : min( $this->max_per_page, max( 1, (int) $raw_per_page ?: $this->default_per_page ) );

		return [
			'page'     => $page,
			'per_page' => $per_page,
			'offset'   => ( $page - 1 ) * $per_page,
		];
	}

	/**
	 * Extracts and validates the JSON request body.
	 *
	 * @param WP_REST_Request $request REST request object.
	 * @return array|WP_Error Array of body params, or WP_Error if not a JSON object.
	 */
	protected function json_body( WP_REST_Request $request ): array|WP_Error {
		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			return $this->error( 'invalid_body', __( 'Request body must be a JSON object.', 'nexora-school-management' ), 400 );
		}
		return $params;
	}

	/**
	 * Enforces a transient-based IP rate limit.
	 *
	 * @param string $action Unique action name.
	 * @param int    $limit  Max allowed requests within the window.
	 * @param int    $window Time window in seconds. Default 600 (10 mins).
	 * @return bool True if allowed, false if limit exceeded.
	 */
	protected function check_rate_limit( string $action, int $limit = 20, int $window = 600 ): bool {
		// ponytail: transient-based rate limiter, single-server cache ceiling.
		$key   = 'nexora_rl_' . md5( $action . '_' . sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1' ) ) );
		$count = (int) get_transient( $key );
		if ( $count >= $limit ) {
			return false;
		}
		set_transient( $key, $count + 1, $window );
		return true;
	}
}
