<?php
/**
 * Units service.
 *
 * Implements business logic and validation rules for academic units (class levels) and unit-subject mappings.
 *
 * @package CodeClove\Modules\Academics\Units
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Academics\Units;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Database\Schema;
use WP_Error;

/**
 * Class UnitsService
 */
final class UnitsService {

	/**
	 * Gets and maps academic units.
	 *
	 * @param array $args Filter and pagination args.
	 * @return array{units: array, total: int}
	 */
	public function get_units( array $args = [] ): array {
		$units = $this->db_get_units( $args );
		$total = $this->db_count_units( $args );

		$mapped = array_map( [ $this, 'map_unit' ], $units );

		return [
			'units' => $mapped,
			'total' => $total,
		];
	}

	/**
	 * Gets a single mapped unit.
	 *
	 * @param int $id Unit ID.
	 * @return array|null
	 */
	public function get_unit( int $id ): ?array {
		$unit = $this->db_get_unit( $id );
		return $unit ? $this->map_unit( $unit ) : null;
	}

	/**
	 * Creates an academic unit.
	 *
	 * @param array $payload Payload.
	 * @return array|WP_Error
	 */
	public function create_unit( array $payload ): array|WP_Error {
		$validated = $this->validate_unit_payload( $payload );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$id = $this->db_create_unit( $validated );
		if ( null === $id ) {
			return new WP_Error( 'codeclove_create_failed', __( 'Failed to create academic unit.', 'codeclove-school-management' ), 500 );
		}

		return $this->get_unit( $id );
	}

	/**
	 * Updates an academic unit.
	 *
	 * @param int   $id      Unit ID.
	 * @param array $payload Payload.
	 * @return array|WP_Error
	 */
	public function update_unit( int $id, array $payload ): array|WP_Error {
		$current = $this->db_get_unit( $id );
		if ( null === $current ) {
			return new WP_Error( 'codeclove_not_found', __( 'Academic unit not found.', 'codeclove-school-management' ), 404 );
		}

		$validated = $this->validate_unit_payload( $payload, $id );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$updated = $this->db_update_unit( $id, $validated );
		if ( ! $updated ) {
			return new WP_Error( 'codeclove_update_failed', __( 'Failed to update academic unit.', 'codeclove-school-management' ), 500 );
		}

		return $this->get_unit( $id );
	}

	/**
	 * Deletes an academic unit.
	 *
	 * @param int $id Unit ID.
	 * @return bool|WP_Error
	 */
	public function delete_unit( int $id ): bool|WP_Error {
		$unit = $this->db_get_unit( $id );
		if ( null === $unit ) {
			return new WP_Error( 'codeclove_not_found', __( 'Academic unit not found.', 'codeclove-school-management' ), 404 );
		}

		if ( $this->db_has_associated_groups( $id ) ) {
			return new WP_Error( 'codeclove_has_groups', __( 'Cannot delete unit: it has active sections or homerooms.', 'codeclove-school-management' ), 400 );
		}

		if ( $this->db_unit_has_enrolled_students( $id ) ) {
			return new WP_Error( 'codeclove_has_students', __( 'Cannot delete unit: it has enrolled students.', 'codeclove-school-management' ), 400 );
		}

		return $this->db_delete_unit( $id );
	}



	/**
	 * Validates unit payload.
	 *
	 * @param array    $payload Payload.
	 * @param int|null $id      Existing ID.
	 * @return array|WP_Error
	 */
	private function validate_unit_payload( array $payload, ?int $id = null ): array|WP_Error {
		$db_data = [];

		if ( isset( $payload['session_id'] ) ) {
			$session_id = (int) $payload['session_id'];
			$sessions_service = new \CodeClove\Modules\Academics\Sessions\SessionsService();
			$session    = $sessions_service->get_session( $session_id );
			if ( null === $session ) {
				return new WP_Error( 'codeclove_invalid_session', __( 'Academic session not found.', 'codeclove-school-management' ), 400 );
			}
			$db_data['academic_session_id'] = $session_id;
		} elseif ( null === $id ) {
			return new WP_Error( 'codeclove_missing_field', __( 'Session ID is required.', 'codeclove-school-management' ), 400 );
		}

		if ( isset( $payload['name'] ) ) {
			$name = sanitize_text_field( trim( (string) $payload['name'] ) );
			if ( strlen( $name ) < 2 ) {
				return new WP_Error( 'codeclove_invalid_name', __( 'Name must be at least 2 characters.', 'codeclove-school-management' ), 400 );
			}
			$db_data['name'] = $name;
		} elseif ( null === $id ) {
			return new WP_Error( 'codeclove_missing_field', __( 'Name is required.', 'codeclove-school-management' ), 400 );
		}

		if ( isset( $payload['code'] ) ) {
			$db_data['code'] = sanitize_text_field( $payload['code'] );
		}

		if ( isset( $payload['order'] ) ) {
			$db_data['level_order'] = (int) $payload['order'];
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
	 * Maps DB unit row to REST structure.
	 *
	 * @param array $row DB row.
	 * @return array
	 */
	public function map_unit( array $row ): array {
		return [
			'id'             => (int) $row['id'],
			'session_id'     => (int) $row['academic_session_id'],
			'name'           => (string) $row['name'],
			'code'           => $row['code'] ? (string) $row['code'] : null,
			'order'          => (int) $row['level_order'],
			'status'         => (string) $row['status'],
			'groups_count'   => (int) ( $row['groups_count'] ?? 0 ),
			'students_count' => (int) ( $row['students_count'] ?? 0 ),
			'created_at'     => (string) $row['created_at'],
		];
	}

	/**
	 * Gets subjects assigned to a unit.
	 *
	 * @param int $unit_id Unit ID.
	 * @return array
	 */
	public function get_unit_subjects( int $unit_id ): array {
		$subjects = $this->db_get_unit_subjects( $unit_id );
		return array_map( [ $this, 'map_unit_subject' ], $subjects );
	}

	/**
	 * Assigns a subject to a unit.
	 *
	 * @param int   $unit_id Unit ID.
	 * @param array $payload Payload data (subject_id, is_required, sort_order).
	 * @return array|WP_Error Mapped unit subject or error.
	 */
	public function assign_subject_to_unit( int $unit_id, array $payload ): array|WP_Error {
		if ( ! isset( $payload['subject_id'] ) ) {
			return new WP_Error( 'codeclove_missing_field', __( 'Subject ID (subject_id) is required.', 'codeclove-school-management' ), 400 );
		}
		$subject_id = (int) $payload['subject_id'];
		$is_required = ! empty( $payload['is_required'] );
		$sort_order = isset( $payload['sort_order'] ) ? (int) $payload['sort_order'] : 0;

		// Validate unit exists
		$unit = $this->db_get_unit( $unit_id );
		if ( ! $unit ) {
			return new WP_Error( 'codeclove_not_found', __( 'Academic unit not found.', 'codeclove-school-management' ), 404 );
		}

		// Validate subject exists
		$subjects_service = new \CodeClove\Modules\Academics\Subjects\SubjectsService();
		$subject = $subjects_service->get_subject( $subject_id );
		if ( ! $subject ) {
			return new WP_Error( 'codeclove_not_found', __( 'Subject not found.', 'codeclove-school-management' ), 404 );
		}

		// Attempt insertion and catch duplicate database constraint error
		$inserted_id = $this->db_assign_subject_to_unit( $unit_id, $subject_id, $is_required, $sort_order );
		if ( ! $inserted_id ) {
			global $wpdb;
			if ( str_contains( (string) $wpdb->last_error, 'Duplicate entry' ) || str_contains( (string) $wpdb->last_error, 'uq_unit_subject' ) ) {
				return new WP_Error( 'codeclove_duplicate', __( 'Subject is already assigned to this academic unit.', 'codeclove-school-management' ), 400 );
			}
			return new WP_Error( 'codeclove_create_failed', __( 'Failed to assign subject to unit.', 'codeclove-school-management' ), 500 );
		}

		// Find the newly mapped subject
		$assigned = $this->db_get_unit_subjects( $unit_id );
		foreach ( $assigned as $as ) {
			if ( (int) $as['id'] === $inserted_id ) {
				return $this->map_unit_subject( $as );
			}
		}

		return new WP_Error( 'codeclove_create_failed', __( 'Failed to retrieve assigned subject mapping.', 'codeclove-school-management' ), 500 );
	}

	/**
	 * Unassigns a subject from a unit.
	 *
	 * @param int $unit_id    Unit ID.
	 * @param int $subject_id Subject ID.
	 * @return bool|WP_Error True if success, or error.
	 */
	public function unassign_subject_from_unit( int $unit_id, int $subject_id ): bool|WP_Error {
		$unit = $this->db_get_unit( $unit_id );
		if ( ! $unit ) {
			return new WP_Error( 'codeclove_not_found', __( 'Academic unit not found.', 'codeclove-school-management' ), 404 );
		}

		return $this->db_unassign_subject_from_unit( $unit_id, $subject_id );
	}

	/**
	 * Maps DB unit subject row to REST structure.
	 *
	 * @param array $row DB/Joined row.
	 * @return array
	 */
	public function map_unit_subject( array $row ): array {
		return [
			'id'           => (int) $row['id'],
			'unit_id'      => (int) $row['academic_unit_id'],
			'subject_id'   => (int) $row['subject_id'],
			'subject_name' => (string) $row['subject_name'],
			'subject_code' => $row['subject_code'] ? (string) $row['subject_code'] : null,
			'subject_type' => (string) ( $row['subject_type'] ?? 'core' ),
			'is_required'  => 1 === (int) $row['is_required'],
			'sort_order'   => (int) $row['sort_order'],
			'created_at'   => (string) $row['created_at'],
		];
	}

	// ─── Database Operations ─────────────────────────────────────────────────

	/**
	 * Gets academic units matching arguments.
	 */
	private function db_get_units( array $args = [] ): array {
		global $wpdb;

		$defaults = [
			'limit'      => 25,
			'offset'     => 0,
			'search'     => '',
			'status'     => '',
			'session_id' => 0,
			'orderby'    => '',
			'order'      => '',
		];
		$params = array_merge( $defaults, $args );

		$query = 'SELECT u.*, 
			(SELECT COUNT(*) FROM %i WHERE academic_unit_id = u.id) as groups_count,
			(SELECT COUNT(*) FROM %i WHERE academic_unit_id = u.id AND status != %s) as students_count
			FROM %i u WHERE 1=1';
		$binds = [ Schema::groups(), Schema::enrollments(), 'withdrawn', Schema::units() ];

		if ( $params['session_id'] > 0 ) {
			$query   .= ' AND u.academic_session_id = %d';
			$binds[] = $params['session_id'];
		}

		if ( '' !== $params['status'] ) {
			$query   .= ' AND u.status = %s';
			$binds[] = $params['status'];
		}

		if ( '' !== $params['search'] ) {
			$query   .= ' AND (u.name LIKE %s OR u.code LIKE %s)';
			$like    = '%' . $wpdb->esc_like( $params['search'] ) . '%';
			$binds[] = $like;
			$binds[] = $like;
		}

		$orderby = ! empty( $params['orderby'] ) ? sanitize_text_field( $params['orderby'] ) : 'level_order';
		$order   = ! empty( $params['order'] ) && in_array( strtolower( $params['order'] ), [ 'asc', 'desc' ], true ) ? strtoupper( $params['order'] ) : 'ASC';

		$orderby_whitelist = [
			'name'           => 'u.name',
			'code'           => 'u.code',
			'order'          => 'u.level_order',
			'status'         => 'u.status',
			'groups_count'   => 'groups_count',
			'students_count' => 'students_count',
		];

		$orderby_sql = isset( $orderby_whitelist[ $orderby ] ) ? $orderby_whitelist[ $orderby ] : 'u.level_order';

		$query   .= " ORDER BY {$orderby_sql} {$order}, u.id ASC";
		$query   .= ' LIMIT %d OFFSET %d';
		$binds[] = $params['limit'];
		$binds[] = $params['offset'];
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Custom academic units list query with dynamic clauses.
		$results = $wpdb->get_results( $wpdb->prepare( $query, ...$binds ), ARRAY_A );
		return is_array( $results ) ? $results : [];
	}

	/**
	 * Counts academic units matching arguments.
	 */
	private function db_count_units( array $args = [] ): int {
		global $wpdb;

		$query = 'SELECT COUNT(*) FROM %i WHERE 1=1';
		$binds = [ Schema::units() ];

		if ( ! empty( $args['session_id'] ) ) {
			$query   .= ' AND academic_session_id = %d';
			$binds[] = $args['session_id'];
		}

		if ( ! empty( $args['status'] ) ) {
			$query   .= ' AND status = %s';
			$binds[] = $args['status'];
		}

		if ( ! empty( $args['search'] ) ) {
			$query   .= ' AND (name LIKE %s OR code LIKE %s)';
			$like    = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$binds[] = $like;
			$binds[] = $like;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Custom academic units count query with dynamic clauses.
		return (int) $wpdb->get_var( $wpdb->prepare( $query, ...$binds ) );
	}

	/**
	 * Gets a single academic unit by ID.
	 */
	private function db_get_unit( int $id ): ?array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Single academic unit query.
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT u.*, 
					(SELECT COUNT(*) FROM %i WHERE academic_unit_id = u.id) as groups_count,
					(SELECT COUNT(*) FROM %i WHERE academic_unit_id = u.id AND status != %s) as students_count
				 FROM %i u WHERE u.id = %d',
				Schema::groups(),
				Schema::enrollments(),
				'withdrawn',
				Schema::units(),
				$id
			),
			ARRAY_A
		);
		return is_array( $row ) ? $row : null;
	}

	/**
	 * Creates an academic unit.
	 */
	private function db_create_unit( array $data ): ?int {
		global $wpdb;

		$data['created_at'] = gmdate( 'Y-m-d H:i:s' );
		$data['updated_at'] = gmdate( 'Y-m-d H:i:s' );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->insert( Schema::units(), $data );
		// phpcs:enable

		return $result ? (int) $wpdb->insert_id : null;
	}

	/**
	 * Updates an academic unit.
	 */
	private function db_update_unit( int $id, array $data ): bool {
		global $wpdb;

		$data['updated_at'] = gmdate( 'Y-m-d H:i:s' );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->update(
			Schema::units(),
			$data,
			[ 'id' => $id ]
		);
		// phpcs:enable

		return false !== $result;
	}

	/**
	 * Deletes an academic unit.
	 */
	private function db_delete_unit( int $id ): bool {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->delete(
			Schema::units(),
			[ 'id' => $id ]
		);
		// phpcs:enable

		return false !== $result;
	}

	/**
	 * Checks if a unit has active groups.
	 */
	private function db_has_associated_groups( int $id ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Associated groups check query.
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE academic_unit_id = %d',
				Schema::groups(),
				$id
			)
		) > 0;
	}

	/**
	 * Checks if a unit has enrolled students.
	 */
	private function db_unit_has_enrolled_students( int $id ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Unit enrolled students check query.
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE academic_unit_id = %d',
				Schema::enrollments(),
				$id
			)
		) > 0;
	}

	/**
	 * Gets subjects mapped to a unit.
	 */
	private function db_get_unit_subjects( int $unit_id ): array {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Unit subjects mapped query.
		$results = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT us.*, s.name as subject_name, s.code as subject_code, s.type as subject_type
				 FROM %i us
				 JOIN %i s ON us.subject_id = s.id
				 WHERE us.academic_unit_id = %d
				 ORDER BY us.sort_order ASC',
				Schema::unit_subjects(),
				Schema::subjects(),
				$unit_id
			),
			ARRAY_A
		);
		return is_array( $results ) ? $results : [];
	}

	/**
	 * Assigns a subject to a unit.
	 */
	private function db_assign_subject_to_unit( int $unit_id, int $subject_id, bool $is_required, int $sort_order ): ?int {
		global $wpdb;
		$data = [
			'academic_unit_id' => $unit_id,
			'subject_id'       => $subject_id,
			'is_required'      => $is_required ? 1 : 0,
			'sort_order'       => $sort_order,
			'created_at'       => gmdate( 'Y-m-d H:i:s' ),
		];
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->insert( Schema::unit_subjects(), $data );
		// phpcs:enable
		return $result ? (int) $wpdb->insert_id : null;
	}

	/**
	 * Unassigns a subject from a unit.
	 */
	private function db_unassign_subject_from_unit( int $unit_id, int $subject_id ): bool {
		global $wpdb;
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->delete(
			Schema::unit_subjects(),
			[
				'academic_unit_id' => $unit_id,
				'subject_id'       => $subject_id,
			]
		);
		// phpcs:enable
		return false !== $result;
	}
}
