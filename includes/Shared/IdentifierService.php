<?php
/**
 * Shared service for auto-generating unique entity identifiers.
 *
 * @package Nexora\Shared
 */

declare( strict_types=1 );

namespace Nexora\Shared;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Nexora\Database\Transaction;
use Nexora\Modules\Settings\SettingsRepository;
use WP_Error;
/**
 * Class IdentifierService
 */
final class IdentifierService {

	/**
	 * Generates a unique sequential identifier for a given type.
	 *
	 * Uses database transaction row-level locking on the nexora_settings option row
	 * to prevent race conditions when concurrent requests attempt to generate numbers.
	 *
	 * @param string $type Identifier type matching a key in identifiers settings (e.g. 'student_number').
	 * @return string|WP_Error The generated unique identifier, or WP_Error on failure.
	 */
	public static function generate( string $type ): string|WP_Error {
		return Transaction::run( function( $wpdb ) use ( $type ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery
			// Execute row-level lock on the nexora_settings option.
			$wpdb->get_var(
				$wpdb->prepare(
					"SELECT option_value FROM {$wpdb->options} WHERE option_name = %s FOR UPDATE",
					'nexora_settings'
				)
			);
			// phpcs:enable

			$repository = new SettingsRepository();
			$settings   = $repository->get_settings();
			$config     = $settings['identifiers'][ $type ] ?? null;

			if ( ! $config ) {
				return '';
			}

			$prefix    = $config['prefix'] ?? '';
			$yearStr   = $config['year_token'] ?? '';
			$padding   = (int) ( $config['sequence_padding'] ?? 4 );
			$next      = (int) ( $config['next_number'] ?? 1 );
			$separator = $config['separator'] ?? '';

			// Parse dynamic year placeholder if present.
			if ( '' !== $yearStr ) {
				$yearStr = str_replace( [ '{YYYY}', '{YY}' ], [ gmdate( 'Y' ), gmdate( 'y' ) ], $yearStr );
			}

			// Pad the sequence counter.
			$sequence = str_pad( (string) $next, $padding, '0', STR_PAD_LEFT );

			// Build identifier parts.
			$parts      = array_filter( [ $prefix, $yearStr, $sequence ], 'strlen' );
			$identifier = implode( $separator, $parts );

			// Update option next_number for this type.
			$settings['identifiers'][ $type ]['next_number'] = $next + 1;
			$repository->update_settings( $settings );

			return $identifier;
		} );
	}
}
