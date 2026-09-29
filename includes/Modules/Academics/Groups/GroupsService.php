<?php
/**
 * Groups service.
 *
 * Implements business logic and validation rules for academic groups (classroom sections).
 *
 * @package CodeClove\Modules\Academics\Groups
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Academics\Groups;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Database\Schema;
use WP_Error;

/**
 * Class GroupsService
 */
final class GroupsService {

	/**
	 * Gets and maps academic groups.
	 *
	 * @param array $args Filter and pagination args.
	 * @return array{groups: array, total: int}
	 */
	public function get_groups( array $args = [] ): array {
		$groups = $this->db_get_groups( $args );
		$total  = $this->db_count_groups( $args );

		$mapped = array_map( [ $this, 'map_group' ], $groups );

		return [
			'groups' => $mapped,
			'total'  => $total,
		];
	}

	/**
	 * Gets a single mapped group.
	 *
	 * @param int $id Group ID.
	 * @return array|null
	 */
	public function get_group( int $id ): ?array {
		$group = $this->db_get_group( $id );
		return $group ? $this->map_group( $group ) : null;
	}

	/**
	 * Creates an academic group.
	 *
	 * @param array $payload Payload.
	 * @return array|WP_Error
	 */
	public function create_group( array $payload ): array|WP_Error {
		$validated = $this->validate_group_payload( $payload );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$id = $this->db_create_group( $validated );
		if ( null === $id ) {
			return new WP_Error( 'codeclove_create_failed', __( 'Failed to create academic group.', 'codeclove-school-management' ), 500 );
		}

		return $this->get_group( $id );
	}

	/**
	 * Updates an academic group.
	 *
	 * @param int   $id      Group ID.
	 * @param array $payload Payload.
	 * @return array|WP_Error
	 */
	public function update_group( int $id, array $payload ): array|WP_Error {
		$current = $this->db_get_group( $id );
		if ( null === $current ) {
			return new WP_Error( 'codeclove_not_found', __( 'Academic group not found.', 'codeclove-school-management' ), 404 );
		}

		$validated = $this->validate_group_payload( $payload, true );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		if ( empty( $validated ) ) {
			return $this->get_group( $id );
		}

		$updated = $this->db_update_group( $id, $validated );
		if ( ! $updated ) {
			return new WP_Error( 'codeclove_update_failed', __( 'Failed to update academic group.', 'codeclove-school-management' ), 500 );
		}

		return $this->get_group( $id );
	}

	/**
	 * Deletes an academic group.
	 *
	 * @param int $id Group ID.
	 * @return bool|WP_Error
	 */
	public function delete_group( int $id ): bool|WP_Error {
		$group = $this->db_get_group( $id );
		if ( null === $group ) {
			return new WP_Error( 'codeclove_not_found', __( 'Academic group not found.', 'codeclove-school-management' ), 404 );
		}

		if ( $this->db_group_has_enrolled_students( $id ) ) {
			return new WP_Error( 'codeclove_has_students', __( 'Cannot delete group: it has enrolled students.', 'codeclove-school-management' ), 400 );
		}

		return $this->db_delete_group( $id );
	}



	/**
	 * Validates group payload.
	 *
	 * @param array $payload   Payload.
	 * @param bool  $is_update True if this is an update request.
	 * @return array|WP_Error
	 */
	private function validate_group_payload( array $payload, bool $is_update = false ): array|WP_Error {
		$db_data = [];

		if ( isset( $payload['unit_id'] ) ) {
			$unit_id = (int) $payload['unit_id'];
			$units_service = new \CodeClove\Modules\Academics\Units\UnitsService();
			$unit    = $units_service->get_unit( $unit_id );
			if ( null === $unit ) {
				return new WP_Error( 'codeclove_invalid_unit', __( 'Academic unit not found.', 'codeclove-school-management' ), 400 );
			}
			$db_data['academic_unit_id'] = $unit_id;
		} elseif ( ! $is_update ) {
			return new WP_Error( 'codeclove_missing_field', __( 'Academic unit ID (unit_id) is required.', 'codeclove-school-management' ), 400 );
		}

		if ( isset( $payload['name'] ) ) {
			$name = sanitize_text_field( trim( (string) $payload['name'] ) );
			if ( strlen( $name ) < 2 ) {
				return new WP_Error( 'codeclove_invalid_name', __( 'Name must be at least 2 characters.', 'codeclove-school-management' ), 400 );
			}
			$db_data['name'] = $name;
		} elseif ( ! $is_update ) {
			return new WP_Error( 'codeclove_missing_field', __( 'Name is required.', 'codeclove-school-management' ), 400 );
		}

		if ( isset( $payload['code'] ) ) {
			$db_data['code'] = sanitize_text_field( $payload['code'] );
		}

		if ( isset( $payload['capacity'] ) ) {
			$db_data['capacity'] = (int) $payload['capacity'] ?: null;
		}

		if ( isset( $payload['status'] ) ) {
			$status = sanitize_text_field( $payload['status'] );
			if ( ! in_array( $status, [ 'active', 'inactive', 'archived' ], true ) ) {
				return new WP_Error( 'codeclove_invalid_status', __( 'Status must be active, inactive, or archived.', 'codeclove-school-management' ), 400 );
			}
			$db_data['status'] = $status;
		}

		return $db_data;
	}

	/**
	 * Maps DB group row to REST structure.
	 *
	 * @param array $row DB row.
	 * @return array
	 */
	public function map_group( array $row ): array {
		return [
			'id'             => (int) $row['id'],
			'unit_id'        => (int) $row['academic_unit_id'],
			'session_id'     => (int) $row['session_id'],
			'name'           => (string) $row['name'],
			'code'           => $row['code'] ? (string) $row['code'] : null,
			'capacity'       => isset( $row['capacity'] ) ? (int) $row['capacity'] : null,
			'status'         => (string) ( $row['status'] ?? 'active' ),
			'order'          => 0, // Placeholder/not directly supported in DB but kept for frontend interface
			'students_count' => (int) ( $row['students_count'] ?? 0 ),
			'created_at'     => (string) $row['created_at'],
		];
	}

	// ─── Database Operations ─────────────────────────────────────────────────

	/**
	 * Gets academic groups matching arguments.
	 */
	private function db_get_groups( array $args = [] ): array {
		global $wpdb;

		$defaults = [
			'limit'      => 25,
			'offset'     => 0,
			'search'     => '',
			'status'     => '',
			'session_id' => 0,
			'unit_id'    => 0,
			'orderby'    => '',
			'order'      => '',
		];
		$params = array_merge( $defaults, $args );

		$query = 'SELECT g.*, u.academic_session_id as session_id,
			(SELECT COUNT(*) FROM %i WHERE academic_group_id = g.id AND status != %s) as students_count
			FROM %i g
			INNER JOIN %i u ON g.academic_unit_id = u.id
			WHERE 1=1';
		$binds = [ Schema::enrollments(), 'withdrawn', Schema::groups(), Schema::units() ];

		if ( $params['session_id'] > 0 ) {
			$query   .= ' AND u.academic_session_id = %d';
			$binds[] = $params['session_id'];
		}

		if ( $params['unit_id'] > 0 ) {
			$query   .= ' AND g.academic_unit_id = %d';
			$binds[] = $params['unit_id'];
		}

		if ( '' !== $params['status'] ) {
			$query   .= ' AND g.status = %s';
			$binds[] = $params['status'];
		}

		if ( '' !== $params['search'] ) {
			$query   .= ' AND (g.name LIKE %s OR g.code LIKE %s)';
			$like    = '%' . $wpdb->esc_like( $params['search'] ) . '%';
			$binds[] = $like;
			$binds[] = $like;
		}

		$orderby = ! empty( $params['orderby'] ) ? sanitize_text_field( $params['orderby'] ) : 'id';
		$order   = ! empty( $params['order'] ) && in_array( strtolower( $params['order'] ), [ 'asc', 'desc' ], true ) ? strtoupper( $params['order'] ) : 'ASC';

		$orderby_whitelist = [
			'name'           => 'g.name',
			'code'           => 'g.code',
			'status'         => 'g.status',
			'students_count' => 'students_count',
		];

		$orderby_sql = isset( $orderby_whitelist[ $orderby ] ) ? $orderby_whitelist[ $orderby ] : 'g.id';

		$query   .= " ORDER BY {$orderby_sql} {$order}, g.id ASC";
		$query   .= ' LIMIT %d OFFSET %d';
		$binds[] = $params['limit'];
		$binds[] = $params['offset'];

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared -- Custom academic groups list query with dynamic clauses.
		$results = $wpdb->get_results( $wpdb->prepare( $query, ...$binds ), ARRAY_A );

		return is_array( $results ) ? $results : [];
	}

	/**
	 * Counts academic groups matching arguments.
	 */
	private function db_count_groups( array $args = [] ): int {
		global $wpdb;

		$query = 'SELECT COUNT(*) FROM %i g
			INNER JOIN %i u ON g.academic_unit_id = u.id
			WHERE 1=1';
		$binds = [ Schema::groups(), Schema::units() ];

		if ( ! empty( $args['session_id'] ) ) {
			$query   .= ' AND u.academic_session_id = %d';
			$binds[] = $args['session_id'];
		}

		if ( ! empty( $args['unit_id'] ) ) {
			$query   .= ' AND g.academic_unit_id = %d';
			$binds[] = $args['unit_id'];
		}

		if ( ! empty( $args['status'] ) ) {
			$query   .= ' AND g.status = %s';
			$binds[] = $args['status'];
		}

		if ( ! empty( $args['search'] ) ) {
			$query   .= ' AND (g.name LIKE %s OR g.code LIKE %s)';
			$like    = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$binds[] = $like;
			$binds[] = $like;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared -- Custom academic groups count query with dynamic clauses.
		return (int) $wpdb->get_var( $wpdb->prepare( $query, ...$binds ) );
	}

	/**
	 * Gets a single academic group by ID.
	 */
	private function db_get_group( int $id ): ?array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Single academic group query.
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT g.*, u.academic_session_id as session_id,
					(SELECT COUNT(*) FROM %i WHERE academic_group_id = g.id AND status != %s) as students_count
				 FROM %i g
				 INNER JOIN %i u ON g.academic_unit_id = u.id
				 WHERE g.id = %d',
				Schema::enrollments(),
				'withdrawn',
				Schema::groups(),
				Schema::units(),
				$id
			),
			ARRAY_A
		);
		return is_array( $row ) ? $row : null;
	}

	/**
	 * Creates an academic group.
	 */
	private function db_create_group( array $data ): ?int {
		global $wpdb;

		$data['created_at'] = gmdate( 'Y-m-d H:i:s' );
		$data['updated_at'] = gmdate( 'Y-m-d H:i:s' );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$result = $wpdb->insert( Schema::groups(), $data );
		// phpcs:enable

		return $result ? (int) $wpdb->insert_id : null;
	}

	/**
	 * Updates an academic group.
	 */
	private function db_update_group( int $id, array $data ): bool {
		global $wpdb;

		$data['updated_at'] = gmdate( 'Y-m-d H:i:s' );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$result = $wpdb->update(
			Schema::groups(),
			$data,
			[ 'id' => $id ]
		);
		// phpcs:enable

		return false !== $result;
	}

	/**
	 * Deletes an academic group.
	 */
	private function db_delete_group( int $id ): bool {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$result = $wpdb->delete(
			Schema::groups(),
			[ 'id' => $id ]
		);
		// phpcs:enable

		return false !== $result;
	}

	/**
	 * Checks if a group has enrolled students.
	 */
	private function db_group_has_enrolled_students( int $id ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Enrolled students check query.
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE academic_group_id = %d',
				Schema::enrollments(),
				$id
			)
		) > 0;
	}
}
