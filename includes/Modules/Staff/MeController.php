<?php
/**
 * REST API Controller for /me (My Account).
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
use CodeClove\Database\Schema;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class MeController
 */
final class MeController extends BaseController {

	/**
	 * Staff service instance.
	 */
	private StaffService $service;

	/**
	 * MeController Constructor.
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
			'/me',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_me' ],
					'permission_callback' => [ $this, 'check_auth' ],
				],
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'update_me' ],
					'permission_callback' => [ $this, 'check_auth' ],
				],
			]
		);
	}

	/**
	 * Permission callback ensuring user is authenticated and nonce is valid.
	 *
	 * @param WP_REST_Request|null $request Incoming request.
	 */
	public function check_auth( ?WP_REST_Request $request = null ): bool {
		if ( ! is_user_logged_in() ) {
			return false;
		}

		// Deny WP administrators from accessing self-service profile endpoint.
		if ( current_user_can( 'manage_options' ) ) {
			return false;
		}

		return $this->verify_nonce( $request );
	}

	/**
	 * Resolves the CodeClove staff_member ID for the current WP user.
	 */
	private function get_current_staff_id(): ?int {
		global $wpdb;
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$staff_id = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM ' . Schema::staff_members() . ' WHERE user_id = %d AND deleted_at IS NULL',
				get_current_user_id()
			)
		);
		// phpcs:enable
		return $staff_id ? (int) $staff_id : null;
	}

	/**
	 * Get own staff profile.
	 */
	public function get_me(): WP_REST_Response|WP_Error {
		$staff_id = $this->get_current_staff_id();
		if ( ! $staff_id ) {
			return $this->error( 'not_found', __( 'No linked staff profile found for this user.', 'codeclove-school-management' ), 404 );
		}

		$item = $this->service->get_staff_member( $staff_id );
		if ( ! $item ) {
			return $this->error( 'not_found', __( 'Staff profile details not found.', 'codeclove-school-management' ), 404 );
		}

		return $this->success( $item );
	}

	/**
	 * Update own staff profile (name, phone, photo, password).
	 */
	public function update_me( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$staff_id = $this->get_current_staff_id();
		if ( ! $staff_id ) {
			return $this->error( 'not_found', __( 'No linked staff profile found for this user.', 'codeclove-school-management' ), 404 );
		}

		$body = $this->json_body( $request );
		if ( $body instanceof WP_Error ) {
			return $body;
		}

		// Prevent self-modifying sensitive administrative fields
		unset( $body['role_id'], $body['status'], $body['user_id'], $body['staff_number'] );

		// Password update requires current password check
		if ( ! empty( $body['new_password'] ) ) {
			if ( empty( $body['current_password'] ) ) {
				return $this->error( 'validation_failed', __( 'Current password is required to set a new password.', 'codeclove-school-management' ), 400 );
			}
			$wp_user = get_userdata( get_current_user_id() );
			if ( ! $wp_user || ! wp_check_password( $body['current_password'], $wp_user->user_pass, get_current_user_id() ) ) {
				return $this->error( 'validation_failed', __( 'Incorrect current password.', 'codeclove-school-management' ), 400 );
			}
			if ( strlen( $body['new_password'] ) < 6 ) {
				return $this->error( 'validation_failed', __( 'New password must be at least 6 characters.', 'codeclove-school-management' ), 400 );
			}

			// Map it to 'password' for StaffService update flow
			$body['password'] = $body['new_password'];
		}

		// Perform update
		$result = $this->service->update_staff_member( (int) $staff_id, $body );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return $this->success( $result );
	}
}
