<?php
/**
 * Attendance module business logic service.
 *
 * Handles database operations and business logic for student and staff attendance.
 *
 * @package CodeClove\Modules\Attendance
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Attendance;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Database\Schema;
use CodeClove\Database\Transaction;
use WP_Error;

/**
 * Class AttendanceService
 */
final class AttendanceService {

	/**
	 * Gets student attendance register or history log.
	 *
	 * @param array $params Query parameters.
	 * @return array|null Results or null/WP_Error.
	 */
	public function get_student_attendance( array $params ): array {
		global $wpdb;

		$student_id = $params['student_id'] ?? null;

		// History Mode (single student)
		if ( ! empty( $student_id ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Student attendance history query.
			return $wpdb->get_results(
				$wpdb->prepare(
					'SELECT a.*, u.name as unit_name, g.name as group_name, s.name as session_name
					FROM %i a
					LEFT JOIN %i u ON u.id = a.academic_unit_id
					LEFT JOIN %i g ON g.id = a.academic_group_id
					LEFT JOIN %i s ON s.id = a.academic_session_id
					WHERE a.student_id = %d AND a.deleted_at IS NULL
					ORDER BY a.attendance_date DESC',
					Schema::attendance(),
					Schema::units(),
					Schema::groups(),
					Schema::sessions(),
					(int) $student_id
				),
				ARRAY_A
			);
		}

		// Register Mode (class + section + date)
		$session_id = $params['academic_session_id'] ?? null;
		$unit_id    = $params['academic_unit_id'] ?? null;
		$group_id   = $params['academic_group_id'] ?? null;
		$date       = $params['attendance_date'] ?? null;

		$query = 'SELECT 
			s.id as student_id, s.first_name, s.last_name, s.student_number,
			se.roll_number, se.academic_group_id, g.name as group_name,
			a.id as attendance_id, a.status, a.note, a.taken_by
			FROM %i s
			INNER JOIN %i se ON se.student_id = s.id
			LEFT JOIN %i g ON g.id = se.academic_group_id
			LEFT JOIN %i a ON a.student_id = s.id 
				AND a.attendance_date = %s 
				AND a.academic_session_id = %d 
				AND a.deleted_at IS NULL
			WHERE s.deleted_at IS NULL
				AND se.academic_session_id = %d
				AND se.academic_unit_id = %d
				AND se.status != %s';

		$binds = [
			Schema::students(),
			Schema::enrollments(),
			Schema::groups(),
			Schema::attendance(),
			$date,
			(int) $session_id,
			(int) $session_id,
			(int) $unit_id,
			'withdrawn',
		];

		if ( ! empty( $group_id ) ) {
			$query   .= ' AND se.academic_group_id = %d';
			$binds[] = (int) $group_id;
		}

		$query .= ' ORDER BY g.name ASC, CAST(se.roll_number AS UNSIGNED) ASC, se.roll_number ASC, s.last_name ASC, s.first_name ASC';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Dynamic student attendance register query.
		$results = $wpdb->get_results( $wpdb->prepare( $query, ...$binds ), ARRAY_A );

		// Clean null fields for JSON output consistency
		foreach ( $results as &$row ) {
			$row['student_id']        = (int) $row['student_id'];
			$row['academic_group_id'] = $row['academic_group_id'] ? (int) $row['academic_group_id'] : null;
			$row['group_name']        = $row['group_name'] ?: null;
			$row['attendance_id']     = $row['attendance_id'] ? (int) $row['attendance_id'] : null;
			$row['taken_by']          = $row['taken_by'] ? (int) $row['taken_by'] : null;
			$row['status']            = $row['status'] ?: null;
		}
		return $results;
	}

	/**
	 * Takes or updates student daily attendance register.
	 *
	 * @param array $params Parameters including date, session_id, unit_id, group_id, records.
	 * @param int   $user_id ID of user recording attendance.
	 * @return bool|WP_Error True on success or WP_Error.
	 */
	public function save_student_attendance( array $params, int $user_id ): bool|WP_Error {
		$session_id = $params['academic_session_id'] ?? null;
		$unit_id    = $params['academic_unit_id'] ?? null;
		$group_id   = $params['academic_group_id'] ?? null;
		$date       = $params['attendance_date'] ?? null;
		$records    = $params['records'] ?? [];

		$table           = Schema::attendance();
		$now             = current_time( 'mysql', true );
		$marked_students = [];

		$result = Transaction::run( function( $wpdb ) use ( $records, $table, $now, $session_id, $unit_id, $group_id, $date, $user_id, &$marked_students ) {
			foreach ( $records as $rec ) {
				$student_id = isset( $rec['student_id'] ) ? (int) $rec['student_id'] : 0;
				$status     = isset( $rec['status'] ) ? sanitize_text_field( $rec['status'] ) : '';
				$note       = isset( $rec['note'] ) ? sanitize_textarea_field( $rec['note'] ) : '';

				if ( ! $student_id ) {
					continue;
				}

				// soft-delete if status is empty to avoid DB bloat
				if ( empty( $status ) ) {
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Student attendance record lookup.
					$existing_id = $wpdb->get_var(
						$wpdb->prepare(
							'SELECT id FROM %i WHERE student_id = %d AND attendance_date = %s AND academic_session_id = %d LIMIT 1',
							$table,
							$student_id,
							$date,
							(int) $session_id
						)
					);
					if ( $existing_id ) {
						$wpdb->update(
							$table,
							[
								'deleted_at' => $now,
								'updated_at' => $now,
							],
							[ 'id' => $existing_id ],
							[ '%s', '%s' ],
							[ '%d' ]
						);
					}
					continue;
				}

				$insert_data = [
					'student_id'          => $student_id,
					'academic_session_id' => (int) $session_id,
					'academic_unit_id'    => (int) $unit_id,
					'academic_group_id'   => $group_id ? (int) $group_id : null,
					'attendance_date'     => $date,
					'status'              => $status,
					'note'                => $note,
					'taken_by'            => $user_id,
					'created_at'          => $now,
					'updated_at'          => $now,
				];

				$format = [ '%d', '%d', '%d', '%d', '%s', '%s', '%s', '%d', '%s', '%s' ];

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Student attendance record lookup.
				$existing_id = $wpdb->get_var(
					$wpdb->prepare(
						'SELECT id FROM %i WHERE student_id = %d AND attendance_date = %s AND academic_session_id = %d LIMIT 1',
						$table,
						$student_id,
						$date,
						(int) $session_id
					)
				);

				if ( $existing_id ) {
					$wpdb->update(
						$table,
						[
							'status'     => $status,
							'note'       => $note,
							'taken_by'   => $user_id,
							'updated_at' => $now,
							'deleted_at' => null,
						],
						[ 'id' => $existing_id ],
						[ '%s', '%s', '%d', '%s', '%s' ],
						[ '%d' ]
					);
				} else {
					$wpdb->insert( $table, $insert_data, $format );
				}
				// phpcs:enable
				$marked_students[] = [
					'student_id' => $student_id,
					'status'     => $status,
				];
			}

			return true;
		} );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		foreach ( $marked_students as $marked ) {
			do_action( 'codeclove_student_attendance_marked', $marked['student_id'], $date, $marked['status'] );
		}
		do_action( 'codeclove_attendance_saved', $unit_id, $group_id, $date, $user_id );

		return true;
	}

	/**
	 * Gets staff attendance register or history log.
	 *
	 * @param array $params Query parameters.
	 * @return array Results array.
	 */
	public function get_staff_attendance( array $params ): array {
		global $wpdb;

		$staff_member_id = $params['staff_member_id'] ?? null;

		// History Mode (single staff member)
		if ( ! empty( $staff_member_id ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Staff attendance history query.
			return $wpdb->get_results(
				$wpdb->prepare(
					'SELECT * FROM %i WHERE staff_member_id = %d AND deleted_at IS NULL ORDER BY attendance_date DESC',
					Schema::staff_attendance(),
					(int) $staff_member_id
				),
				ARRAY_A
			);
		}

		// Register Mode (date)
		$date = $params['attendance_date'] ?? null;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Staff daily attendance register query.
		$results = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT 
				s.id as staff_member_id, s.first_name, s.last_name, s.staff_number, s.department, s.designation,
				a.id as attendance_id, a.status, a.note, a.taken_by
				FROM %i s
				LEFT JOIN %i a ON a.staff_member_id = s.id 
					AND a.attendance_date = %s 
					AND a.deleted_at IS NULL
				WHERE s.deleted_at IS NULL AND s.status = %s
				ORDER BY s.last_name ASC, s.first_name ASC',
				Schema::staff_members(),
				Schema::staff_attendance(),
				$date,
				'active'
			),
			ARRAY_A
		);

		$absences = [];

		// Clean null fields for JSON output consistency
		foreach ( $results as &$row ) {
			$row['staff_member_id'] = (int) $row['staff_member_id'];
			$row['attendance_id']   = $row['attendance_id'] ? (int) $row['attendance_id'] : null;
			$row['taken_by']         = $row['taken_by'] ? (int) $row['taken_by'] : null;

			// Auto-fill absence status if they are absent on timetable and attendance hasn't been saved yet
			if ( null === $row['status'] && isset( $absences[ $row['staff_member_id'] ] ) ) {
				$row['status'] = 'absent';
				$reason        = $absences[ $row['staff_member_id'] ] ?? '';
				/* translators: %s: absence reason */
				$row['note']   = $reason ? sprintf( __( 'Auto-marked: absent on timetable (%s)', 'codeclove-school-management' ), $reason ) : __( 'Auto-marked: absent on timetable', 'codeclove-school-management' );
			} else {
				$row['status'] = $row['status'] ?: null;
			}
		}

		return $results;
	}

	/**
	 * Takes or updates staff daily attendance register.
	 *
	 * @param array $params Parameters including date, records.
	 * @param int   $user_id ID of user recording attendance.
	 * @return bool|WP_Error True on success or WP_Error.
	 */
	public function save_staff_attendance( array $params, int $user_id ): bool|WP_Error {
		$date    = $params['attendance_date'] ?? null;
		$records = $params['records'] ?? [];

		$table   = Schema::staff_attendance();
		$now     = current_time( 'mysql', true );

		$result = Transaction::run( function( $wpdb ) use ( $records, $table, $now, $date, $user_id ) {
			foreach ( $records as $rec ) {
				$staff_member_id = isset( $rec['staff_member_id'] ) ? (int) $rec['staff_member_id'] : 0;
				$status          = isset( $rec['status'] ) ? sanitize_text_field( $rec['status'] ) : '';
				$note            = isset( $rec['note'] ) ? sanitize_textarea_field( $rec['note'] ) : '';

				if ( ! $staff_member_id ) {
					continue;
				}

				// soft-delete if status is empty to avoid DB bloat
				if ( empty( $status ) ) {
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Staff attendance lookup query.
					$existing_id = $wpdb->get_var(
						$wpdb->prepare(
							'SELECT id FROM %i WHERE staff_member_id = %d AND attendance_date = %s LIMIT 1',
							$table,
							$staff_member_id,
							$date
						)
					);
					if ( $existing_id ) {
						$wpdb->update(
							$table,
							[
								'deleted_at' => $now,
								'updated_at' => $now,
							],
							[ 'id' => $existing_id ],
							[ '%s', '%s' ],
							[ '%d' ]
						);
					}
					continue;
				}

				// check-then-insert-or-update
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Staff attendance lookup query.
				$existing_id = $wpdb->get_var(
					$wpdb->prepare(
						'SELECT id FROM %i WHERE staff_member_id = %d AND attendance_date = %s LIMIT 1',
						$table,
						$staff_member_id,
						$date
					)
				);
				if ( $existing_id ) {
					$wpdb->update(
						$table,
						[
							'status'     => $status,
							'note'       => $note,
							'taken_by'   => $user_id,
							'updated_at' => $now,
							'deleted_at' => null,
						],
						[ 'id' => $existing_id ],
						[ '%s', '%s', '%d', '%s', '%s' ],
						[ '%d' ]
					);
				} else {
					$wpdb->insert(
						$table,
						[
							'staff_member_id' => $staff_member_id,
							'attendance_date' => $date,
							'status'          => $status,
							'note'            => $note,
							'taken_by'        => $user_id,
							'created_at'      => $now,
							'updated_at'      => $now,
						],
						[ '%d', '%s', '%s', '%s', '%d', '%s', '%s' ]
					);
				}
				// phpcs:enable
			}

			return true;
		} );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return true;
	}

	/**
	 * Gets monthly attendance matrix for students.
	 *
	 * @param array $params Parameters containing session_id, unit_id, group_id, year, month.
	 * @return array Matrix data.
	 */
	public function get_monthly_student_attendance( array $params ): array {
		global $wpdb;

		$session_id = $params['academic_session_id'] ?? null;
		$unit_id    = $params['academic_unit_id'] ?? null;
		$group_id   = $params['academic_group_id'] ?? null;
		$year       = $params['year'] ?? null;
		$month      = $params['month'] ?? null;

		$month = str_pad( (string) $month, 2, '0', STR_PAD_LEFT );
		$start_date = "{$year}-{$month}-01";
		$end_date   = gmdate( 'Y-m-t', strtotime( $start_date ) );

		// Fetch active students
		$student_query = 'SELECT s.id as student_id, s.first_name, s.last_name, s.student_number, se.roll_number,
			u.name as unit_name, u.name as class_name, g.name as group_name, g.name as section_name
			FROM %i s
			INNER JOIN %i se ON se.student_id = s.id
			LEFT JOIN %i u ON u.id = se.academic_unit_id
			LEFT JOIN %i g ON g.id = se.academic_group_id
			WHERE s.deleted_at IS NULL 
				AND se.academic_session_id = %d 
				AND se.academic_unit_id = %d
				AND se.status != %s';
		
		$student_binds = [
			Schema::students(),
			Schema::enrollments(),
			Schema::units(),
			Schema::groups(),
			(int) $session_id,
			(int) $unit_id,
			'withdrawn',
		];

		if ( ! empty( $group_id ) ) {
			$student_query .= ' AND se.academic_group_id = %d';
			$student_binds[] = (int) $group_id;
		}

		$student_query .= ' ORDER BY g.name ASC, CAST(se.roll_number AS UNSIGNED) ASC, se.roll_number ASC, s.last_name ASC, s.first_name ASC';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Monthly student attendance roster query.
		$students = $wpdb->get_results( $wpdb->prepare( $student_query, ...$student_binds ), ARRAY_A );

		// Fetch attendance records in date range
		$attendance_query = 'SELECT student_id, attendance_date, status, note
			FROM %i
			WHERE academic_session_id = %d AND academic_unit_id = %d AND attendance_date BETWEEN %s AND %s AND deleted_at IS NULL';
		
		$attendance_binds = [ Schema::attendance(), (int) $session_id, (int) $unit_id, $start_date, $end_date ];

		if ( ! empty( $group_id ) ) {
			$attendance_query .= ' AND academic_group_id = %d';
			$attendance_binds[] = (int) $group_id;
		}
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Monthly student attendance records query.
		$attendance_records = $wpdb->get_results( $wpdb->prepare( $attendance_query, ...$attendance_binds ), ARRAY_A );

		// Pivot records
		$matrix = [];
		foreach ( $attendance_records as $rec ) {
			$matrix[ (int) $rec['student_id'] ][ $rec['attendance_date'] ] = [
				'status' => $rec['status'],
				'note'   => $rec['note'] ?? ''
			];
		}

		$days_in_month = (int) gmdate( 't', strtotime( $start_date ) );

		return [
			'days_in_month' => $days_in_month,
			'students'      => $students,
			'attendance'    => $matrix,
		];
	}

	/**
	 * Gets monthly attendance matrix for staff.
	 *
	 * @param array $params Parameters containing year, month.
	 * @return array Matrix data.
	 */
	public function get_monthly_staff_attendance( array $params ): array {
		global $wpdb;

		$year  = $params['year'] ?? null;
		$month = $params['month'] ?? null;

		$month = str_pad( (string) $month, 2, '0', STR_PAD_LEFT );
		$start_date = "{$year}-{$month}-01";
		$end_date   = gmdate( 'Y-m-t', strtotime( $start_date ) );

		// Fetch active staff
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Monthly staff roster query.
		$staff = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT id as staff_member_id, first_name, last_name, staff_number, department, designation
				FROM %i
				WHERE deleted_at IS NULL AND status = %s
				ORDER BY last_name ASC, first_name ASC',
				Schema::staff_members(),
				'active'
			),
			ARRAY_A
		);

		// Fetch attendance in date range
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Monthly staff attendance records query.
		$attendance_records = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT staff_member_id, attendance_date, status, note
				FROM %i
				WHERE attendance_date BETWEEN %s AND %s AND deleted_at IS NULL',
				Schema::staff_attendance(),
				$start_date,
				$end_date
			),
			ARRAY_A
		);

		// Pivot records
		$matrix = [];
		foreach ( $attendance_records as $rec ) {
			$matrix[ (int) $rec['staff_member_id'] ][ $rec['attendance_date'] ] = [
				'status' => $rec['status'],
				'note'   => $rec['note'] ?? ''
			];
		}

		$days_in_month = (int) gmdate( 't', strtotime( $start_date ) );

		return [
			'days_in_month' => $days_in_month,
			'staff'         => $staff,
			'attendance'    => $matrix,
		];
	}
}
