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
	private SystemReportService $report_service;

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->repository     = new SettingsRepository();
		$this->presets        = new PresetsService();
		$this->validator      = new SettingsValidator();
		$this->report_service = new SystemReportService( $this->repository );
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

		register_rest_route(
			$this->namespace,
			'/system/diagnostics',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_system_diagnostics' ],
					'permission_callback' => [ $this, 'check_read_auth' ],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/system/feedback',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'submit_feedback' ],
					'permission_callback' => [ $this, 'check_read_auth' ],
					'args'                => [
						'title'               => [
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						],
						'description'         => [
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_textarea_field',
						],
						'type'                => [
							'required'          => false,
							'type'              => 'string',
							'enum'              => [ 'bug', 'feedback' ],
							'default'           => 'bug',
							'sanitize_callback' => 'sanitize_text_field',
						],
						'priority'            => [
							'required'          => false,
							'type'              => 'string',
							'enum'              => [ 'p0', 'p1', 'p2', 'p3' ],
							'default'           => 'p2',
							'sanitize_callback' => 'sanitize_text_field',
						],
						'area'                => [
							'required'          => false,
							'type'              => 'string',
							'default'           => 'General',
							'sanitize_callback' => 'sanitize_text_field',
						],
						'expected'            => [
							'required'          => false,
							'type'              => 'string',
							'default'           => '',
							'sanitize_callback' => 'sanitize_textarea_field',
						],
						'include_diagnostics' => [
							'required' => false,
							'type'     => 'boolean',
							'default'  => true,
						],
						'client_info'         => [
							'required' => false,
							'type'     => 'object',
							'default'  => [],
						],
					],
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/system/tickets',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_tickets' ],
					'permission_callback' => [ $this, 'check_read_auth' ],
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
	 * Returns sanitized system diagnostics.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_system_diagnostics( WP_REST_Request $request ): WP_REST_Response {
		$report   = $this->report_service->get_sanitized_report();
		$markdown = $this->report_service->format_markdown_report( $report );

		return $this->success( [
			'report'   => $report,
			'markdown' => $markdown,
		] );
	}

	/**
	 * Handles bug/feedback submissions and constructs GitHub issue deep link.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function submit_feedback( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$title               = trim( (string) $request->get_param( 'title' ) );
		$description         = trim( (string) $request->get_param( 'description' ) );
		$type                = (string) ( $request->get_param( 'type' ) ?: 'bug' );
		$priority            = (string) ( $request->get_param( 'priority' ) ?: 'p2' );
		$area                = (string) ( $request->get_param( 'area' ) ?: 'General' );
		$expected            = trim( (string) ( $request->get_param( 'expected' ) ?? '' ) );
		$include_diagnostics = (bool) $request->get_param( 'include_diagnostics' );
		$client_info         = (array) ( $request->get_param( 'client_info' ) ?: [] );

		if ( empty( $title ) || empty( $description ) ) {
			return $this->error( 'validation_failed', __( 'Title and description are required.', 'codeclove-school-management' ), 422 );
		}

		// Anti-spam guard 1: Limit to 5 submissions per 10-minute window per IP.
		if ( ! $this->check_rate_limit( 'feedback_submit', 5, 600 ) ) {
			return $this->error(
				'rate_limit_exceeded',
				__( 'Too many reports submitted. Please wait a few minutes before submitting again.', 'codeclove-school-management' ),
				429
			);
		}

		// Anti-spam guard 2: Prevent duplicate submission of identical content within 3 minutes.
		$dup_key = 'codeclove_fb_dup_' . md5( strtolower( $title . '|' . $description ) );
		if ( false !== get_transient( $dup_key ) ) {
			return $this->error(
				'duplicate_submission',
				__( 'This report has already been submitted recently. Please wait a few minutes before resubmitting.', 'codeclove-school-management' ),
				409
			);
		}

		$report         = $this->report_service->get_sanitized_report();
		$preset         = $report['codeclove']['preset'] ?? 'custom';
		$edition        = $report['codeclove']['edition'] ?? 'free';
		$diagnostics_md = $include_diagnostics ? $this->report_service->format_markdown_report( $report ) : '';

		// Allow third-party integrations (Linear, Slack, webhooks) to handle the submission.
		$feedback_data = [
			'title'               => $title,
			'description'         => $description,
			'type'                => $type,
			'priority'            => $priority,
			'area'                => $area,
			'expected'            => $expected,
			'client_info'         => $client_info,
			'include_diagnostics' => $include_diagnostics,
			'diagnostics'         => $report,
			'user_id'             => get_current_user_id(),
		];
		do_action( 'codeclove_feedback_submitted', $feedback_data );

		// Target feedback receiver endpoint.
		$receiver_url = $this->get_feedback_receiver_url();

		// Labels mapping for GitHub issues created by receiver.
		$labels   = [];
		$labels[] = 'bug' === $type ? 'type:bug' : 'type:enhancement';
		if ( 'bug' === $type ) {
			$labels[] = match ( $priority ) {
				'p0'    => 'p0-blocker',
				'p1'    => 'p1-critical',
				'p3'    => 'p3-minor',
				default => 'p2-major',
			};
		}
		$clean_area = sanitize_title( $area );
		if ( ! empty( $clean_area ) ) {
			$labels[] = 'area:' . $clean_area;
		}
		if ( 'pro' === $edition ) {
			$labels[] = 'edition:pro';
		}

		// Build Full Markdown report.
		$full_lines   = [];
		$full_lines[] = '### Description';
		$full_lines[] = $description;
		$full_lines[] = '';

		if ( 'bug' === $type && ! empty( $expected ) ) {
			$full_lines[] = '### Expected Behavior';
			$full_lines[] = $expected;
			$full_lines[] = '';
		}

		if ( ! empty( $client_info ) ) {
			$context_lines = [];
			if ( ! empty( $client_info['route'] ) ) {
				$context_lines[] = '- **Route:** `' . sanitize_text_field( (string) $client_info['route'] ) . '`';
			}
			if ( ! empty( $client_info['browser'] ) && 'Unknown' !== $client_info['browser'] ) {
				$browser = sanitize_text_field( (string) $client_info['browser'] );
				if ( preg_match( '/(Chrome|Firefox|Safari|Edge|Opera)\/([0-9.]+)/i', $browser, $m ) ) {
					$browser = $m[1] . ' ' . explode( '.', $m[2] )[0];
				}
				$context_lines[] = '- **Browser:** ' . $browser;
			}
			if ( ! empty( $client_info['error_stack'] ) ) {
				$context_lines[] = '';
				$context_lines[] = '```';
				$context_lines[] = $this->report_service->redact_paths( sanitize_textarea_field( (string) $client_info['error_stack'] ) );
				$context_lines[] = '```';
			}
			if ( ! empty( $context_lines ) ) {
				$full_lines[] = '### Client Context';
				$full_lines   = array_merge( $full_lines, $context_lines );
				$full_lines[] = '';
			}
		}

		if ( $include_diagnostics && ! empty( $diagnostics_md ) ) {
			$full_lines[] = $diagnostics_md;
		}

		$full_markdown = implode( "\n", $full_lines );

		$title_prefix = 'bug' === $type
			? match ( $priority ) {
				'p0'    => '[URGENT] ',
				'p1'    => '[HIGH] ',
				'p3'    => '[MINOR] ',
				default => '[BUG] ',
			}
			: '[FEEDBACK] ';

		$remote_title = mb_substr( $title_prefix . $title, 0, 120 );

		// Dispatch directly to the CodeClove feedback receiver.
		$response = wp_remote_post(
			$receiver_url,
			[
				'headers'   => [
					'Content-Type' => 'application/json',
					'Accept'       => 'application/json',
					'User-Agent'   => 'CodeClove/' . ( defined( 'CODECLOVE_VERSION' ) ? CODECLOVE_VERSION : '1.0.0' ),
				],
				'body'      => wp_json_encode( [
					'title'          => $remote_title,
					'description'    => $description,
					'type'           => $type,
					'priority'       => $priority,
					'area'           => $area,
					'edition'        => $edition,
					'site_url'       => get_site_url(),
					'plugin_version' => defined( 'CODECLOVE_VERSION' ) ? CODECLOVE_VERSION : '1.0.0',
					'wp_version'     => get_bloginfo( 'version' ),
					'php_version'    => PHP_VERSION,
					'full_markdown'  => $full_markdown,
					'labels'         => array_values( array_unique( $labels ) ),
				] ),
				'timeout'   => 15,
				'sslverify' => $this->should_verify_ssl( $receiver_url ),
			]
		);

		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response(
				[
					'success'       => false,
					'code'          => 'codeclove_feedback_submission_failed',
					'message'       => sprintf(
						/* translators: %s: Error message */
						__( 'Could not connect to feedback receiver: %s', 'codeclove-school-management' ),
						$response->get_error_message()
					),
					'full_markdown' => $full_markdown,
				],
				502
			);
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$body   = json_decode( (string) wp_remote_retrieve_body( $response ), true );

		if ( $status >= 200 && $status < 300 && ! empty( $body['ticket_id'] ) ) {
			$ticket_id = (int) $body['ticket_id'];

			// Save to local site ticket history (cap at last 20 entries).
			$history = (array) get_option( 'codeclove_ticket_history', [] );
			array_unshift(
				$history,
				[
					'ticket_id'    => $ticket_id,
					'title'        => $title,
					'type'         => $type,
					'priority'     => $priority,
					'area'         => $area,
					'submitted_at' => time(),
					'state'        => 'open',
				]
			);
			update_option( 'codeclove_ticket_history', array_slice( $history, 0, 20 ), false );
			set_transient( $dup_key, 1, 180 );
			return $this->success( [
				'ticket_id'     => $ticket_id,
				'full_markdown' => $full_markdown,
				'message'       => sprintf(
					/* translators: %d: GitHub Issue Ticket ID */
					__( 'Issue #%d submitted successfully to the engineering team.', 'codeclove-school-management' ),
					$ticket_id
				),
			] );
		}

		$error_msg = ! empty( $body['message'] ) && ! str_contains( (string) $body['message'], 'No route was found' )
			? sanitize_text_field( (string) $body['message'] )
			: __( 'Unable to reach the CodeClove feedback service. Please try again later.', 'codeclove-school-management' );
		$err_code  = ( $status >= 400 && $status < 600 ) ? $status : 502;

		return new WP_REST_Response(
			[
				'success'       => false,
				'code'          => 'codeclove_remote_submission_failed',
				'message'       => $error_msg,
				'full_markdown' => $full_markdown,
			],
			$err_code
		);
	}

	/**
	 * Returns the locally stored support tickets and checks their live resolution status.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_tickets( WP_REST_Request $request ): WP_REST_Response {
		$history = (array) get_option( 'codeclove_ticket_history', [] );
		if ( empty( $history ) ) {
			return $this->success( [ 'tickets' => [] ] );
		}

		$status_endpoint = (string) preg_replace( '#/feedback/?$#', '/feedback/status', $this->get_feedback_receiver_url() );

		foreach ( $history as &$item ) {
			$ticket_id = (int) ( $item['ticket_id'] ?? 0 );
			if ( ! $ticket_id || 'closed' === ( $item['state'] ?? 'open' ) ) {
				continue;
			}

			$status_res = wp_remote_get(
				add_query_arg( 'ticket_id', $ticket_id, $status_endpoint ),
				[
					'timeout'   => 5,
					'sslverify' => $this->should_verify_ssl( $status_endpoint ),
				]
			);

			if ( ! is_wp_error( $status_res ) && 200 === wp_remote_retrieve_response_code( $status_res ) ) {
				$status_body = json_decode( (string) wp_remote_retrieve_body( $status_res ), true );
				if ( ! empty( $status_body['data']['state'] ) ) {
					$item['state']        = $status_body['data']['state'];
					$item['state_reason'] = $status_body['data']['state_reason'] ?? null;
					$updated_any          = true;
				}
			}
		}
		unset( $item );

		if ( $updated_any ) {
			update_option( 'codeclove_ticket_history', $history, false );
		}

		return $this->success( [ 'tickets' => $history ] );
	}

	/**
	 * Returns the feedback receiver endpoint URL.
	 *
	 * @return string
	 */
	private function get_feedback_receiver_url(): string {
		$default = ( defined( 'CODECLOVE_FEEDBACK_API_URL' ) && CODECLOVE_FEEDBACK_API_URL )
			? CODECLOVE_FEEDBACK_API_URL
			: 'https://codeclove.com/wp-json/nexora/v1/feedback';
		return (string) apply_filters( 'codeclove_feedback_api_url', $default );
	}
	/**
	 * Determines if SSL verification should be enforced for remote receiver calls.
	 *
	 * @param string $url Target endpoint URL.
	 * @return bool
	 */
	private function should_verify_ssl( string $url ): bool {
		if ( 'development' === wp_get_environment_type() ) {
			return false;
		}
		$host = (string) wp_parse_url( $url, PHP_URL_HOST );
		return ! in_array( $host, [ 'localhost', '127.0.0.1' ], true );
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
		if ( ! apply_filters( 'codeclove_settings_auth', true, $request ) ) {
			return false;
		}
		// Security: CSRF Nonce Verification for Cookie-Authenticated Requests (Defense-in-depth).
		if ( ! $this->verify_nonce( $request ) ) {
			return false;
		}

		return true;
	}
}
