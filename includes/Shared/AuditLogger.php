<?php
/**
 * Audit logger.
 *
 * Provides a simple, structured audit trail for important actions across
 * all Nexora modules. Uses the admission_logs table as a general-purpose
 * audit log in Phase 1; dedicated per-module log tables are used for
 * module-specific events from Phase 5 onwards.
 *
 * @package Nexora\Shared
 */

declare( strict_types=1 );

namespace Nexora\Shared;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class AuditLogger
 *
 * Lightweight audit logger. Does NOT throw exceptions — audit failures
 * must never break the main application flow.
 */
final class AuditLogger {

	/**
	 * Logs an event to the application audit trail.
	 *
	 * @param string $event_type Machine-readable event type, e.g. 'student.created'.
	 * @param array  $metadata   Additional structured data for the event.
	 */
	public static function log( string $event_type, array $metadata = [] ): void {
		$actor_id   = is_user_logged_in() ? get_current_user_id() : null;
		$actor_type = null !== $actor_id ? 'admin' : 'system';

		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->insert(
			\Nexora\Database\Schema::app_logs(),
			[
				'event_type'     => $event_type,
				'actor_type'     => $actor_type,
				'actor_id'       => $actor_id,
				'actor_label'    => $actor_id ? wp_get_current_user()->display_name : 'system',
				'ip_address'     => self::get_ip(),
				'user_agent'     => isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : null,
				'metadata_json'  => ! empty( $metadata ) ? wp_json_encode( $metadata ) : null,
				'created_at'     => gmdate( 'Y-m-d H:i:s' ),
			],
			[ '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s' ]
		);
	}

	// ─── Private Helpers ─────────────────────────────────────────────────────

	/**
	 * Returns the best available client IP address.
	 */
	private static function get_ip(): string {
		// ponytail: REMOTE_ADDR with standard proxy header fallback.
		$raw_ip = sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '' ) );
		$ip     = trim( explode( ',', $raw_ip )[0] );
		return filter_var( $ip, FILTER_VALIDATE_IP ) ? $ip : '0.0.0.0';
	}
}
