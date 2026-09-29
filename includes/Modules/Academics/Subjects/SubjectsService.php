<?php
/**
 * Subjects service.
 *
 * Implements business logic and validation rules for academic subjects.
 *
 * @package CodeClove\Modules\Academics\Subjects
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Academics\Subjects;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Database\Schema;
use CodeClove\Database\Transaction;
use WP_Error;

/**
 * Class SubjectsService
 */
final class SubjectsService {

	public function get_subjects( array $args = [] ): array {
		$subjects = $this->db_get_subjects( $args );
		$total    = $this->db_count_subjects( $args );

		$session_id = isset( $args['session_id'] ) ? (int) $args['session_id'] : 0;
		$mapped     = [];
		foreach ( $subjects as $subject ) {
			$mapped[] = $this->map_subject( $subject, $session_id );
		}

		return [
			'subjects' => $mapped,
			'total'    => $total,
		];
	}

	/**
	 * Gets a single mapped subject by ID.
	 *
	 * @param int $id Subject ID.
	 * @return array|null
	 */
	public function get_subject( int $id ): ?array {
		$subject = $this->db_get_subject( $id );
		return $subject ? $this->map_subject( $subject ) : null;
	}

	/**
	 * Creates a subject.
	 *
	 * @param array $payload Payload.
	 * @return array|WP_Error
	 */
	public function create_subject( array $payload ): array|WP_Error {
		$validated = $this->validate_subject_payload( $payload );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		return Transaction::run( function() use ( $payload, $validated ) {
			$id = $this->db_create_subject( $validated );
			if ( null === $id ) {
				return new WP_Error( 'codeclove_create_failed', __( 'Failed to create subject.', 'codeclove-school-management' ), 500 );
			}

			// Handle unit mappings if provided.
			if ( isset( $payload['unit_ids'] ) && is_array( $payload['unit_ids'] ) ) {
				$units_service = new \CodeClove\Modules\Academics\Units\UnitsService();
				foreach ( $payload['unit_ids'] as $unit_id ) {
					$units_service->assign_subject_to_unit( (int) $unit_id, [
						'subject_id'  => $id,
						'is_required' => true,
						'sort_order'  => 0,
					] );
				}
			}

			return $this->get_subject( $id );
		} );
	}

	/**
	 * Updates a subject.
	 *
	 * @param int   $id      Subject ID.
	 * @param array $payload Payload.
	 * @return array|WP_Error
	 */
	public function update_subject( int $id, array $payload ): array|WP_Error {
		$current = $this->db_get_subject( $id );
		if ( null === $current ) {
			return new WP_Error( 'codeclove_not_found', __( 'Subject not found.', 'codeclove-school-management' ), 404 );
		}

		$validated = $this->validate_subject_payload( $payload, true );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		return Transaction::run( function( $wpdb ) use ( $id, $payload, $validated ) {
			$updated = $this->db_update_subject( $id, $validated );
			if ( ! $updated ) {
				return new WP_Error( 'codeclove_update_failed', __( 'Failed to update subject.', 'codeclove-school-management' ), 500 );
			}

			// Handle unit mapping sync if provided.
			if ( isset( $payload['unit_ids'] ) && is_array( $payload['unit_ids'] ) ) {
				$units_service = new \CodeClove\Modules\Academics\Units\UnitsService();
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Unit subjects sync query.
				$current_units = $wpdb->get_col(
					$wpdb->prepare(
						'SELECT academic_unit_id FROM %i WHERE subject_id = %d',
						\CodeClove\Database\Schema::unit_subjects(),
						$id
					)
				);
				$current_units = array_map( 'intval', is_array( $current_units ) ? $current_units : [] );
				$new_units     = array_map( 'intval', $payload['unit_ids'] );

				$to_add    = array_diff( $new_units, $current_units );
				$to_remove = array_diff( $current_units, $new_units );

				foreach ( $to_add as $uid ) {
					$units_service->assign_subject_to_unit( $uid, [
						'subject_id'  => $id,
						'is_required' => true,
						'sort_order'  => 0,
					] );
				}
				foreach ( $to_remove as $uid ) {
					$units_service->unassign_subject_from_unit( $uid, $id );
				}
			}

			return $this->get_subject( $id );
		} );
	}

	/**
	 * Deletes a subject.
	 *
	 * @param int $id Subject ID.
	 * @return bool|WP_Error
	 */
	public function delete_subject( int $id ): bool|WP_Error {
		$subject = $this->db_get_subject( $id );
		if ( null === $subject ) {
			return new WP_Error( 'codeclove_not_found', __( 'Subject not found.', 'codeclove-school-management' ), 404 );
		}

		if ( $this->db_is_subject_mapped_to_units( $id ) ) {
			return new WP_Error( 'codeclove_mapped_to_units', __( 'Cannot delete subject: it is mapped to academic units.', 'codeclove-school-management' ), 400 );
		}

		return $this->db_delete_subject( $id );
	}



	/**
	 * Validates subject payload.
	 *
	 * @param array $payload   Payload.
	 * @param bool  $is_update True if this is an update request.
	 * @return array|WP_Error
	 */
	private function validate_subject_payload( array $payload, bool $is_update = false ): array|WP_Error {
		$db_data = [];

		if ( isset( $payload['name'] ) ) {
			$name = sanitize_text_field( trim( (string) $payload['name'] ) );
			if ( strlen( $name ) < 2 ) {
				return new WP_Error( 'codeclove_invalid_name', __( 'Name must be at least 2 characters.', 'codeclove-school-management' ), 400 );
			}
			$db_data['name'] = $name;
		} elseif ( ! $is_update ) {
			return new WP_Error( 'codeclove_missing_field', __( 'Subject name is required.', 'codeclove-school-management' ), 400 );
		}

		if ( isset( $payload['code'] ) ) {
			$db_data['code'] = sanitize_text_field( $payload['code'] );
		}

		if ( isset( $payload['type'] ) ) {
			$type = sanitize_text_field( $payload['type'] );
			if ( ! in_array( $type, [ 'core', 'elective', 'activity', 'other' ], true ) ) {
				$type = 'core'; // Fallback
			}
			$db_data['type'] = $type;
		} elseif ( ! $is_update ) {
			$db_data['type'] = 'core';
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
	 * Maps DB subject row to REST structure.
	 *
	 * @param array $row        DB row.
	 * @param int   $session_id Academic session ID.
	 * @return array
	 */
	public function map_subject( array $row, int $session_id = 0 ): array {
		global $wpdb;
		$table       = \CodeClove\Database\Schema::unit_subjects();
		$units_table = \CodeClove\Database\Schema::units();

		if ( $session_id > 0 ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Subject mapped unit IDs by session.
			$unit_ids = $wpdb->get_col(
				$wpdb->prepare(
					'SELECT us.academic_unit_id 
					 FROM %i us
					 JOIN %i u ON us.academic_unit_id = u.id
					 WHERE us.subject_id = %d AND u.academic_session_id = %d',
					\CodeClove\Database\Schema::unit_subjects(),
					\CodeClove\Database\Schema::units(),
					(int) $row['id'],
					$session_id
				)
			);
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Subject mapped unit IDs.
			$unit_ids = $wpdb->get_col(
				$wpdb->prepare(
					'SELECT academic_unit_id FROM %i WHERE subject_id = %d',
					\CodeClove\Database\Schema::unit_subjects(),
					(int) $row['id']
				)
			);
		}
		$unit_ids = array_map( 'intval', is_array( $unit_ids ) ? $unit_ids : [] );

		return [
			'id'          => (int) $row['id'],
			'session_id'  => $session_id,
			'name'        => (string) $row['name'],
			'code'        => $row['code'] ? (string) $row['code'] : null,
			'type'        => (string) ( $row['type'] ?? 'core' ),
			'status'      => (string) ( $row['status'] ?? 'active' ),
			'color'       => null, // Placeholder/not directly supported in DB but kept for frontend interface
			'units_count' => (int) ( $row['units_count'] ?? 0 ),
			'unit_ids'    => $unit_ids,
			'created_at'  => (string) $row['created_at'],
		];
	}

	// ─── Database Operations ─────────────────────────────────────────────────

	/**
	 * Gets subjects matching arguments.
	 */
	private function db_get_subjects( array $args = [] ): array {
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

		$session_id = (int) $params['session_id'];
		$binds      = [];

		if ( $session_id > 0 ) {
			$query = 'SELECT s.*,
				(SELECT COUNT(*) FROM %i us
				 JOIN %i u ON us.academic_unit_id = u.id
				 WHERE us.subject_id = s.id AND u.academic_session_id = %d) as units_count
				FROM %i s WHERE 1=1';
			$binds = [ Schema::unit_subjects(), Schema::units(), $session_id, Schema::subjects() ];
		} else {
			$query = 'SELECT s.*,
				(SELECT COUNT(*) FROM %i WHERE subject_id = s.id) as units_count
				FROM %i s WHERE 1=1';
			$binds = [ Schema::unit_subjects(), Schema::subjects() ];
		}

		if ( '' !== $params['status'] ) {
			$query   .= ' AND s.status = %s';
			$binds[] = $params['status'];
		}

		if ( '' !== $params['search'] ) {
			$query   .= ' AND (s.name LIKE %s OR s.code LIKE %s)';
			$like    = '%' . $wpdb->esc_like( $params['search'] ) . '%';
			$binds[] = $like;
			$binds[] = $like;
		}

		$orderby = ! empty( $params['orderby'] ) ? sanitize_text_field( $params['orderby'] ) : 'name';
		$order   = ! empty( $params['order'] ) && in_array( strtolower( $params['order'] ), [ 'asc', 'desc' ], true ) ? strtoupper( $params['order'] ) : 'ASC';

		$orderby_whitelist = [
			'name'        => 's.name',
			'code'        => 's.code',
			'type'        => 's.type',
			'status'      => 's.status',
			'units_count' => 'units_count',
		];

		$orderby_sql = isset( $orderby_whitelist[ $orderby ] ) ? $orderby_whitelist[ $orderby ] : 's.name';

		$query   .= " ORDER BY {$orderby_sql} {$order}, s.id ASC";
		$query   .= ' LIMIT %d OFFSET %d';
		$binds[] = $params['limit'];
		$binds[] = $params['offset'];

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Custom academic subjects list query with dynamic clauses.
		$results = $wpdb->get_results( $wpdb->prepare( $query, ...$binds ), ARRAY_A );

		return is_array( $results ) ? $results : [];
	}

	/**
	 * Counts subjects matching arguments.
	 */
	private function db_count_subjects( array $args = [] ): int {
		global $wpdb;

		$query = 'SELECT COUNT(*) FROM %i s WHERE 1=1';
		$binds = [ Schema::subjects() ];

		if ( ! empty( $args['status'] ) ) {
			$query   .= ' AND s.status = %s';
			$binds[] = $args['status'];
		}

		if ( ! empty( $args['search'] ) ) {
			$query   .= ' AND (s.name LIKE %s OR s.code LIKE %s)';
			$like    = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$binds[] = $like;
			$binds[] = $like;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Custom academic subjects count query with dynamic clauses.
		return (int) $wpdb->get_var( $wpdb->prepare( $query, ...$binds ) );
	}

	/**
	 * Gets a single subject by ID.
	 */
	private function db_get_subject( int $id ): ?array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Single academic subject query.
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT s.*,
					(SELECT COUNT(*) FROM %i WHERE subject_id = s.id) as units_count
				 FROM %i s WHERE s.id = %d',
				Schema::unit_subjects(),
				Schema::subjects(),
				$id
			),
			ARRAY_A
		);

		return is_array( $row ) ? $row : null;
	}

	/**
	 * Creates a subject.
	 */
	private function db_create_subject( array $data ): ?int {
		global $wpdb;

		$data['created_at'] = gmdate( 'Y-m-d H:i:s' );
		$data['updated_at'] = gmdate( 'Y-m-d H:i:s' );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$result = $wpdb->insert( Schema::subjects(), $data );
		// phpcs:enable

		return $result ? (int) $wpdb->insert_id : null;
	}

	/**
	 * Updates a subject.
	 */
	private function db_update_subject( int $id, array $data ): bool {
		global $wpdb;

		$data['updated_at'] = gmdate( 'Y-m-d H:i:s' );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$result = $wpdb->update(
			Schema::subjects(),
			$data,
			[ 'id' => $id ]
		);
		// phpcs:enable

		return false !== $result;
	}

	/**
	 * Deletes a subject.
	 */
	private function db_delete_subject( int $id ): bool {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$result = $wpdb->delete(
			Schema::subjects(),
			[ 'id' => $id ]
		);
		// phpcs:enable

		return false !== $result;
	}

	/**
	 * Checks if a subject is mapped to any unit.
	 */
	private function db_is_subject_mapped_to_units( int $id ): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Unit subject mapping check query.
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE subject_id = %d',
				Schema::unit_subjects(),
				$id
			)
		) > 0;
	}
}
