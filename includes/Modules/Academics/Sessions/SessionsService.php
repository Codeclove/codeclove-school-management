<?php
/**
 * Sessions service.
 *
 * Implements business logic and validation rules for academic sessions and terms.
 *
 * @package CodeClove\Modules\Academics\Sessions
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Academics\Sessions;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Database\Schema;
use CodeClove\Database\Transaction;
use CodeClove\Core\Logger;
use WP_Error;

/**
 * Class SessionsService
 */
final class SessionsService {

	/**
	 * Gets and maps academic sessions.
	 *
	 * @param array $args Filter and pagination args.
	 * @return array{sessions: array, total: int}
	 */
	public function get_sessions( array $args = [] ): array {
		$sessions = $this->db_get_sessions( $args );
		$total    = $this->db_count_sessions( $args );

		$mapped = array_map( [ $this, 'map_session' ], $sessions );

		return [
			'sessions' => $mapped,
			'total'    => $total,
		];
	}

	public function get_session( int $id ): ?array {
		$session = $this->db_get_session( $id );
		return $session ? $this->map_session( $session ) : null;
	}

	/**
	 * Gets the ID of the current active academic session.
	 *
	 * @return int|null Current session ID or null if none configured.
	 */
	public function get_current_session_id(): ?int {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Custom database table query.
		$id = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM %i WHERE is_current = %d LIMIT 1',
				Schema::sessions(),
				1
			)
		);
		return $id ? (int) $id : null;
	}

	/**
	 * Validates and creates a new academic session.
	 *
	 * @param array $payload REST request body.
	 * @return array|WP_Error Mapped session or error.
	 */
	public function create_session( array $payload ): array|WP_Error {
		$validated = $this->validate_session_payload( $payload );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		// Implement "Single Active Session" rule if payload sets it.
		$is_current = ! empty( $validated['is_current'] );

		return Transaction::run( function() use ( $validated, $is_current ) {
			if ( $is_current ) {
				$this->db_clear_current_session_flag();
			}

			$id = $this->db_create_session( $validated );
			if ( null === $id ) {
				return new WP_Error( 'codeclove_create_failed', __( 'Failed to create academic session.', 'codeclove-school-management' ), 500 );
			}

			// Bootstrapping starts here!
			$settings_repo = new \CodeClove\Modules\Settings\SettingsRepository();
			$settings = $settings_repo->get_settings();
			$edu_settings = $settings['education_system'] ?? [];

			$default_number_terms = (int) ( $edu_settings['default_number_terms'] ?? 3 );
			$default_units = (array) ( $edu_settings['default_academic_units'] ?? [] );
			$default_groups = (array) ( $edu_settings['default_groups_per_unit'] ?? [] );
			$strategy = $edu_settings['new_session_classes_creation'] ?? 'clone';

			// Determine if a previous session exists (excluding the newly created one) that has classes.
			$latest_session = 'clone' === $strategy ? $this->db_get_latest_session_with_units( $id ) : null;

			if ( $latest_session ) {
				// Clone active units and groups.
				$cloned = $this->db_clone_units_and_groups( (int) $latest_session['id'], $id );
				if ( ! $cloned ) {
					return new WP_Error( 'codeclove_bootstrap_failed', __( 'Failed to clone units and groups from the previous session.', 'codeclove-school-management' ), 500 );
				}
			} else {
				// Seed default units and groups.
				$seeded = $this->db_bulk_create_units( $id, $default_units, $default_groups );
				if ( ! $seeded ) {
					return new WP_Error( 'codeclove_bootstrap_failed', __( 'Failed to seed default academic units and groups.', 'codeclove-school-management' ), 500 );
				}
			}

			// Auto-generate terms.
			if ( $default_number_terms > 0 ) {
				$terms = [];
				try {
					$start = new \DateTime( $validated['starts_on'] );
					$end   = new \DateTime( $validated['ends_on'] );
					$diff  = $start->diff( $end );
					$total_days = $diff->days;
					$days_per_term = floor( ( $total_days + 1 ) / $default_number_terms );

					$current_start = clone $start;
					for ( $i = 0; $i < $default_number_terms; $i++ ) {
						$term_start = clone $current_start;
						if ( $i === $default_number_terms - 1 ) {
							$term_end = clone $end;
						} else {
							$term_end = clone $current_start;
							$days_to_add = (int) $days_per_term - 1;
							if ( $days_to_add < 0 ) {
								$days_to_add = 0;
							}
							$term_end->modify( "+{$days_to_add} days" );
							if ( $term_end > $end ) {
								$term_end = clone $end;
							}
						}

						$terms[] = [
							'name'      => sprintf( 'Term %d', $i + 1 ),
							'code'      => sprintf( 'T%d', $i + 1 ),
							'starts_on' => $term_start->format( 'Y-m-d' ),
							'ends_on'   => $term_end->format( 'Y-m-d' ),
						];

						$current_start = clone $term_end;
						$current_start->modify( '+1 day' );
					}
				} catch ( \Throwable $e ) {
					Logger::error( 'Failed to partition session date range for terms: ' . $e->getMessage(), $e );
					return new WP_Error( 'codeclove_bootstrap_failed', __( 'Failed to partition session date range for terms.', 'codeclove-school-management' ), 500 );
				}

				$terms_created = $this->db_bulk_create_terms( $id, $terms );
				if ( ! $terms_created ) {
					return new WP_Error( 'codeclove_bootstrap_failed', __( 'Failed to create academic terms.', 'codeclove-school-management' ), 500 );
				}
			}

			return $this->get_session( $id );
		} );
	}

	/**
	 * Validates and updates an academic session.
	 *
	 * @param int   $id      Session ID.
	 * @param array $payload REST patch body.
	 * @return array|WP_Error Mapped session or error.
	 */
	public function update_session( int $id, array $payload ): array|WP_Error {
		$current = $this->db_get_session( $id );
		if ( null === $current ) {
			return new WP_Error( 'codeclove_not_found', __( 'Academic session not found.', 'codeclove-school-management' ), 404 );
		}

		$validated = $this->validate_session_payload( $payload, $id );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		// Implement "Archived Dependencies Check" rule if session is being archived.
		if ( isset( $validated['status'] ) && 'archived' === $validated['status'] ) {
			if ( $this->db_has_enrolled_students( $id ) ) {
				return new WP_Error( 'codeclove_archive_failed', __( 'Cannot archive session: there are active student enrollments in this session.', 'codeclove-school-management' ), 400 );
			}
			if ( $this->db_has_active_transactions( $id ) ) {
				return new WP_Error( 'codeclove_archive_failed', __( 'Cannot archive session: there are active financial transactions/unpaid invoices in this session.', 'codeclove-school-management' ), 400 );
			}
		}

		// Implement "Single Active Session" rule if payload sets it to 1.
		$is_current = isset( $validated['is_current'] ) && 1 === $validated['is_current'];

		return Transaction::run( function() use ( $id, $validated, $is_current ) {
			if ( $is_current ) {
				$this->db_clear_current_session_flag();
			}

			$updated = $this->db_update_session( $id, $validated );
			if ( ! $updated ) {
				return new WP_Error( 'codeclove_update_failed', __( 'Failed to update academic session.', 'codeclove-school-management' ), 500 );
			}

			return $this->get_session( $id );
		} );
	}

	/**
	 * Deletes an academic session.
	 *
	 * @param int $id Session ID.
	 * @return bool|WP_Error True if success, or error.
	 */
	public function delete_session( int $id ): bool|WP_Error {
		$session = $this->db_get_session( $id );
		if ( null === $session ) {
			return new WP_Error( 'codeclove_not_found', __( 'Academic session not found.', 'codeclove-school-management' ), 404 );
		}

		// Disallow deletion if it has associated enrolled students.
		if ( $this->db_has_enrolled_students( $id ) ) {
			return new WP_Error( 'codeclove_has_students', __( 'Cannot delete session: it has enrolled students.', 'codeclove-school-management' ), 400 );
		}

		// Disallow deletion if it has active transactions.
		if ( $this->db_has_active_transactions( $id ) ) {
			return new WP_Error( 'codeclove_has_transactions', __( 'Cannot delete session: it has active transactions.', 'codeclove-school-management' ), 400 );
		}

		return $this->db_delete_session( $id );
	}

	/**
	 * Validates session data.
	 *
	 * @param array    $payload Raw payload.
	 * @param int|null $id      Existing session ID (for updates).
	 * @return array|WP_Error Mapped db-friendly structure or error.
	 */
	private function validate_session_payload( array $payload, ?int $id = null ): array|WP_Error {
		$db_data = [];

		// For creation, name is required. For updates, it's optional.
		if ( isset( $payload['name'] ) ) {
			$name = sanitize_text_field( trim( (string) $payload['name'] ) );
			if ( strlen( $name ) < 2 ) {
				return new WP_Error( 'codeclove_invalid_name', __( 'Name must be at least 2 characters.', 'codeclove-school-management' ), [ 'status' => 400 ] );
			}
			$db_data['name'] = $name;
		} elseif ( null === $id ) {
			return new WP_Error( 'codeclove_missing_field', __( 'Session name is required.', 'codeclove-school-management' ), [ 'status' => 400 ] );
		}

		// Map dates
		$start_date = isset( $payload['start_date'] ) ? sanitize_text_field( $payload['start_date'] ) : null;
		$end_date   = isset( $payload['end_date'] ) ? sanitize_text_field( $payload['end_date'] ) : null;

		if ( null === $id && ( ! $start_date || ! $end_date ) ) {
			return new WP_Error( 'codeclove_missing_field', __( 'Start date and end date are required.', 'codeclove-school-management' ), [ 'status' => 400 ] );
		}

		// Fetch existing to do comparisons on partial updates.
		$existing = $id ? $this->db_get_session( $id ) : null;
		$final_start = $start_date ?: ( $existing['starts_on'] ?? '' );
		$final_end   = $end_date ?: ( $existing['ends_on'] ?? '' );

		if ( ! empty( $final_start ) && ! empty( $final_end ) ) {
			if ( $final_start >= $final_end ) {
				return new WP_Error( 'codeclove_invalid_dates', __( 'End date must be after start date.', 'codeclove-school-management' ), [ 'status' => 400 ] );
			}

			// Validate against academic cycle start and end months in settings (only on create or explicit date update)
			if ( null === $id || $start_date || $end_date ) {
				$settings_repo = new \CodeClove\Modules\Settings\SettingsRepository();
				$settings      = $settings_repo->get_settings();
				$start_month   = (int) ( $settings['education_system']['academic_year_start_month'] ?? 1 );
				$end_month     = (int) ( $settings['education_system']['academic_year_end_month'] ?? 12 );

				try {
					$start_datetime = new \DateTime( $final_start );
					$end_datetime   = new \DateTime( $final_end );
				} catch ( \Throwable $e ) {
					return new WP_Error( 'codeclove_invalid_dates', __( 'Invalid start or end date format.', 'codeclove-school-management' ), [ 'status' => 400 ] );
				}

				if ( (int) $start_datetime->format( 'n' ) !== $start_month ) {
					$start_month_name = date_i18n( 'F', mktime( 0, 0, 0, $start_month, 10 ) );
					$msg = sprintf(
						/* translators: %s: start month name */
						__( 'Session start date must fall in the designated start month: %s.', 'codeclove-school-management' ),
						$start_month_name
					);
					return new WP_Error( 'codeclove_invalid_start_month', $msg, [ 'status' => 400 ] );
				}

				if ( (int) $end_datetime->format( 'n' ) !== $end_month ) {
					$end_month_name = date_i18n( 'F', mktime( 0, 0, 0, $end_month, 10 ) );
					$msg = sprintf(
						/* translators: %s: end month name */
						__( 'Session end date must fall in the designated end month: %s.', 'codeclove-school-management' ),
						$end_month_name
					);
					return new WP_Error( 'codeclove_invalid_end_month', $msg, [ 'status' => 400 ] );
				}
			}
		}

		if ( $start_date ) {
			$db_data['starts_on'] = $start_date;
		}
		if ( $end_date ) {
			$db_data['ends_on'] = $end_date;
		}

		if ( isset( $payload['status'] ) ) {
			$status = sanitize_text_field( $payload['status'] );
			if ( ! in_array( $status, [ 'draft', 'active', 'archived' ], true ) ) {
				return new WP_Error( 'codeclove_invalid_status', __( 'Status must be draft, active, or archived.', 'codeclove-school-management' ), [ 'status' => 400 ] );
			}
			$db_data['status'] = $status;
		}

		if ( isset( $payload['is_current'] ) ) {
			$db_data['is_current'] = $payload['is_current'] ? 1 : 0;
		}

		return $db_data;
	}

	/**
	 * Maps database session row to REST response structure.
	 *
	 * @param array $row Row from DB.
	 * @return array
	 */
	public function map_session( array $row ): array {
		return [
			'id'          => (int) $row['id'],
			'name'        => (string) $row['name'],
			'slug'        => (string) ( $row['code'] ?? '' ), // Maps DB 'code' to JSON 'slug'
			'start_date'  => (string) $row['starts_on'],
			'end_date'    => (string) $row['ends_on'],
			'status'      => (string) $row['status'],
			'is_current'  => 1 === (int) $row['is_current'],
			'terms_count' => (int) ( $row['terms_count'] ?? 0 ),
			'created_at'  => (string) $row['created_at'],
			'updated_at'  => (string) $row['updated_at'],
		];
	}

	/**
	 * Gets all terms for a session.
	 *
	 * @param int $session_id Session ID.
	 * @return array
	 */
	public function get_terms( int $session_id ): array {
		$terms = $this->db_get_terms( $session_id );
		return array_map( [ $this, 'map_term' ], $terms );
	}

	/**
	 * Gets a single term by ID.
	 *
	 * @param int $id Term ID.
	 * @return array|null
	 */
	public function get_term( int $id ): ?array {
		$term = $this->db_get_term( $id );
		return $term ? $this->map_term( $term ) : null;
	}

	/**
	 * Creates a term.
	 *
	 * @param array $payload Term data.
	 * @return array|WP_Error Mapped term or error.
	 */
	public function create_term( array $payload ): array|WP_Error {
		$validated = $this->validate_term_payload( $payload );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$id = $this->db_create_term( $validated );
		if ( null === $id ) {
			return new WP_Error( 'codeclove_create_failed', __( 'Failed to create academic term.', 'codeclove-school-management' ), 500 );
		}

		return $this->get_term( $id );
	}

	/**
	 * Updates a term.
	 *
	 * @param int   $id      Term ID.
	 * @param array $payload Term data.
	 * @return array|WP_Error Mapped term or error.
	 */
	public function update_term( int $id, array $payload ): array|WP_Error {
		$current = $this->db_get_term( $id );
		if ( null === $current ) {
			return new WP_Error( 'codeclove_not_found', __( 'Academic term not found.', 'codeclove-school-management' ), 404 );
		}

		$validated = $this->validate_term_payload( $payload, $id );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$updated = $this->db_update_term( $id, $validated );
		if ( ! $updated ) {
			return new WP_Error( 'codeclove_update_failed', __( 'Failed to update academic term.', 'codeclove-school-management' ), 500 );
		}

		return $this->get_term( $id );
	}

	/**
	 * Deletes a term.
	 *
	 * @param int $id Term ID.
	 * @return bool|WP_Error True if success, or error.
	 */
	public function delete_term( int $id ): bool|WP_Error {
		$term = $this->db_get_term( $id );
		if ( null === $term ) {
			return new WP_Error( 'codeclove_not_found', __( 'Academic term not found.', 'codeclove-school-management' ), 404 );
		}

		return $this->db_delete_term( $id );
	}

	/**
	 * Validates term payload.
	 *
	 * @param array    $payload Payload.
	 * @param int|null $id      Existing ID.
	 * @return array|WP_Error
	 */
	private function validate_term_payload( array $payload, ?int $id = null ): array|WP_Error {
		$db_data = [];

		$existing = $id ? $this->db_get_term( $id ) : null;
		
		if ( isset( $payload['session_id'] ) ) {
			$session_id = (int) $payload['session_id'];
			$db_data['academic_session_id'] = $session_id;
		} elseif ( null === $id ) {
			return new WP_Error( 'codeclove_missing_field', __( 'Session ID (session_id) is required.', 'codeclove-school-management' ), 400 );
		} else {
			$session_id = (int) $existing['academic_session_id'];
		}

		$session = $this->db_get_session( $session_id );
		if ( null === $session ) {
			return new WP_Error( 'codeclove_invalid_session', __( 'Academic session not found.', 'codeclove-school-management' ), 400 );
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

		if ( isset( $payload['sort_order'] ) ) {
			$db_data['sort_order'] = (int) $payload['sort_order'];
		}

		if ( isset( $payload['status'] ) ) {
			$status = sanitize_text_field( $payload['status'] );
			if ( ! in_array( $status, [ 'active', 'inactive', 'archived' ], true ) ) {
				return new WP_Error( 'codeclove_invalid_status', __( 'Status must be active, inactive, or archived.', 'codeclove-school-management' ), 400 );
			}
			$db_data['status'] = $status;
		}

		// Dates validation
		$starts_on = isset( $payload['start_date'] ) ? sanitize_text_field( $payload['start_date'] ) : null;
		$ends_on   = isset( $payload['end_date'] ) ? sanitize_text_field( $payload['end_date'] ) : null;

		if ( null === $id && ( ! $starts_on || ! $ends_on ) ) {
			return new WP_Error( 'codeclove_missing_field', __( 'Start date and end date are required.', 'codeclove-school-management' ), 400 );
		}

		$final_start = $starts_on ?: ( $existing['starts_on'] ?? '' );
		$final_end   = $ends_on ?: ( $existing['ends_on'] ?? '' );

		if ( ! empty( $final_start ) && ! empty( $final_end ) ) {
			if ( $final_start >= $final_end ) {
				return new WP_Error( 'codeclove_invalid_dates', __( 'End date must be after start date.', 'codeclove-school-management' ), 400 );
			}
			// Must fall within session limits
			if ( $final_start < $session['starts_on'] || $final_end > $session['ends_on'] ) {
				return new WP_Error( 'codeclove_out_of_bounds', __( 'Term dates must fall within the session dates.', 'codeclove-school-management' ), 400 );
			}
		}

		if ( $starts_on ) {
			$db_data['starts_on'] = $starts_on;
		}
		if ( $ends_on ) {
			$db_data['ends_on'] = $ends_on;
		}

		return $db_data;
	}

	/**
	 * Maps DB term row to REST structure.
	 *
	 * @param array $row DB row.
	 * @return array
	 */
	public function map_term( array $row ): array {
		return [
			'id'         => (int) $row['id'],
			'session_id' => (int) $row['academic_session_id'],
			'name'       => (string) $row['name'],
			'code'       => $row['code'] ? (string) $row['code'] : null,
			'start_date' => (string) $row['starts_on'],
			'end_date'   => (string) $row['ends_on'],
			'sort_order' => (int) $row['sort_order'],
			'status'     => (string) $row['status'],
			'created_at' => (string) $row['created_at'],
		];
	}

	// ─── Database Operations ─────────────────────────────────────────────────

	/**
	 * Gets academic sessions matching the arguments.
	 */
	private function db_get_sessions( array $args = [] ): array {
		global $wpdb;

		$defaults = [
			'limit'  => 25,
			'offset' => 0,
			'search' => '',
			'status' => '',
		];
		$params = array_merge( $defaults, $args );

		// Subquery to get terms count.
		$query = 'SELECT s.*, 
			(SELECT COUNT(*) FROM %i WHERE academic_session_id = s.id) as terms_count
			FROM %i s WHERE 1=1';
		$binds = [ Schema::terms(), Schema::sessions() ];

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

		$query   .= ' ORDER BY s.starts_on DESC, s.id DESC';
		$query   .= ' LIMIT %d OFFSET %d';
		$binds[] = $params['limit'];
		$binds[] = $params['offset'];

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Custom academic sessions list query with dynamic clauses.
		$results = $wpdb->get_results( $wpdb->prepare( $query, ...$binds ), ARRAY_A );
		return is_array( $results ) ? $results : [];
	}

	/**
	 * Counts academic sessions matching the arguments.
	 */
	private function db_count_sessions( array $args = [] ): int {
		global $wpdb;

		$query = 'SELECT COUNT(*) FROM %i WHERE 1=1';
		$binds = [ Schema::sessions() ];

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

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Custom academic sessions count query with dynamic clauses.
		$count = $wpdb->get_var( $wpdb->prepare( $query, ...$binds ) );
		return (int) $count;
	}

	/**
	 * Gets a single academic session by ID.
	 */
	private function db_get_session( int $id ): ?array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Single academic session query.
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT s.*, 
					(SELECT COUNT(*) FROM %i WHERE academic_session_id = s.id) as terms_count
				 FROM %i s WHERE s.id = %d',
				Schema::terms(),
				Schema::sessions(),
				$id
			),
			ARRAY_A
		);

		return is_array( $row ) ? $row : null;
	}

	/**
	 * Creates a new academic session.
	 */
	private function db_create_session( array $data ): ?int {
		global $wpdb;

		$data['created_at'] = gmdate( 'Y-m-d H:i:s' );
		$data['updated_at'] = gmdate( 'Y-m-d H:i:s' );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->insert( Schema::sessions(), $data );
		// phpcs:enable

		return $result ? (int) $wpdb->insert_id : null;
	}

	/**
	 * Updates an academic session.
	 */
	private function db_update_session( int $id, array $data ): bool {
		global $wpdb;

		$data['updated_at'] = gmdate( 'Y-m-d H:i:s' );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->update(
			Schema::sessions(),
			$data,
			[ 'id' => $id ]
		);
		// phpcs:enable

		return false !== $result;
	}

	/**
	 * Deletes an academic session.
	 */
	private function db_delete_session( int $id ): bool {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->delete(
			Schema::sessions(),
			[ 'id' => $id ]
		);
		// phpcs:enable

		return false !== $result;
	}

	/**
	 * Clear the current flag for all academic sessions.
	 */
	private function db_clear_current_session_flag(): bool {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Custom database table query.
		$result = $wpdb->query(
			$wpdb->prepare(
				'UPDATE %i SET is_current = %d WHERE is_current = %d',
				Schema::sessions(),
				0,
				1
			)
		);

		return false !== $result;
	}

	/**
	 * Checks if a session has student enrollments.
	 */
	private function db_has_enrolled_students( int $id ): bool {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Enrolled students check query.
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE academic_session_id = %d',
				Schema::enrollments(),
				$id
			)
		) > 0;
	}

	/**
	 * Checks if a session has active invoices or financial transactions.
	 */
	private function db_has_active_transactions( int $id ): bool {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Active invoices check query.
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE academic_session_id = %d',
				Schema::invoices(),
				$id
			)
		) > 0;
	}

	/**
	 * Gets the session with the latest ends_on date (excluding the session itself).
	 */
	private function db_get_latest_session( ?int $exclude_session_id = null ): ?array {
		global $wpdb;
		if ( $exclude_session_id ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Latest academic session query.
			$row = $wpdb->get_row(
				$wpdb->prepare(
					'SELECT * FROM %i WHERE id != %d ORDER BY ends_on DESC LIMIT %d',
					Schema::sessions(),
					$exclude_session_id,
					1
				),
				ARRAY_A
			);
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Latest academic session query.
			$row = $wpdb->get_row(
				$wpdb->prepare(
					'SELECT * FROM %i ORDER BY ends_on DESC LIMIT %d',
					Schema::sessions(),
					1
				),
				ARRAY_A
			);
		}
		return is_array( $row ) ? $row : null;
	}

	/**
	 * Gets the session with the latest ends_on date (excluding the session itself)
	 * that actually contains active academic units (classes).
	 */
	private function db_get_latest_session_with_units( ?int $exclude_session_id = null ): ?array {
		global $wpdb;

		if ( $exclude_session_id ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Latest academic session with units query.
			$row = $wpdb->get_row(
				$wpdb->prepare(
					'SELECT * FROM %i s WHERE id != %d AND EXISTS (SELECT 1 FROM %i u WHERE u.academic_session_id = s.id AND u.status = %s) ORDER BY ends_on DESC LIMIT %d',
					Schema::sessions(),
					$exclude_session_id,
					Schema::units(),
					'active',
					1
				),
				ARRAY_A
			);
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Latest academic session with units query.
			$row = $wpdb->get_row(
				$wpdb->prepare(
					'SELECT * FROM %i s WHERE EXISTS (SELECT 1 FROM %i u WHERE u.academic_session_id = s.id AND u.status = %s) ORDER BY ends_on DESC LIMIT %d',
					Schema::sessions(),
					Schema::units(),
					'active',
					1
				),
				ARRAY_A
			);
		}
		return is_array( $row ) ? $row : null;
	}

	/**
	 * Clones all academic units and their groups from one session to another.
	 */
	private function db_clone_units_and_groups( int $from_session_id, int $to_session_id ): bool {
		global $wpdb;

		// Fetch units from source session.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Cloning units from session query.
		$units = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM %i WHERE academic_session_id = %d AND status = %s',
				Schema::units(),
				$from_session_id,
				'active'
			),
			ARRAY_A
		);

		if ( empty( $units ) ) {
			return true;
		}

		$now = gmdate( 'Y-m-d H:i:s' );

		foreach ( $units as $unit ) {
			// Insert unit in destination session.
			$unit_data = [
				'academic_session_id' => $to_session_id,
				'name'                => $unit['name'],
				'code'                => $unit['code'],
				'level_order'         => $unit['level_order'],
				'status'              => 'active',
				'created_at'          => $now,
				'updated_at'          => $now,
			];
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$inserted_unit = $wpdb->insert( Schema::units(), $unit_data );
			// phpcs:enable

			if ( ! $inserted_unit ) {
				return false;
			}

			$new_unit_id = (int) $wpdb->insert_id;

			// Fetch groups for this source unit.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Cloning groups from unit query.
			$groups = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT * FROM %i WHERE academic_unit_id = %d AND status = %s',
					Schema::groups(),
					(int) $unit['id'],
					'active'
				),
				ARRAY_A
			);

			foreach ( $groups as $group ) {
				$group_data = [
					'academic_unit_id' => $new_unit_id,
					'name'             => $group['name'],
					'code'             => $group['code'],
					'capacity'         => $group['capacity'],
					'status'           => 'active',
					'created_at'       => $now,
					'updated_at'       => $now,
				];
				// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
				$inserted_group = $wpdb->insert( Schema::groups(), $group_data );
				// phpcs:enable
				if ( ! $inserted_group ) {
					return false;
				}
			}
		}

		return true;
	}

	/**
	 * Bulk creates units and their default groups.
	 */
	private function db_bulk_create_units( int $session_id, array $unit_names, array $group_names ): bool {
		global $wpdb;
		$now = gmdate( 'Y-m-d H:i:s' );

		foreach ( $unit_names as $index => $name ) {
			$unit_data = [
				'academic_session_id' => $session_id,
				'name'                => $name,
				'code'                => null,
				'level_order'         => $index,
				'status'              => 'active',
				'created_at'          => $now,
				'updated_at'          => $now,
			];
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$inserted_unit = $wpdb->insert( Schema::units(), $unit_data );
			// phpcs:enable

			if ( ! $inserted_unit ) {
				return false;
			}

			$unit_id = (int) $wpdb->insert_id;

			foreach ( $group_names as $g_name ) {
				$group_data = [
					'academic_unit_id' => $unit_id,
					'name'             => $g_name,
					'code'             => null,
					'capacity'         => null,
					'status'           => 'active',
					'created_at'       => $now,
					'updated_at'       => $now,
				];
				// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
				$inserted_group = $wpdb->insert( Schema::groups(), $group_data );
				// phpcs:enable
				if ( ! $inserted_group ) {
					return false;
				}
			}
		}

		return true;
	}

	/**
	 * Seeds academic terms.
	 */
	private function db_bulk_create_terms( int $session_id, array $terms ): bool {
		global $wpdb;
		$now = gmdate( 'Y-m-d H:i:s' );

		foreach ( $terms as $index => $t ) {
			$term_data = [
				'academic_session_id' => $session_id,
				'name'                => $t['name'],
				'code'                => $t['code'] ?? null,
				'starts_on'           => $t['starts_on'],
				'ends_on'             => $t['ends_on'],
				'sort_order'          => $index,
				'status'              => 'active',
				'created_at'          => $now,
				'updated_at'          => $now,
			];
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$result = $wpdb->insert( Schema::terms(), $term_data );
			// phpcs:enable
			if ( ! $result ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Gets all terms for a session.
	 */
	private function db_get_terms( int $session_id ): array {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Session terms list query.
		$results = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM %i WHERE academic_session_id = %d ORDER BY sort_order ASC',
				Schema::terms(),
				$session_id
			),
			ARRAY_A
		);
		return is_array( $results ) ? $results : [];
	}

	/**
	 * Gets a term by ID.
	 */
	private function db_get_term( int $id ): ?array {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Single term query.
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM %i WHERE id = %d',
				Schema::terms(),
				$id
			),
			ARRAY_A
		);
		return is_array( $row ) ? $row : null;
	}

	/**
	 * Creates a term.
	 */
	private function db_create_term( array $data ): ?int {
		global $wpdb;
		$data['created_at'] = gmdate( 'Y-m-d H:i:s' );
		$data['updated_at'] = gmdate( 'Y-m-d H:i:s' );
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->insert( Schema::terms(), $data );
		// phpcs:enable
		return $result ? (int) $wpdb->insert_id : null;
	}

	/**
	 * Updates a term.
	 */
	private function db_update_term( int $id, array $data ): bool {
		global $wpdb;
		$data['updated_at'] = gmdate( 'Y-m-d H:i:s' );
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->update( Schema::terms(), $data, [ 'id' => $id ] );
		// phpcs:enable
		return false !== $result;
	}

	/**
	 * Deletes a term.
	 */
	private function db_delete_term( int $id ): bool {
		global $wpdb;
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->delete( Schema::terms(), [ 'id' => $id ] );
		// phpcs:enable
		return false !== $result;
	}
}
