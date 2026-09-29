<?php
/**
 * Database transaction wrapper.
 *
 * Provides transactional boundary with automatic commit and rollback,
 * supporting nested transactions via MySQL SAVEPOINTs.
 *
 * @package CodeClove\Database
 */

declare( strict_types=1 );

namespace CodeClove\Database;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Core\Logger;
use Throwable;
use WP_Error;

/**
 * Class Transaction
 */
final class Transaction {

	/**
	 * Current transaction nesting depth.
	 *
	 * @var int
	 */
	private static int $depth = 0;

	/**
	 * Begins a transaction or creates a savepoint if already in a transaction.
	 */
	public static function begin(): void {
		global $wpdb;
		self::$depth++;

		if ( self::$depth === 1 ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Core transaction control.
			$wpdb->query( 'START TRANSACTION' );
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Transaction savepoint.
			$wpdb->query( $wpdb->prepare( 'SAVEPOINT %i', 'codeclove_tx_' . (int) self::$depth ) );
		}
	}

	/**
	 * Commits the transaction or releases the savepoint.
	 */
	public static function commit(): void {
		global $wpdb;

		if ( self::$depth <= 0 ) {
			self::$depth = 0;
			return;
		}

		if ( self::$depth === 1 ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Core transaction control.
			$wpdb->query( 'COMMIT' );
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Transaction savepoint release.
			$wpdb->query( $wpdb->prepare( 'RELEASE SAVEPOINT %i', 'codeclove_tx_' . (int) self::$depth ) );
		}

		self::$depth--;
	}

	/**
	 * Rolls back the transaction or rolls back to the savepoint.
	 */
	public static function rollback(): void {
		global $wpdb;

		if ( self::$depth <= 0 ) {
			self::$depth = 0;
			return;
		}

		if ( self::$depth === 1 ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Core transaction control.
			$wpdb->query( 'ROLLBACK' );
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Transaction rollback to savepoint.
			$wpdb->query( $wpdb->prepare( 'ROLLBACK TO SAVEPOINT %i', 'codeclove_tx_' . (int) self::$depth ) );
		}

		self::$depth--;
	}

	/**
	 * Resets the transaction depth and rolls back any open transactions.
	 */
	public static function reset(): void {
		while ( self::$depth > 0 ) {
			self::rollback();
		}
		self::$depth = 0;
	}

	/**
	 * Returns current transaction nesting depth.
	 */
	public static function get_depth(): int {
		return self::$depth;
	}

	/**
	 * Executes a callback inside a database transaction.
	 *
	 * Automatically rolls back on WP_Error or Throwable, commits otherwise.
	 *
	 * @param callable $callback Accepts $wpdb as parameter.
	 * @return mixed
	 */
	public static function run( callable $callback ): mixed {
		global $wpdb;

		self::begin();

		try {
			$result = $callback( $wpdb );

			if ( is_wp_error( $result ) ) {
				self::rollback();
				return $result;
			}

			self::commit();
			return $result;
		} catch ( Throwable $e ) {
			self::rollback();

			Logger::error( 'Transaction failed: ' . $e->getMessage(), $e );
			return new WP_Error( 'db_transaction_failed', $e->getMessage(), [ 'status' => 500 ] );
		}
	}
}
