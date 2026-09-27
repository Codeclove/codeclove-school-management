<?php
/**
 * Nexora RBAC permission checker.
 *
 * Provides a global helper function and a static class for checking whether
 * a WordPress user has a given Nexora permission key.
 *
 * Permission keys follow the {area}.{action} dot-notation convention
 * defined in docs/PERMISSIONS.md, e.g.:
 *   - students.view
 *   - admissions.convert
 *   - roles_permissions.manage
 *
 * WordPress administrators always have access (admin recovery mechanism).
 *
 * @package Nexora\Core
 */

declare( strict_types=1 );

namespace Nexora\Core;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Nexora\Database\Schema;

/**
 * Class Permissions
 */
final class Permissions {
	/**
	 * Core permission keys.
	 */
	public const DASHBOARD_VIEW       = 'dashboard.view';
	public const TIMETABLE_SUBSTITUTE = 'timetable.substitute';


	/**
	 * Per-request permission cache.
	 * Avoids repeated DB queries for the same user + permission within a request.
	 *
	 * @var array<int, array<string, bool>>
	 */
	private static array $cache = [];

	// ─── Public API ──────────────────────────────────────────────────────────

	/**
	 * Checks whether a user has a given Nexora permission.
	 *
	 * The cache stores per-key results. A '*' sentinel key is stored in the
	 * cache when the user is an Owner (wildcard) so that all subsequent checks
	 * for that user are O(1) — zero DB queries after the first call.
	 *
	 * @param int    $user_id        WordPress user ID.
	 * @param string $permission_key Dot-notation permission key.
	 */
	public static function check( int $user_id, string $permission_key ): bool {
		// Wildcard sentinel: Owner has full access, no further DB calls needed.
		if ( isset( self::$cache[ $user_id ]['*'] ) ) {
			return true;
		}

		if ( isset( self::$cache[ $user_id ][ $permission_key ] ) ) {
			return self::$cache[ $user_id ][ $permission_key ];
		}

		// query() populates the wildcard sentinel in the cache if applicable.
		$result = self::query( $user_id, $permission_key );

		// If the wildcard sentinel was just set by query(), we're done.
		if ( isset( self::$cache[ $user_id ]['*'] ) ) {
			return true;
		}

		self::$cache[ $user_id ][ $permission_key ] = $result;

		return $result;
	}

	/**
	 * Flushes the permission cache for a specific user or all users.
	 * Call this after saving role/permission changes.
	 *
	 * @param int|null $user_id User ID, or null to flush all.
	 */
	public static function flush_cache( ?int $user_id = null ): void {
		if ( null === $user_id ) {
			self::$cache = [];
		} else {
			unset( self::$cache[ $user_id ] );
		}
	}

	/**
	 * Returns all permission keys assigned to a user (via their roles).
	 * Used to pass the permission set to the React frontend.
	 *
	 * If the user has a wildcard '*' permission (Owner role), returns
	 * ['*' => true] as a sentinel. The frontend should treat '*' as
	 * "all permissions granted" and skip individual key checks.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array<string, bool>
	 */
	public static function get_user_permissions( int $user_id ): array {
		global $wpdb;

		// ponytail: fetch all allowed permissions in a single query instead of checking wildcard first.
// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT rp.permission_key, rp.allowed
				 FROM ' . Schema::role_permissions() . ' rp
				 INNER JOIN ' . Schema::user_roles() . ' ur ON ur.role_id = rp.role_id
				 WHERE ur.user_id = %d AND rp.allowed = 1',
				$user_id
			),
			ARRAY_A
		);
		// phpcs:enable

		$permissions = [];
		foreach ( (array) $rows as $row ) {
			if ( '*' === $row['permission_key'] ) {
				return [ '*' => true ];
			}
			$permissions[ $row['permission_key'] ] = (bool) $row['allowed'];
		}

		return $permissions;
	}

	// ─── Private Helpers ─────────────────────────────────────────────────────

	/**
	 * Queries the DB to check if a user has the given permission via any role.
	 *
	 * Wildcard '*' is checked first. If found, the '*' sentinel is stored in
	 * the cache so check() can detect the wildcard hit without a second query.
	 *
	 * @param int    $user_id        WordPress user ID.
	 * @param string $permission_key Dot-notation permission key.
	 */
	private static function query( int $user_id, string $permission_key ): bool {
		global $wpdb;

		// ponytail: query both wildcard '*' and specific key in a single query using IN
// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$allowed_keys = $wpdb->get_col(
			$wpdb->prepare(
				'SELECT rp.permission_key
				 FROM ' . Schema::role_permissions() . ' rp
				 INNER JOIN ' . Schema::user_roles() . ' ur ON ur.role_id = rp.role_id
				 WHERE ur.user_id = %d
				   AND rp.permission_key IN (%s, %s)
				   AND rp.allowed = 1',
				$user_id,
				'*',
				$permission_key
			)
		);
		// phpcs:enable

		if ( in_array( '*', $allowed_keys, true ) ) {
			self::$cache[ $user_id ]['*'] = true;
			return true;
		}

		return in_array( $permission_key, $allowed_keys, true );
	}
}
