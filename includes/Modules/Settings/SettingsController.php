<?php
/**
 * Settings REST API controller.
 *
 * Exposes REST routes to read/patch settings, load country presets,
 * and clear option cache. Secured via 'settings.manage' permission.
 *
 * @package CodeClove\Modules\Settings
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Settings;

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
 * Class SettingsController
 */
final class SettingsController extends BaseController {

	private SettingsRepository $repository;
	private PresetsService $presets;
	private SettingsValidator $validator;

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->repository = new SettingsRepository();
		$this->presets    = new PresetsService();
		$this->validator  = new SettingsValidator();
	}

	/**
	 * Registers REST routes.
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/settings',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_settings' ],
					'permission_callback' => [ $this, 'check_read_auth' ],
				],
				[
					'methods'             => 'PATCH',
					'callback'            => [ $this, 'update_settings' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'settings.manage', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/presets',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_presets' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'settings.manage', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/presets/(?P<code>[a-zA-Z]{2})',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_preset' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'settings.manage', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/presets/(?P<code>[a-zA-Z]{2})/apply',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'apply_preset' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'settings.manage', $request ); },
					'args'                => [
						'mode' => [
							'required'          => true,
							'type'              => 'string',
							'enum'              => [ 'replace_defaults', 'missing_only', 'preview' ],
							'sanitize_callback' => 'sanitize_text_field',
						],
					],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/settings/diagnostics',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_diagnostics' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'settings.manage', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/settings/clear-cache',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'clear_cache' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'settings.manage', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/settings/health',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_health' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'settings.manage', $request ); },
				],
			]
		);
	}

	/**
	 * Gets the current active settings.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_settings( WP_REST_Request $request ): WP_REST_Response {
		$user_id    = get_current_user_id();
		$can_manage = codeclove_user_can( $user_id, 'settings.manage' );

		$settings = $this->repository->get_settings( true );

		if ( ! $can_manage ) {
			// Strip sensitive backend infrastructure configuration for non-administrative viewers
			unset( $settings['notifications'], $settings['system'] );
			if ( isset( $settings['admissions']['notification_recipients'] ) ) {
				unset( $settings['admissions']['notification_recipients'] );
			}
			if ( isset( $settings['staff_onboarding']['notification_recipients'] ) ) {
				unset( $settings['staff_onboarding']['notification_recipients'] );
			}
		}

		return $this->success( $settings );
	}
	/**
	 * Updates settings.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_settings( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$params = $request->get_json_params();

		if ( ! is_array( $params ) ) {
			return $this->error( 'invalid_body', __( 'Request body must be a JSON object.', 'codeclove-school-management' ), 400 );
		}

		$validated = $this->validator->validate_patch( $params );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$before = $this->repository->get_settings();
		$after  = $this->repository->update_settings( $validated );

		$changed_sections = $this->changed_sections( $before, $after );
		if ( [] !== $changed_sections ) {
			AuditLogger::log(
				'settings.updated',
				[ 'sections' => $changed_sections ]
			);
		}

		if ( isset( $after['notifications']['smtp_password'] ) && ! empty( $after['notifications']['smtp_password'] ) ) {
			$after['notifications']['smtp_password'] = '********';
		}

		return $this->success( $after );
	}

	/**
	 * Gets the list of available presets.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_presets( WP_REST_Request $request ): WP_REST_Response {
		return $this->success( $this->presets->get_presets() );
	}

	/**
	 * Gets one country preset.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_preset( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$preset = $this->presets->get_preset_data( (string) $request->get_param( 'code' ) );
		if ( null === $preset ) {
			return $this->error( 'preset_not_found', __( 'Preset not found.', 'codeclove-school-management' ), 404 );
		}

		return $this->success( $preset );
	}

	/**
	 * Applies a preset.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function apply_preset( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$code = (string) $request->get_param( 'code' );
		$mode = (string) $request->get_param( 'mode' );

		$result = $this->presets->apply_preset( $code, $mode, $this->repository );

		if ( ! $result['success'] ) {
			return $this->error( 'apply_failed', $result['data']['message'] ?? 'Preset apply failed.', 400 );
		}

		if ( 'preview' !== $mode ) {
			AuditLogger::log(
				'settings.preset_applied',
				[
					'preset' => strtoupper( sanitize_key( $code ) ),
					'mode'   => $mode,
				]
			);
		}

		return $this->success( $result['data'] );
	}

	/**
	 * Returns a privacy-safe diagnostic snapshot.
	 *
	 * @param WP_REST_Request $request
	 */
	public function get_diagnostics( WP_REST_Request $request ): WP_REST_Response {
		global $wp_version;
		$settings = $this->repository->get_settings();

		return $this->success(
			[
				'generated_at'       => gmdate( 'c' ),
				'plugin_version'     => CODECLOVE_VERSION,
				'schema_version'     => CODECLOVE_DB_VERSION,
				'wordpress_version'  => $wp_version,
				'php_version'        => PHP_VERSION,
				'site_url'           => site_url(),
				'rest_url'           => rest_url( 'codeclove/v1/' ),
				'debug_logging'      => (bool) ( $settings['system']['debug_logging'] ?? false ),
				'active_preset'      => $settings['education_system']['preset'] ?? null,
				'active_preset_name' => $settings['education_system']['preset_name'] ?? null,
			]
		);
	}

	/**
	 * Clears options cache.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function clear_cache( WP_REST_Request $request ): WP_REST_Response {
		wp_cache_delete( 'codeclove_settings', 'options' );
		AuditLogger::log( 'settings.cache_cleared' );
		return $this->success( [ 'message' => 'Cache cleared successfully.' ] );
	}

	/**
	 * Returns dynamic real-time API and system health telemetry.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_health( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$settings      = $this->repository->get_settings();
		$notifications = $settings['notifications'] ?? [];
		$db_connected  = ! empty( $wpdb->dbh ) && (bool) $wpdb->check_connection( false );

		return $this->success( [
			'status'             => 'ok',
			'db_connected'       => $db_connected,
			'php_version'        => PHP_VERSION,
			'php_memory_limit'   => ini_get( 'memory_limit' ) ?: 'Unknown',
			'max_upload_size'    => size_format( wp_max_upload_size() ),
			'mail_driver'        => strtoupper( (string) ( $notifications['mail_driver'] ?? 'wp_mail' ) ),
			'active_preset'      => $settings['education_system']['preset'] ?? 'IN',
			'active_preset_name' => $settings['education_system']['preset_name'] ?? 'India',
			'server_time'        => current_time( 'mysql', true ),
		] );
	}

	/**
	 * Returns changed top-level setting sections without logging sensitive values.
	 *
	 * @param array $before Previous settings.
	 * @param array $after  Updated settings.
	 * @return string[]
	 */
	private function changed_sections( array $before, array $after ): array {
		$changed = [];
		foreach ( $after as $section => $value ) {
			if ( in_array( $section, [ 'schema_version', 'plugin_version' ], true ) ) {
				continue;
			}
			if ( ! array_key_exists( $section, $before ) || $before[ $section ] !== $value ) {
				$changed[] = (string) $section;
			}
		}

		return $changed;
	}

	/**
	 * Allows any logged-in user to retrieve general settings.
	 *
	 * @param WP_REST_Request $request
	 * @return bool
	 */
	public function check_read_auth( WP_REST_Request $request ): bool {
		if ( ! is_user_logged_in() ) {
			return false;
		}
		// Security: CSRF Nonce Verification for Cookie-Authenticated Requests (Defense-in-depth).
		if ( ! $this->verify_nonce( $request ) ) {
			return false;
		}

		return true;
	}
}
