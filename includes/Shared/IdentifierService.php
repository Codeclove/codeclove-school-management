<?php
/**
 * Shared service for auto-generating unique entity identifiers.
 *
 * @package CodeClove\Shared
 */

declare( strict_types=1 );

namespace CodeClove\Shared;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Database\Schema;
use CodeClove\Database\Transaction;
use CodeClove\Modules\Settings\SettingsRepository;
use WP_Error;

/**
 * Class IdentifierService
 */
final class IdentifierService {

	/**
	 * Generates a unique sequential identifier for a given type.
	 *
	 * Uses database transaction row-level locking on the codeclove_settings option row
	 * to prevent race conditions when concurrent requests attempt to generate numbers.
	 * Supports class and section scoping for classroom roll numbers.
	 *
	 * @param string $type    Identifier type matching a key in identifiers settings (e.g. 'student_number', 'roll_number').
	 * @param array  $context Optional scoping context (academic_session_id, academic_unit_id, academic_group_id, scope, scoped).
	 * @return string|WP_Error The generated unique identifier, or WP_Error on failure.
	 */
	public static function generate( string $type, array $context = [] ): string|WP_Error {
		return Transaction::run( function( $wpdb ) use ( $type, $context ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery
			// Execute row-level lock on the settings option.
			$wpdb->get_var(
				$wpdb->prepare(
					"SELECT option_value FROM {$wpdb->options} WHERE option_name = %s FOR UPDATE",
					'codeclove_settings'
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
			$separator = $config['separator'] ?? '';

			// Check if scoped roll number generation is requested or configured.
			$scope_mode = $context['scope'] ?? ( $config['scope'] ?? 'global' );
			$is_scoped  = ( 'roll_number' === $type ) && (
				! empty( $context['scoped'] ) ||
				in_array( $scope_mode, [ 'class', 'section', 'unit', 'group' ], true )
			);

			if ( $is_scoped ) {
				$session_id        = (int) ( $context['academic_session_id'] ?? $context['session_id'] ?? 0 );
				$unit_id           = (int) ( $context['academic_unit_id'] ?? $context['unit_id'] ?? 0 );
				$group_id          = isset( $context['academic_group_id'] ) ? (int) $context['academic_group_id'] : ( isset( $context['group_id'] ) ? (int) $context['group_id'] : null );
				$enrollments_table = Schema::enrollments();

				$where        = [ "status != 'deleted'" ];
				$query_params = [];
				if ( $session_id ) {
					$where[]        = 'academic_session_id = %d';
					$query_params[] = $session_id;
				}
				if ( $unit_id ) {
					$where[]        = 'academic_unit_id = %d';
					$query_params[] = $unit_id;
				}
				if ( in_array( $scope_mode, [ 'section', 'group' ], true ) && ! empty( $group_id ) ) {
					$where[]        = 'academic_group_id = %d';
					$query_params[] = $group_id;
				}

				$where_sql = implode( ' AND ', $where );
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
				$rolls     = (array) $wpdb->get_col( $wpdb->prepare( "SELECT roll_number FROM %i WHERE {$where_sql}", $enrollments_table, ...$query_params ) );
				$max_num    = count( $rolls );
				foreach ( $rolls as $rn ) {
					if ( ! empty( $rn ) && preg_match( '/(\d+)$/', (string) $rn, $matches ) ) {
						$num = (int) $matches[1];
						if ( $num > $max_num ) {
							$max_num = $num;
						}
					}
				}
				$next = $max_num + 1;
			} else {
				$next = (int) ( $config['next_number'] ?? 1 );

				// Evaluate yearly reset rule if configured.
				if ( ( $config['reset_rule'] ?? 'none' ) === 'yearly' ) {
					$current_year = (int) gmdate( 'Y' );
					$last_year    = (int) ( $config['last_reset_year'] ?? 0 );
					if ( $last_year > 0 && $last_year < $current_year ) {
						$next = 1;
						$settings['identifiers'][ $type ]['last_reset_year'] = $current_year;
					} elseif ( ! isset( $config['last_reset_year'] ) ) {
						$settings['identifiers'][ $type ]['last_reset_year'] = $current_year;
					}
				}

				// Update option next_number for this type.
				$settings['identifiers'][ $type ]['next_number'] = $next + 1;
				$repository->update_settings( $settings );
			}

			// Parse dynamic year placeholder if present.
			if ( '' !== $yearStr ) {
				$yearStr = str_replace( [ '{YYYY}', '{YY}' ], [ gmdate( 'Y' ), gmdate( 'y' ) ], $yearStr );
			}

			// Pad the sequence counter.
			$sequence = str_pad( (string) $next, $padding, '0', STR_PAD_LEFT );

			// Build identifier parts.
			$parts      = array_filter( [ $prefix, $yearStr, $sequence ], 'strlen' );
			$identifier = implode( $separator, $parts );

			return $identifier;
		} );
	}
}
