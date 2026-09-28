<?php
/**
 * Development Error Logger utility.
 *
 * Provides ultra-lightweight, zero-dependency logging for CodeClove.
 * Bridges native error_log() with WP_DEBUG and CodeClove system.debug_logging settings.
 *
 * @package CodeClove\Core
 */

declare( strict_types=1 );

namespace CodeClove\Core;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Modules\Settings\SettingsRepository;

/**
 * Class Logger
 */
final class Logger {

	/**
	 * Cached debug logging setting state for the request.
	 */
	private static ?bool $debug_enabled = null;

	/**
	 * Logs an error level message.
	 *
	 * @param string $message Main error log message.
	 * @param mixed  $context Optional diagnostic context (array, string, Exception, etc.).
	 */
	public static function error( string $message, mixed $context = null ): void {
		self::log( 'ERROR', $message, $context );
	}

	/**
	 * Logs an info level message.
	 *
	 * @param string $message Main info log message.
	 * @param mixed  $context Optional diagnostic context.
	 */
	public static function info( string $message, mixed $context = null ): void {
		self::log( 'INFO', $message, $context );
	}


	/**
	 * Formats and outputs log messages to PHP's error log stream.
	 *
	 * @param string $level   Log level ('ERROR').
	 * @param string $message Log message.
	 * @param mixed  $context Context data.
	 */
	private static function log( string $level, string $message, mixed $context = null ): void {
		if ( ! self::is_logging_enabled() ) {
			return;
		}

		$output = sprintf( '[CodeClove] [%s] %s', $level, $message );

		if ( null !== $context ) {
			if ( $context instanceof \Throwable ) {
				$output .= sprintf( ' | Exception: %s in %s:%d', $context->getMessage(), $context->getFile(), $context->getLine() );
			} elseif ( is_scalar( $context ) ) {
				$output .= ' | Context: ' . $context;
			} else {
				$output .= ' | Context: ' . wp_json_encode( self::redact_sensitive_data( $context ) );
			}
		}
		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		error_log( $output );
	}

	/**
	 * Determines whether error logging should be active.
	 * Returns true if WP_DEBUG is active OR system.debug_logging option is enabled.
	 */
	private static function is_logging_enabled(): bool {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			return true;
		}

		if ( null === self::$debug_enabled ) {
			try {
				$repo                 = new SettingsRepository();
				$settings             = $repo->get_settings();
				self::$debug_enabled = (bool) ( $settings['system']['debug_logging'] ?? false );
			} catch ( \Throwable $e ) {
				self::$debug_enabled = false;
				if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
					// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
					error_log( '[CodeClove] [ERROR] Failed to read debug logging setting: ' . $e->getMessage() );
				}
			}
		}

		return self::$debug_enabled;
	}

	/**
	 * Recursively redacts sensitive keys from context arrays/objects.
	 *
	 * @param mixed $data Context data to redact.
	 * @return mixed Redacted data.
	 */
	public static function redact_sensitive_data( mixed $data ): mixed {
		if ( is_array( $data ) ) {
			$redacted = [];
			$sensitive_patterns = [
				'password', 'passwd', 'pass', 'user_pass', 'new_password',
				'current_password', 'token', 'auth_token', 'authkey',
				'api_key', 'secret', 'api_secret', 'smtp_password', 'private_key',
			];
			foreach ( $data as $key => $value ) {
				$key_lower = strtolower( (string) $key );
				$is_sensitive = false;
				foreach ( $sensitive_patterns as $pattern ) {
					if ( str_contains( $key_lower, $pattern ) ) {
						$is_sensitive = true;
						break;
					}
				}
				if ( $is_sensitive ) {
					$redacted[ $key ] = '[REDACTED]';
				} else {
					$redacted[ $key ] = self::redact_sensitive_data( $value );
				}
			}
			return $redacted;
		}
		return $data;
	}
}
