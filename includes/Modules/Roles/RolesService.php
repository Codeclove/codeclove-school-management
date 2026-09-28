<?php
/**
 * Roles service.
 *
 * Handles database CRUD operations for roles and permissions.
 *
 * @package CodeClove\Modules\Roles
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Roles;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Database\Schema;
use CodeClove\Shared\AuditLogger;
use WP_Error;

/**
 * Class RolesService
 */
final class RolesService {

	/**
	 * Lists all roles and allowed permission counts.
	 *
	 * @return array
	 */
	public function get_roles(): array {
		global $wpdb;
		$roles_table = Schema::roles();
		$permissions_table = Schema::role_permissions();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$results = $wpdb->get_results(
			"SELECT r.*, COUNT(rp.id) as permission_count
			 FROM {$roles_table} r
			 LEFT JOIN {$permissions_table} rp ON rp.role_id = r.id AND rp.allowed = 1
			 GROUP BY r.id
			 ORDER BY r.is_system DESC, r.name ASC",
			ARRAY_A
		);
		// phpcs:enable

		$roles = [];
		foreach ( (array) $results as $row ) {
			$roles[] = [
				'id'               => (int) $row['id'],
				'slug'             => $row['slug'],
				'name'             => $row['name'],
				'description'      => $row['description'],
				'is_system'        => (int) $row['is_system'] === 1,
				'is_locked'        => (int) $row['is_locked'] === 1,
				'permission_count' => (int) $row['permission_count'],
			];
		}

		return $roles;
	}

	/**
	 * Gets a single role by ID.
	 *
	 * @param int $id Role ID.
	 * @return array|null
	 */
	public function get_role( int $id ): ?array {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM " . Schema::roles() . " WHERE id = %d", $id ),
			ARRAY_A
		);
		// phpcs:enable

		if ( ! $row ) {
			return null;
		}

		// Fetch permissions
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$perm_rows = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT permission_key FROM " . Schema::role_permissions() . " WHERE role_id = %d AND allowed = 1",
				$id
			)
		);
		// phpcs:enable

		return [
			'id'          => (int) $row['id'],
			'slug'        => $row['slug'],
			'name'        => $row['name'],
			'description' => $row['description'],
			'is_system'   => (int) $row['is_system'] === 1,
			'is_locked'   => (int) $row['is_locked'] === 1,
			'permissions' => (array) $perm_rows,
		];
	}

	/**
	 * Creates a new role.
	 *
	 * @param array $data Role data.
	 * @return array|WP_Error
	 */
	public function create_role( array $data ): array|WP_Error {
		global $wpdb;

		$name        = sanitize_text_field( $data['name'] ?? '' );
		$description = sanitize_textarea_field( $data['description'] ?? '' );
		$permissions = (array) ( $data['permissions'] ?? [] );

		if ( empty( $name ) ) {
			return new WP_Error( 'codeclove_validation_failed', __( 'Role name is required.', 'codeclove-school-management' ), [ 'status' => 400 ] );
		}

		$slug = sanitize_title( $name );

		// Check duplicate slug
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$exists = $wpdb->get_var(
			$wpdb->prepare( "SELECT id FROM " . Schema::roles() . " WHERE slug = %s", $slug )
		);
		// phpcs:enable

		if ( $exists ) {
			return new WP_Error( 'codeclove_validation_failed', __( 'A role with a similar name already exists.', 'codeclove-school-management' ), [ 'status' => 400 ] );
		}

		$now = gmdate( 'Y-m-d H:i:s' );
		$role_data = [
			'slug'        => $slug,
			'name'        => $name,
			'description' => $description,
			'is_system'   => 0,
			'is_locked'   => 0,
			'created_by'  => get_current_user_id(),
			'created_at'  => $now,
			'updated_at'  => $now,
		];

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->insert( Schema::roles(), $role_data );
		$role_id = $wpdb->insert_id;

		// Map permissions
		$permissions_table = Schema::role_permissions();
		foreach ( $permissions as $key ) {
			$key = sanitize_text_field( $key );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				$permissions_table,
				[
					'role_id'        => $role_id,
					'permission_key' => $key,
					'allowed'        => 1,
					'created_at'     => $now,
					'updated_at'     => $now,
				]
			);
		}

		AuditLogger::log( 'roles.created', [ 'role_id' => $role_id, 'name' => $name ] );

		return [
			'id'          => $role_id,
			'slug'        => $slug,
			'name'        => $name,
			'description' => $description,
			'is_system'   => false,
			'is_locked'   => false,
			'permissions' => $permissions,
		];
	}

	/**
	 * Updates an existing role.
	 *
	 * @param int   $id   Role ID.
	 * @param array $data Role fields.
	 * @return array|WP_Error
	 */
	public function update_role( int $id, array $data ): array|WP_Error {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM " . Schema::roles() . " WHERE id = %d", $id ),
			ARRAY_A
		);
		// phpcs:enable

		if ( ! $row ) {
			return new WP_Error( 'codeclove_not_found', __( 'Role not found.', 'codeclove-school-management' ), [ 'status' => 404 ] );
		}

		$is_locked = (int) $row['is_locked'] === 1;
		$slug      = $row['slug'];

		$update_data = [
			'updated_at' => gmdate( 'Y-m-d H:i:s' ),
			'updated_by' => get_current_user_id(),
		];

		if ( ! $is_locked && isset( $data['name'] ) ) {
			$name = sanitize_text_field( $data['name'] );
			if ( ! empty( $name ) ) {
				$update_data['name'] = $name;
			}
		}

		if ( isset( $data['description'] ) ) {
			$update_data['description'] = sanitize_textarea_field( $data['description'] );
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->update( Schema::roles(), $update_data, [ 'id' => $id ] );

		// Mapped permissions (Owner role permissions are locked and cannot be updated)
		if ( isset( $data['permissions'] ) && 'owner' !== $slug ) {
			$permissions = (array) $data['permissions'];
			$permissions_table = Schema::role_permissions();
			$now = gmdate( 'Y-m-d H:i:s' );

			// Delete old
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->delete( $permissions_table, [ 'role_id' => $id ] );

			// Insert new
			foreach ( $permissions as $key ) {
				$key = sanitize_text_field( $key );
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->insert(
					$permissions_table,
					[
						'role_id'        => $id,
						'permission_key' => $key,
						'allowed'        => 1,
						'created_at'     => $now,
						'updated_at'     => $now,
					]
				);
			}

			// Flush permission checking cache for all users
			\CodeClove\Core\Permissions::flush_cache();
		}

		AuditLogger::log( 'roles.updated', [ 'role_id' => $id, 'name' => $row['name'] ] );

		return $this->get_role( $id ) ?? [];
	}

	/**
	 * Deletes a role.
	 *
	 * @param int $id Role ID.
	 * @return bool|WP_Error
	 */
	public function delete_role( int $id ): bool|WP_Error {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM " . Schema::roles() . " WHERE id = %d", $id ),
			ARRAY_A
		);
		// phpcs:enable

		if ( ! $row ) {
			return new WP_Error( 'codeclove_not_found', __( 'Role not found.', 'codeclove-school-management' ), [ 'status' => 404 ] );
		}

		if ( (int) $row['is_system'] === 1 || (int) $row['is_locked'] === 1 ) {
			return new WP_Error( 'codeclove_action_blocked', __( 'System or locked roles cannot be deleted.', 'codeclove-school-management' ), [ 'status' => 403 ] );
		}

		// Check if any users are assigned to this role
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$assigned_count = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM " . Schema::user_roles() . " WHERE role_id = %d", $id )
		);
		// phpcs:enable

		if ( $assigned_count > 0 ) {
			return new WP_Error(
				'codeclove_action_blocked',
				'Cannot delete role because it is currently assigned to ' . $assigned_count . ' user(s).',
				[ 'status' => 400 ]
			);
		}

		// Delete permissions
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->delete( Schema::role_permissions(), [ 'role_id' => $id ] );

		// Delete role
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->delete( Schema::roles(), [ 'id' => $id ] );

		AuditLogger::log( 'roles.deleted', [ 'role_id' => $id, 'name' => $row['name'] ] );

		return true;
	}
}
