<?php
/**
 * Portal service.
 *
 * Provides business logic and database queries for the Student & Guardian Portal:
 * - User context & multi-student switching
 * - Verification of student access permissions
 * - Dashboard summary, attendance, finance, timetable, academics, documents, profile, and notifications
 *
 * @package Nexora\Modules\Portal
 */

declare( strict_types=1 );

namespace Nexora\Modules\Portal;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Nexora\Database\Schema;
use Nexora\Modules\Settings\SettingsRepository;

/**
 * Class PortalService
 */
final class PortalService {

	/**
	 * Resolves user context for portal: roles, guardian info, student info, and accessible students.
	 *
	 * @param int $user_id WordPress User ID.
	 * @return array{
	 *     role: string,
	 *     user: array{id: int, name: string, email: string},
	 *     guardian: ?array{id: int, name: string},
	 *     student: ?array{id: int, name: string},
	 *     students: array<int, array{
	 *         id: int,
	 *         student_number: string,
	 *         admission_number: string,
	 *         first_name: string,
	 *         last_name: string,
	 *         full_name: string,
	 *         gender: string,
	 *         photo_url: string,
	 *         unit_name: string,
	 *         group_name: string,
	 *         roll_number: string
	 *     }>,
	 *     default_student_id: int
	 * }
	 */
	public function get_portal_user_context( int $user_id ): array {
		global $wpdb;

		$wp_user = get_userdata( $user_id );
		$is_admin = user_can( $user_id, 'manage_options' );

		// 1. Locate guardian record if any.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$guardian_row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . Schema::guardians() . ' WHERE user_id = %d AND deleted_at IS NULL LIMIT 1',
				$user_id
			),
			ARRAY_A
		);
		// phpcs:enable

		// 2. Locate student record if any.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$student_row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . Schema::students() . ' WHERE user_id = %d AND deleted_at IS NULL LIMIT 1',
				$user_id
			),
			ARRAY_A
		);
		// phpcs:enable

		// 3. Determine role.
		$user_roles = $wp_user ? (array) $wp_user->roles : [];
		if ( $is_admin ) {
			$role = 'admin';
		} elseif ( $guardian_row || in_array( 'nexora_guardian', $user_roles, true ) ) {
			$role = 'guardian';
		} elseif ( $student_row || in_array( 'nexora_student', $user_roles, true ) ) {
			$role = 'student';
		} else {
			$role = 'guest';
		}

		$students_rows = [];

		if ( 'guardian' === $role && $guardian_row ) {
			// Fetch all students linked to this guardian.
			$students_table  = Schema::students();
			$links_table     = Schema::student_guardians();
			$enroll_table    = Schema::enrollments();
			$units_table     = Schema::units();
			$groups_table    = Schema::groups();

			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$students_rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT s.id, s.student_number, s.admission_number, s.first_name, s.middle_name, s.last_name,
							s.gender, s.photo_id,
							u.name as unit_name, g.name as group_name, e.roll_number
					 FROM {$students_table} s
					 INNER JOIN {$links_table} sg ON sg.student_id = s.id
					 LEFT JOIN {$enroll_table} e ON e.student_id = s.id AND e.status = 'active'
					 LEFT JOIN {$units_table} u ON u.id = e.academic_unit_id
					 LEFT JOIN {$groups_table} g ON g.id = e.academic_group_id
					 WHERE sg.guardian_id = %d AND s.deleted_at IS NULL
					 ORDER BY sg.is_primary DESC, s.first_name ASC",
					(int) $guardian_row['id']
				),
				ARRAY_A
			) ?: [];
			// phpcs:enable
		} elseif ( 'student' === $role && $student_row ) {
			// Single student record for this student user.
			$students_table  = Schema::students();
			$enroll_table    = Schema::enrollments();
			$units_table     = Schema::units();
			$groups_table    = Schema::groups();

			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$students_rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT s.id, s.student_number, s.admission_number, s.first_name, s.middle_name, s.last_name,
							s.gender, s.photo_id,
							u.name as unit_name, g.name as group_name, e.roll_number
					 FROM {$students_table} s
					 LEFT JOIN {$enroll_table} e ON e.student_id = s.id AND e.status = 'active'
					 LEFT JOIN {$units_table} u ON u.id = e.academic_unit_id
					 LEFT JOIN {$groups_table} g ON g.id = e.academic_group_id
					 WHERE s.id = %d AND s.deleted_at IS NULL
					 LIMIT 1",
					(int) $student_row['id']
				),
				ARRAY_A
			) ?: [];
			// phpcs:enable
		} elseif ( 'admin' === $role ) {
			// For admin previews: return active students.
			$students_table  = Schema::students();
			$enroll_table    = Schema::enrollments();
			$units_table     = Schema::units();
			$groups_table    = Schema::groups();

			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$students_rows = $wpdb->get_results(
				"SELECT s.id, s.student_number, s.admission_number, s.first_name, s.middle_name, s.last_name,
						s.gender, s.photo_id,
						u.name as unit_name, g.name as group_name, e.roll_number
				 FROM {$students_table} s
				 LEFT JOIN {$enroll_table} e ON e.student_id = s.id AND e.status = 'active'
				 LEFT JOIN {$units_table} u ON u.id = e.academic_unit_id
				 LEFT JOIN {$groups_table} g ON g.id = e.academic_group_id
				 WHERE s.deleted_at IS NULL AND s.status = 'active'
				 ORDER BY s.first_name ASC
				 LIMIT 50",
				ARRAY_A
			) ?: [];
			// phpcs:enable
		}

		$formatted_students = [];
		foreach ( $students_rows as $st ) {
			$full_name = trim(
				(string) $st['first_name'] .
				( ! empty( $st['middle_name'] ) ? ' ' . $st['middle_name'] : '' ) .
				' ' . (string) $st['last_name']
			);
			$photo_url = ( ! empty( $st['photo_id'] ) ? wp_get_attachment_image_url( (int) $st['photo_id'], 'medium' ) : null ) ?: NEXORA_URL . 'assets/defaults/avatar.svg';

			$formatted_students[] = [
				'id'               => (int) $st['id'],
				'student_number'   => (string) ( $st['student_number'] ?? '' ),
				'admission_number' => (string) ( $st['admission_number'] ?? '' ),
				'first_name'       => (string) ( $st['first_name'] ?? '' ),
				'last_name'        => (string) ( $st['last_name'] ?? '' ),
				'full_name'        => $full_name,
				'gender'           => (string) ( $st['gender'] ?? '' ),
				'photo_url'        => $photo_url,
				'unit_name'        => (string) ( $st['unit_name'] ?? '' ),
				'group_name'       => (string) ( $st['group_name'] ?? '' ),
				'roll_number'      => (string) ( $st['roll_number'] ?? '' ),
			];
		}

		$default_student_id = ! empty( $formatted_students ) ? (int) $formatted_students[0]['id'] : 0;

		$guardian_data = $guardian_row
			? [
				'id'   => (int) $guardian_row['id'],
				'name' => trim( (string) $guardian_row['first_name'] . ' ' . (string) $guardian_row['last_name'] ),
			]
			: null;

		$student_data = $student_row
			? [
				'id'   => (int) $student_row['id'],
				'name' => trim( (string) $student_row['first_name'] . ' ' . (string) $student_row['last_name'] ),
			]
			: null;

		$settings_repo = new SettingsRepository();
		$settings      = $settings_repo->get_settings();

		return [
			'role'               => $role,
			'user'               => [
				'id'    => $user_id,
				'name'  => $wp_user ? (string) $wp_user->display_name : '',
				'email' => $wp_user ? (string) $wp_user->user_email : '',
			],
			'guardian'           => $guardian_data,
			'student'            => $student_data,
			'students'           => $formatted_students,
			'default_student_id' => $default_student_id,
			'settings'           => [
				'school'       => $settings['school'] ?? [],
				'appearance'   => $settings['appearance'] ?? [],
				'localization' => $settings['localization'] ?? [],
				'labels'       => $settings['labels'] ?? [],
			],
		];
	}

	/**
	 * Verifies whether a WordPress user is authorized to view/manage a specific student record.
	 *
	 * @param int $user_id    WordPress user ID.
	 * @param int $student_id Nexora student ID.
	 * @return bool True if authorized; false otherwise.
	 */
	public function verify_student_access( int $user_id, int $student_id ): bool {
		if ( $user_id <= 0 || $student_id <= 0 ) {
			return false;
		}

		// WP administrators have full access.
		if ( user_can( $user_id, 'manage_options' ) ) {
			return true;
		}

		global $wpdb;

		// 1. Check if student's own account.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$is_own_student = (bool) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM ' . Schema::students() . ' WHERE id = %d AND user_id = %d AND deleted_at IS NULL LIMIT 1',
				$student_id,
				$user_id
			)
		);
		// phpcs:enable
		if ( $is_own_student ) {
			return true;
		}

		// 2. Check if linked via guardian record.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$guardian_id = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM ' . Schema::guardians() . ' WHERE user_id = %d AND deleted_at IS NULL LIMIT 1',
				$user_id
			)
		);
		// phpcs:enable
		if ( $guardian_id ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$is_linked = (bool) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT id FROM ' . Schema::student_guardians() . ' WHERE student_id = %d AND guardian_id = %d LIMIT 1',
					$student_id,
					(int) $guardian_id
				)
			);
			// phpcs:enable
			if ( $is_linked ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Resolves the active academic term ID for a given session and date.
	 *
	 * @param int         $session_id Academic session ID.
	 * @param string|null $date       Date formatted as Y-m-d (defaults to current date).
	 * @return int Term ID or 0 if none found.
	 */
	private function get_active_term_id( int $session_id, ?string $date = null ): int {
		global $wpdb;

		if ( $session_id <= 0 ) {
			return 0;
		}

		$date        = $date ?: current_time( 'Y-m-d' );
		$terms_table = Schema::terms();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$terms_table}
				 WHERE academic_session_id = %d AND status != 'archived'
				 ORDER BY
				   (CASE
				     WHEN starts_on <= %s AND ends_on >= %s THEN 0
				     WHEN starts_on <= %s THEN 1
				     ELSE 2
				   END) ASC,
				   (CASE WHEN starts_on <= %s THEN ends_on END) DESC,
				   sort_order ASC,
				   starts_on ASC
				 LIMIT 1",
				$session_id,
				$date,
				$date,
				$date,
				$date
			)
		);
		// phpcs:enable
	}

	/**
	 * Gets dashboard summary metrics for a student: attendance, finance, today's timetable, and recent notifications.
	 *
	 * @param int $student_id Student ID.
	 * @param int $user_id    WordPress User ID for notifications (optional).
	 * @return array<string, mixed>
	 */
	public function get_dashboard_summary( int $student_id, int $user_id = 0 ): array {
		global $wpdb;

		// ─── 1. Attendance Summary (current month) ───────────────────────────
		$start_date = gmdate( 'Y-m-01' );
		$end_date   = gmdate( 'Y-m-t' );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$att_counts = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT status, COUNT(*) as count FROM ' . Schema::attendance() . '
				 WHERE student_id = %d AND attendance_date BETWEEN %s AND %s AND deleted_at IS NULL
				 GROUP BY status',
				$student_id,
				$start_date,
				$end_date
			),
			ARRAY_A
		) ?: [];
		// phpcs:enable

		$present_days = 0;
		$absent_days  = 0;
		$late_days    = 0;
		$half_day     = 0;
		$total_days   = 0;

		foreach ( $att_counts as $row ) {
			$c = (int) $row['count'];
			$total_days += $c;
			$st = strtolower( (string) $row['status'] );
			if ( 'present' === $st ) {
				$present_days += $c;
			} elseif ( 'absent' === $st ) {
				$absent_days += $c;
			} elseif ( 'late' === $st ) {
				$late_days += $c;
			} elseif ( 'half_day' === $st ) {
				$half_day += $c;
			}
		}

		$att_percentage = $total_days > 0
			? round( ( ( $present_days + $late_days + ( $half_day * 0.5 ) ) / $total_days ) * 100, 1 )
			: 100.0;

		// ─── 2. Finance Summary ──────────────────────────────────────────────
		$settings = ( new SettingsRepository() )->get_settings();
		$currency = $settings['localization']['currency'] ?? 'USD';

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$inv_rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT total_minor, paid_minor, balance_minor, due_date, status FROM ' . Schema::invoices() . "
				 WHERE student_id = %d AND status != 'cancelled' AND deleted_at IS NULL",
				$student_id
			),
			ARRAY_A
		) ?: [];
		// phpcs:enable

		$total_invoiced_minor = 0;
		$total_paid_minor     = 0;
		$balance_minor        = 0;
		$overdue_minor        = 0;
		$today                = gmdate( 'Y-m-d' );
		$next_due_date   = null;
		$next_due_amount = null;

		foreach ( $inv_rows as $inv ) {
			$bal = (int) $inv['balance_minor'];
			$total_invoiced_minor += (int) $inv['total_minor'];
			$total_paid_minor     += (int) $inv['paid_minor'];
			$balance_minor        += $bal;

			if ( 'overdue' === $inv['status'] || ( 'paid' !== $inv['status'] && ! empty( $inv['due_date'] ) && $inv['due_date'] < $today ) ) {
				$overdue_minor += $bal;
			}

			if ( $bal > 0 && ! empty( $inv['due_date'] ) ) {
				if ( null === $next_due_date || $inv['due_date'] < $next_due_date ) {
					$next_due_date   = (string) $inv['due_date'];
					$next_due_amount = round( $bal / 100, 2 );
				}
			}
		}

		// ─── 3. Today Timetable ──────────────────────────────────────────────
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$enrollment = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT academic_session_id, academic_unit_id, academic_group_id FROM " . Schema::enrollments() . "
				 WHERE student_id = %d AND status = 'active'
				 ORDER BY id DESC LIMIT 1",
				$student_id
			),
			ARRAY_A
		);
		// phpcs:enable

		$today_timetable = [];
		if ( $enrollment ) {
			$today_date  = current_time( 'Y-m-d' );
			$day_of_week = (int) current_time( 'N' ); // 1 (Mon) through 7 (Sun)
			$group_id    = (int) ( $enrollment['academic_group_id'] ?? 0 );
			$unit_id     = (int) ( $enrollment['academic_unit_id'] ?? 0 );
			$session_id  = (int) ( $enrollment['academic_session_id'] ?? 0 );
			$term_id     = $this->get_active_term_id( $session_id, $today_date );

			$slots_table   = Schema::timetable_slots();
			$periods_table = Schema::timetable_periods();
			$subj_table    = Schema::subjects();
			$staff_table   = Schema::staff_members();

			$where_clause = $group_id > 0 ? 'ts.academic_group_id = %d' : 'ts.academic_unit_id = %d';
			$where_params = [ $group_id > 0 ? $group_id : $unit_id ];

			if ( $session_id > 0 ) {
				$where_clause  .= ' AND ts.academic_session_id = %d';
				$where_params[] = $session_id;
			}

			if ( $term_id > 0 ) {
				$where_clause  .= ' AND ts.academic_term_id = %d';
				$where_params[] = $term_id;
			}

			$where_clause  .= ' AND ts.day_of_week = %d';
			$where_params[] = $day_of_week;

			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$slots = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT p.name as period_name, p.start_time, p.end_time,
							sub.name as subject_name,
							CONCAT(st.first_name, ' ', st.last_name) as teacher_name,
							ts.notes as room
					 FROM {$slots_table} ts
					 INNER JOIN {$periods_table} p ON p.id = ts.period_id
					 LEFT JOIN {$subj_table} sub ON sub.id = ts.subject_id
					 LEFT JOIN {$staff_table} st ON st.id = ts.staff_member_id
					 WHERE {$where_clause}
					 ORDER BY p.sort_order ASC, p.start_time ASC",
					...$where_params
				),
				ARRAY_A
			) ?: [];
			// phpcs:enable

			foreach ( $slots as $s ) {
				$today_timetable[] = [
					'period_name'  => (string) $s['period_name'],
					'start_time'   => (string) $s['start_time'],
					'end_time'     => (string) $s['end_time'],
					'subject_name' => (string) ( $s['subject_name'] ?? __( 'Activity', 'nexora-school-management' ) ),
					'teacher_name' => trim( (string) ( $s['teacher_name'] ?? '' ) ),
					'room'         => trim( (string) ( $s['room'] ?? '' ) ),
				];
			}
		}

		// ─── 4. Recent Notifications (Pro only) ──────────────────────────────
		$recent_notifications = [];
		if ( defined( 'NEXORA_IS_PRO' ) && NEXORA_IS_PRO ) {
			$table_notifs = Schema::notifications();
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$notifs       = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT id, title, content, event_type, is_read, url, created_at, read_at
					 FROM {$table_notifs}
					 WHERE audience IN ('portal', 'all') AND (student_id = %d OR student_id IS NULL)
					 ORDER BY created_at DESC LIMIT 5",
					$student_id
				),
				ARRAY_A
			) ?: [];
			// phpcs:enable

			foreach ( $notifs as $n ) {
				$recent_notifications[] = [
					'id'         => (int) $n['id'],
					'title'      => (string) $n['title'],
					'content'    => (string) $n['content'],
					'event_type' => (string) $n['event_type'],
					'is_read'    => (bool) $n['is_read'],
					'url'        => $n['url'] ? (string) $n['url'] : null,
					'created_at' => (string) $n['created_at'],
					'read_at'    => $n['read_at'] ? (string) $n['read_at'] : null,
				];
			}
		}

		// ─── 5. Calendar Events ──────────────────────────────────────────────
		$calendar_events = [];

		// (a) Upcoming invoice due dates
		$invoices_table = Schema::invoices();
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$inv_events     = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, invoice_number, due_date, balance_minor FROM {$invoices_table}
				 WHERE student_id = %d AND due_date >= CURDATE() AND status != 'paid' AND deleted_at IS NULL
				 ORDER BY due_date ASC LIMIT 10",
				$student_id
			),
			ARRAY_A
		) ?: [];
		// phpcs:enable

		foreach ( $inv_events as $inv ) {
			$bal = round( (int) ( $inv['balance_minor'] ?? 0 ) / 100, 2 );
			$calendar_events[] = [
				'id'          => 'inv-' . (int) $inv['id'],
				'title'       => sprintf(
					/* translators: %s: invoice number */
					__( 'Invoice %s Due', 'nexora-school-management' ),
					(string) $inv['invoice_number']
				),
				'date'        => (string) $inv['due_date'],
				'type'        => 'deadline',
				'category'    => 'finance',
				'url'         => '/finance',
				'amount'      => $bal,
				'currency'    => $currency,
				'description' => sprintf(
					/* translators: 1: currency symbol/code, 2: balance amount */
					__( 'Payment due: %1$s %2$s', 'nexora-school-management' ),
					$currency,
					number_format( $bal, 2 )
				),
			];
		}

		// (b) Active term start/end milestones
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Custom database table query.
		$current_session_id = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM %i WHERE is_current = %d LIMIT 1',
				Schema::sessions(),
				1
			)
		);
		$session_id = (int) ( $enrollment['academic_session_id'] ?? $current_session_id );

		if ( $session_id > 0 ) {
			$terms_table = Schema::terms();
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$term_rows   = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT id, name, starts_on, ends_on FROM {$terms_table}
					 WHERE academic_session_id = %d AND status != 'archived'
					 ORDER BY starts_on ASC",
					$session_id
				),
				ARRAY_A
			) ?: [];
			// phpcs:enable

			foreach ( $term_rows as $term ) {
				$term_name = (string) $term['name'];
				if ( ! empty( $term['starts_on'] ) ) {
					$calendar_events[] = [
						'id'          => 'term-start-' . (int) $term['id'],
						'title'       => sprintf(
							/* translators: %s: term name */
							__( '%s Begins', 'nexora-school-management' ),
							$term_name
						),
						'date'        => (string) $term['starts_on'],
						'type'        => 'event',
						'category'    => 'academic',
						'url'         => '/academics',
						'description' => sprintf(
							/* translators: %s: term name */
							__( 'Start of academic term: %s', 'nexora-school-management' ),
							$term_name
						),
					];
				}
				if ( ! empty( $term['ends_on'] ) ) {
					$calendar_events[] = [
						'id'          => 'term-end-' . (int) $term['id'],
						'title'       => sprintf(
							/* translators: %s: term name */
							__( '%s Ends', 'nexora-school-management' ),
							$term_name
						),
						'date'        => (string) $term['ends_on'],
						'type'        => 'deadline',
						'category'    => 'academic',
						'url'         => '/academics',
						'description' => sprintf(
							/* translators: %s: term name */
							__( 'Conclusion of academic term: %s', 'nexora-school-management' ),
							$term_name
						),
					];
				}
			}
		}

		// Chronological sort
		usort( $calendar_events, function( $a, $b ) {
			return strcmp( (string) $a['date'], (string) $b['date'] );
		} );

		return [
			'attendance'           => [
				'percentage'   => $att_percentage,
				'present_days' => $present_days,
				'absent_days'  => $absent_days,
				'late_days'    => $late_days,
				'total_days'   => $total_days,
			],
			'finance'              => [
				'total_invoiced'  => round( $total_invoiced_minor / 100, 2 ),
				'total_paid'      => round( $total_paid_minor / 100, 2 ),
				'balance'         => round( $balance_minor / 100, 2 ),
				'overdue'         => round( $overdue_minor / 100, 2 ),
				'next_due_date'   => $next_due_date,
				'next_due_amount' => $next_due_amount,
				'currency'        => $currency,
			],
			'today_timetable'      => $today_timetable,
			'recent_notifications' => $recent_notifications,
			'calendar_events'      => $calendar_events,
			'academic'             => $this->get_academics( $student_id ),
		];
	}

	/**
	 * Gets monthly attendance records and statistics for a student.
	 *
	 * @param int    $student_id Student ID.
	 * @param string $month      Year and month in 'YYYY-MM' format.
	 * @return array<string, mixed>
	 */
	public function get_attendance( int $student_id, string $month = '' ): array {
		global $wpdb;

		if ( empty( $month ) || ! preg_match( '/^\d{4}-\d{2}$/', $month ) ) {
			$month = gmdate( 'Y-m' );
		}

		$start_date = "{$month}-01";
		$end_date   = gmdate( 'Y-m-t', strtotime( $start_date ) );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$records = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT attendance_date, status, note
				 FROM ' . Schema::attendance() . '
				 WHERE student_id = %d AND attendance_date BETWEEN %s AND %s AND deleted_at IS NULL
				 ORDER BY attendance_date ASC',
				$student_id,
				$start_date,
				$end_date
			),
			ARRAY_A
		) ?: [];
		// phpcs:enable

		$present  = 0;
		$absent   = 0;
		$late     = 0;
		$half_day = 0;
		$total    = count( $records );

		$formatted_records = [];
		foreach ( $records as $r ) {
			$st = strtolower( (string) $r['status'] );
			if ( 'present' === $st ) {
				$present++;
			} elseif ( 'absent' === $st ) {
				$absent++;
			} elseif ( 'late' === $st ) {
				$late++;
			} elseif ( 'half_day' === $st ) {
				$half_day++;
			}

			$formatted_records[] = [
				'attendance_date' => (string) $r['attendance_date'],
				'status'          => (string) $r['status'],
				'note'            => (string) ( $r['note'] ?? '' ),
			];
		}

		$percentage = $total > 0
			? round( ( ( $present + $late + ( $half_day * 0.5 ) ) / $total ) * 100, 1 )
			: 0.0;

		return [
			'month'   => $month,
			'summary' => [
				'percentage' => $percentage,
				'total'      => $total,
				'present'    => $present,
				'absent'     => $absent,
				'late'       => $late,
				'half_day'   => $half_day,
			],
			'records' => $formatted_records,
		];
	}

	/**
	 * Gets finance summary and invoice history for a student.
	 *
	 * @param int $student_id Student ID.
	 * @return array<string, mixed>
	 */
	public function get_finance( int $student_id ): array {
		global $wpdb;

		$settings = ( new SettingsRepository() )->get_settings();
		$currency = $settings['localization']['currency'] ?? 'USD';

		$invoices_table = Schema::invoices();
		$items_table    = Schema::line_items();
		$payments_table = Schema::payments();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$invoices = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, invoice_number, issue_date, due_date, currency,
						total_minor, paid_minor, balance_minor, status
				 FROM {$invoices_table}
				 WHERE student_id = %d AND deleted_at IS NULL
				 ORDER BY issue_date DESC, id DESC",
				$student_id
			),
			ARRAY_A
		) ?: [];
		// phpcs:enable

		$total_invoiced_minor = 0;
		$total_paid_minor     = 0;
		$balance_minor        = 0;
		$overdue_minor        = 0;
		$today                = gmdate( 'Y-m-d' );

		$invoice_ids = array_map( static fn( $inv ) => (int) $inv['id'], $invoices );
		$all_items    = [];
		$all_payments = [];

		if ( ! empty( $invoice_ids ) ) {
			$placeholders = implode( ',', array_fill( 0, count( $invoice_ids ), '%d' ) );

			// Fetch line items
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$items_rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT id, invoice_id, description, quantity, unit_amount_minor, total_minor
					 FROM {$items_table}
					 WHERE invoice_id IN ({$placeholders})
					 ORDER BY sort_order ASC, id ASC",
					...$invoice_ids
				),
				ARRAY_A
			) ?: [];
			// phpcs:enable
			foreach ( $items_rows as $it ) {
				$all_items[ (int) $it['invoice_id'] ][] = [
					'id'                => (int) $it['id'],
					'description'       => (string) $it['description'],
					'quantity'          => (float) $it['quantity'],
					'amount'            => round( (int) $it['total_minor'] / 100, 2 ),
					'total_minor'       => (int) $it['total_minor'],
					'unit_amount_minor' => (int) $it['unit_amount_minor'],
				];
			}
			// Fetch payments
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$pay_rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT id, invoice_id, payment_number, amount_minor, method, status, paid_on
					 FROM {$payments_table}
					 WHERE invoice_id IN ({$placeholders}) AND deleted_at IS NULL
					 ORDER BY paid_on DESC, id DESC",
					...$invoice_ids
				),
				ARRAY_A
			) ?: [];
			// phpcs:enable
			foreach ( $pay_rows as $p ) {
				$all_payments[ (int) $p['invoice_id'] ][] = [
					'id'             => (int) $p['id'],
					'payment_number' => (string) $p['payment_number'],
					'amount'         => round( (int) $p['amount_minor'] / 100, 2 ),
					'amount_minor'   => (int) $p['amount_minor'],
					'method'         => (string) $p['method'],
					'status'         => (string) $p['status'],
					'paid_on'        => (string) $p['paid_on'],
				];
		}
		}

		$formatted_invoices = [];
		foreach ( $invoices as $inv ) {
			$inv_id        = (int) $inv['id'];
			$total_m       = (int) $inv['total_minor'];
			$paid_m        = (int) $inv['paid_minor'];
			$bal_m         = (int) $inv['balance_minor'];
			$status        = (string) $inv['status'];
			$due_date      = (string) ( $inv['due_date'] ?? '' );

			if ( 'cancelled' !== $status ) {
				$total_invoiced_minor += $total_m;
				$total_paid_minor     += $paid_m;
				$balance_minor        += $bal_m;
				if ( 'overdue' === $status || ( 'paid' !== $status && ! empty( $due_date ) && $due_date < $today ) ) {
					$overdue_minor += $bal_m;
				}
			}

			$formatted_invoices[] = [
				'id'             => $inv_id,
				'invoice_number' => (string) $inv['invoice_number'],
				'issue_date'     => (string) $inv['issue_date'],
				'due_date'       => $due_date,
				'total'          => round( $total_m / 100, 2 ),
				'paid'           => round( $paid_m / 100, 2 ),
				'balance'        => round( $bal_m / 100, 2 ),
				'total_minor'    => $total_m,
				'paid_minor'     => $paid_m,
				'balance_minor'  => $bal_m,
				'status'         => $status,
				'currency'       => (string) ( $inv['currency'] ?: $currency ),
				'line_items'     => $all_items[ $inv_id ] ?? [],
				'payments'       => $all_payments[ $inv_id ] ?? [],
			];
		}
		return [
			'summary'  => [
				'total_invoiced' => round( $total_invoiced_minor / 100, 2 ),
				'total_paid'     => round( $total_paid_minor / 100, 2 ),
				'balance'        => round( $balance_minor / 100, 2 ),
				'overdue'        => round( $overdue_minor / 100, 2 ),
				'currency'       => $currency,
			],
			'invoices' => $formatted_invoices,
		];
	}

	/**
	 * Gets weekly timetable for a student grouped by day of week (1 = Monday, 7 = Sunday).
	 *
	 * @param int $student_id Student ID.
	 * @return array<string, mixed>
	 */
	public function get_timetable( int $student_id ): array {
		global $wpdb;

		$enroll_table = Schema::enrollments();
		$units_table  = Schema::units();
		$groups_table = Schema::groups();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$enrollment = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT e.academic_session_id, e.academic_unit_id, e.academic_group_id, u.name as unit_name, g.name as group_name
				 FROM {$enroll_table} e
				 LEFT JOIN {$units_table} u ON u.id = e.academic_unit_id
				 LEFT JOIN {$groups_table} g ON g.id = e.academic_group_id
				 WHERE e.student_id = %d AND e.status = 'active'
				 ORDER BY e.id DESC LIMIT 1",
				$student_id
			),
			ARRAY_A
		);
		// phpcs:enable

		$days = [
			1 => [],
			2 => [],
			3 => [],
			4 => [],
			5 => [],
			6 => [],
			7 => [],
		];

		if ( $enrollment ) {
			$group_id   = (int) ( $enrollment['academic_group_id'] ?? 0 );
			$unit_id    = (int) ( $enrollment['academic_unit_id'] ?? 0 );
			$session_id = (int) ( $enrollment['academic_session_id'] ?? 0 );

			$term_id    = $session_id > 0 ? $this->get_active_term_id( $session_id ) : 0;

			$slots_table   = Schema::timetable_slots();
			$periods_table = Schema::timetable_periods();
			$subj_table    = Schema::subjects();
			$staff_table   = Schema::staff_members();

			$where_clause = $group_id > 0 ? 'ts.academic_group_id = %d' : 'ts.academic_unit_id = %d';
			$where_params = [ $group_id > 0 ? $group_id : $unit_id ];

			if ( $session_id > 0 ) {
				$where_clause  .= ' AND ts.academic_session_id = %d';
				$where_params[] = $session_id;
			}

			if ( $term_id > 0 ) {
				$where_clause  .= ' AND ts.academic_term_id = %d';
				$where_params[] = $term_id;
			}

			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$slots = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT ts.id, ts.period_id, ts.day_of_week,
							p.name as period_name, p.start_time, p.end_time,
							sub.name as subject_name, sub.code as subject_code,
							CONCAT(st.first_name, ' ', st.last_name) as staff_name,
							ts.notes as room
					 FROM {$slots_table} ts
					 INNER JOIN {$periods_table} p ON p.id = ts.period_id
					 LEFT JOIN {$subj_table} sub ON sub.id = ts.subject_id
					 LEFT JOIN {$staff_table} st ON st.id = ts.staff_member_id
					 WHERE {$where_clause}
					 ORDER BY ts.day_of_week ASC, p.sort_order ASC, p.start_time ASC",
					...$where_params
				),
				ARRAY_A
			) ?: [];
			// phpcs:enable

			foreach ( $slots as $slot ) {
				$d = (int) $slot['day_of_week'];
				if ( isset( $days[ $d ] ) ) {
					$days[ $d ][] = [
						'id'           => (int) $slot['id'],
						'period_id'    => (int) $slot['period_id'],
						'period_name'  => (string) $slot['period_name'],
						'start_time'   => (string) $slot['start_time'],
						'end_time'     => (string) $slot['end_time'],
						'subject_name' => (string) ( $slot['subject_name'] ?? __( 'Break / Free', 'nexora-school-management' ) ),
						'subject_code' => (string) ( $slot['subject_code'] ?? '' ),
						'staff_name'   => trim( (string) ( $slot['staff_name'] ?? '' ) ),
						'room'         => trim( (string) ( $slot['room'] ?? '' ) ),
					];
				}
			}
		}

		return [
			'enrollment' => [
				'unit_name'  => (string) ( $enrollment['unit_name'] ?? '' ),
				'group_name' => (string) ( $enrollment['group_name'] ?? '' ),
			],
			'days'       => $days,
		];
	}

	/**
	 * Gets academic details and subject enrollment for a student.
	 *
	 * @param int $student_id Student ID.
	 * @return array<string, mixed>
	 */
	public function get_academics( int $student_id ): array {
		global $wpdb;

		$enroll_table   = Schema::enrollments();
		$sessions_table = Schema::sessions();
		$units_table    = Schema::units();
		$groups_table   = Schema::groups();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$enrollment = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT e.roll_number, e.starts_on, e.academic_unit_id,
						s.name as session_name, u.name as unit_name, g.name as group_name
				 FROM {$enroll_table} e
				 LEFT JOIN {$sessions_table} s ON s.id = e.academic_session_id
				 LEFT JOIN {$units_table} u ON u.id = e.academic_unit_id
				 LEFT JOIN {$groups_table} g ON g.id = e.academic_group_id
				 WHERE e.student_id = %d AND e.status = 'active'
				 ORDER BY e.id DESC LIMIT 1",
				$student_id
			),
			ARRAY_A
		);
		// phpcs:enable

		$subjects_table    = Schema::subjects();
		$student_sub_table = Schema::student_subjects();
		$unit_sub_table    = Schema::unit_subjects();

		// 1. Check direct student-subject assignments
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$subjects = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT s.id, s.name, s.code, s.type
				 FROM {$student_sub_table} ss
				 INNER JOIN {$subjects_table} s ON s.id = ss.subject_id
				 WHERE ss.student_id = %d AND s.status = 'active'
				 ORDER BY s.name ASC",
				$student_id
			),
			ARRAY_A
		) ?: [];
		// phpcs:enable

		// 2. If no direct assignments, fallback to the unit's curriculum
		if ( empty( $subjects ) && ! empty( $enrollment['academic_unit_id'] ) ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$subjects = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT s.id, s.name, s.code, s.type
					 FROM {$unit_sub_table} us
					 INNER JOIN {$subjects_table} s ON s.id = us.subject_id
					 WHERE us.academic_unit_id = %d AND s.status = 'active'
					 ORDER BY us.sort_order ASC, s.name ASC",
					(int) $enrollment['academic_unit_id']
				),
				ARRAY_A
			) ?: [];
			// phpcs:enable
		}

		$formatted_subjects = [];
		foreach ( $subjects as $sub ) {
			$formatted_subjects[] = [
				'id'   => (int) $sub['id'],
				'name' => (string) $sub['name'],
				'code' => (string) ( $sub['code'] ?? '' ),
				'type' => (string) ( $sub['type'] ?? 'core' ),
			];
		}

		return [
			'enrollment' => [
				'session_name' => (string) ( $enrollment['session_name'] ?? '' ),
				'unit_name'    => (string) ( $enrollment['unit_name'] ?? '' ),
				'group_name'   => (string) ( $enrollment['group_name'] ?? '' ),
				'roll_number'  => (string) ( $enrollment['roll_number'] ?? '' ),
				'starts_on'    => (string) ( $enrollment['starts_on'] ?? '' ),
			],
			'subjects'   => $formatted_subjects,
		];
	}

	/**
	 * Gets admission and application documents submitted for a student.
	 *
	 * @param int $student_id Student ID.
	 * @return array<string, mixed>
	 */
	public function get_documents( int $student_id ): array {
		global $wpdb;

		$docs_table = Schema::app_documents();
		$apps_table = Schema::applications();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$docs = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT d.id, d.document_type, d.label, d.attachment_id, d.status, d.created_at
				 FROM {$docs_table} d
				 INNER JOIN {$apps_table} a ON a.id = d.application_id
				 WHERE a.converted_student_id = %d AND a.deleted_at IS NULL
				 ORDER BY d.id DESC",
				$student_id
			),
			ARRAY_A
		) ?: [];
		// phpcs:enable

		$formatted_docs = [];
		foreach ( $docs as $d ) {
			$att_id   = ! empty( $d['attachment_id'] ) ? (int) $d['attachment_id'] : 0;
			$file_url = '';
			$file_name = (string) $d['label'];
			$file_size = null;

			if ( $att_id > 0 ) {
				$file_url      = wp_get_attachment_url( $att_id ) ?: '';
				$attached_file = get_attached_file( $att_id );
				if ( $attached_file && file_exists( $attached_file ) ) {
					$file_name = basename( $attached_file );
					$file_size = (int) filesize( $attached_file );
				}
			}

			$formatted_docs[] = [
				'id'            => (int) $d['id'],
				'document_type' => (string) $d['document_type'],
				'file_name'     => $file_name,
				'file_url'      => $file_url,
				'file_size'     => $file_size,
				'status'        => (string) $d['status'],
				'created_at'    => (string) $d['created_at'],
			];
		}

		return [
			'documents' => $formatted_docs,
		];
	}

	/**
	 * Gets complete student profile details along with emergency contact and linked guardians.
	 *
	 * @param int $student_id Student ID.
	 * @return array<string, mixed>
	 */
	public function get_profile( int $student_id ): array {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$student = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . Schema::students() . ' WHERE id = %d AND deleted_at IS NULL LIMIT 1',
				$student_id
			),
			ARRAY_A
		);
		// phpcs:enable

		if ( ! $student ) {
			return [
				'student'           => null,
				'guardians'         => [],
				'emergency_contact' => null,
			];
		}

		// Active enrollment
		$enroll_table   = Schema::enrollments();
		$sessions_table = Schema::sessions();
		$units_table    = Schema::units();
		$groups_table   = Schema::groups();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$enrollment = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT e.roll_number, u.name as unit_name, g.name as group_name, s.name as session_name
				 FROM {$enroll_table} e
				 LEFT JOIN {$sessions_table} s ON s.id = e.academic_session_id
				 LEFT JOIN {$units_table} u ON u.id = e.academic_unit_id
				 LEFT JOIN {$groups_table} g ON g.id = e.academic_group_id
				 WHERE e.student_id = %d AND e.status = 'active'
				 ORDER BY e.id DESC LIMIT 1",
				$student_id
			),
			ARRAY_A
		);
		// phpcs:enable

		// Linked guardians
		$guardians_table = Schema::guardians();
		$links_table     = Schema::student_guardians();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$guardian_rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT g.id, g.first_name, g.middle_name, g.last_name, g.email, g.phone, g.alternate_phone,
						g.occupation, g.address_json,
						sg.relationship, sg.is_primary, sg.is_billing_contact, sg.is_emergency_contact
				 FROM {$guardians_table} g
				 INNER JOIN {$links_table} sg ON sg.guardian_id = g.id
				 WHERE sg.student_id = %d AND g.deleted_at IS NULL
				 ORDER BY sg.is_primary DESC, sg.is_emergency_contact DESC, g.id ASC",
				$student_id
			),
			ARRAY_A
		) ?: [];
		// phpcs:enable

		$formatted_guardians = [];
		$emergency_contact   = null;

		foreach ( $guardian_rows as $g ) {
			$g_full_name = trim(
				(string) $g['first_name'] .
				( ! empty( $g['middle_name'] ) ? ' ' . $g['middle_name'] : '' ) .
				' ' . (string) $g['last_name']
			);

			$addr = null;
			if ( ! empty( $g['address_json'] ) ) {
				$addr = json_decode( (string) $g['address_json'], true );
			}

			$g_data = [
				'id'                   => (int) $g['id'],
				'first_name'           => (string) $g['first_name'],
				'last_name'            => (string) $g['last_name'],
				'full_name'            => $g_full_name,
				'relationship'         => (string) $g['relationship'],
				'phone'                => (string) ( $g['phone'] ?? '' ),
				'email'                => (string) ( $g['email'] ?? '' ),
				'alternate_phone'      => (string) ( $g['alternate_phone'] ?? '' ),
				'occupation'           => (string) ( $g['occupation'] ?? '' ),
				'address'              => $addr,
				'is_primary'           => (bool) $g['is_primary'],
				'is_billing_contact'   => (bool) $g['is_billing_contact'],
				'is_emergency_contact' => (bool) $g['is_emergency_contact'],
			];

			$formatted_guardians[] = $g_data;

			if ( ! $emergency_contact && (bool) $g['is_emergency_contact'] ) {
				$emergency_contact = $g_data;
			}
		}

		if ( ! $emergency_contact && ! empty( $formatted_guardians ) ) {
			$emergency_contact = $formatted_guardians[0];
		}

		$photo_url = ( ! empty( $student['photo_id'] ) ? wp_get_attachment_image_url( (int) $student['photo_id'], 'medium' ) : null ) ?: NEXORA_URL . 'assets/defaults/avatar.svg';

		$st_addr = null;
		if ( ! empty( $student['address_json'] ) ) {
			$st_addr = json_decode( (string) $student['address_json'], true );
		}

		$full_name = trim(
			(string) $student['first_name'] .
			( ! empty( $student['middle_name'] ) ? ' ' . $student['middle_name'] : '' ) .
			' ' . (string) $student['last_name']
		);

		$formatted_student = [
			'id'               => (int) $student['id'],
			'student_number'   => (string) ( $student['student_number'] ?? '' ),
			'admission_number' => (string) ( $student['admission_number'] ?? '' ),
			'first_name'       => (string) $student['first_name'],
			'middle_name'      => (string) ( $student['middle_name'] ?? '' ),
			'last_name'        => (string) $student['last_name'],
			'full_name'        => $full_name,
			'preferred_name'   => (string) ( $student['preferred_name'] ?? '' ),
			'date_of_birth'    => (string) ( $student['date_of_birth'] ?? '' ),
			'gender'           => (string) ( $student['gender'] ?? '' ),
			'email'            => (string) ( $student['email'] ?? '' ),
			'phone'            => (string) ( $student['phone'] ?? '' ),
			'status'           => (string) $student['status'],
			'admission_date'   => (string) ( $student['admission_date'] ?? '' ),
			'address'          => $st_addr,
			'photo_url'        => $photo_url,
			'unit_name'        => (string) ( $enrollment['unit_name'] ?? '' ),
			'group_name'       => (string) ( $enrollment['group_name'] ?? '' ),
			'roll_number'      => (string) ( $enrollment['roll_number'] ?? '' ),
			'session_name'     => (string) ( $enrollment['session_name'] ?? '' ),
			'enrollment'       => [
				'unit_name'    => (string) ( $enrollment['unit_name'] ?? '' ),
				'group_name'   => (string) ( $enrollment['group_name'] ?? '' ),
				'roll_number'  => (string) ( $enrollment['roll_number'] ?? '' ),
				'session_name' => (string) ( $enrollment['session_name'] ?? '' ),
			],
		];
		return [
			'student'           => $formatted_student,
			'guardians'         => $formatted_guardians,
			'emergency_contact' => $emergency_contact,
		];
	}

	/**
	 * Updates allowed editable student contact details (phone, email, address).
	 *
	 * @param int                  $user_id    Current WP user ID.
	 * @param int                  $student_id Target student ID.
	 * @param array<string, mixed> $payload    Fields to update.
	 * @return array<string, mixed>|\WP_Error
	 */
	public function update_profile( int $user_id, int $student_id, array $payload ): array|\WP_Error {
		global $wpdb;

		if ( ! $this->verify_student_access( $user_id, $student_id ) ) {
			return new \WP_Error( 'nexora_forbidden', __( 'You do not have permission to edit this profile.', 'nexora-school-management' ), [ 'status' => 403 ] );
		}

		$update_data = [];

		if ( array_key_exists( 'phone', $payload ) ) {
			$update_data['phone'] = sanitize_text_field( (string) $payload['phone'] );
		}

		if ( array_key_exists( 'email', $payload ) ) {
			$email = sanitize_email( (string) $payload['email'] );
			if ( ! empty( $payload['email'] ) && ! is_email( $email ) ) {
				return new \WP_Error( 'nexora_invalid_email', __( 'Please provide a valid email address.', 'nexora-school-management' ), [ 'status' => 400 ] );
			}
			$update_data['email'] = $email;
		}

		if ( array_key_exists( 'address', $payload ) ) {
			$addr = $payload['address'];
			if ( is_array( $addr ) ) {
				$clean_addr = [
					'address'     => sanitize_text_field( $addr['address'] ?? $addr['address_line1'] ?? '' ),
					'city'        => sanitize_text_field( $addr['city'] ?? '' ),
					'state'       => sanitize_text_field( $addr['state'] ?? '' ),
					'postal_code' => sanitize_text_field( $addr['postal_code'] ?? $addr['zip'] ?? '' ),
					'country'     => sanitize_text_field( $addr['country'] ?? '' ),
				];
				$update_data['address_json'] = wp_json_encode( $clean_addr );
			} elseif ( is_string( $addr ) ) {
				$clean_addr                  = [ 'address' => sanitize_textarea_field( $addr ) ];
				$update_data['address_json'] = wp_json_encode( $clean_addr );
			}
		}

		if ( ! empty( $update_data ) ) {
			$update_data['updated_at'] = current_time( 'mysql', true );
			// phpcs:disable WordPress.DB.DirectDatabaseQuery
			$wpdb->update(
				Schema::students(),
				$update_data,
				[ 'id' => $student_id ]
			);
			// phpcs:enable
		}

		return $this->get_profile( $student_id );
	}

	/**
	 * Gets paginated notifications and unread count for a student.
	 *
	 * @param int $student_id Student ID.
	 * @param int $page       Page number (1-based).
	 * @param int $per_page   Items per page.
	 * @return array{notifications: array, unread_count: int, total: int}
	 */
	public function get_notifications( int $student_id, int $page = 1, int $per_page = 20 ): array {
		if ( ! defined( 'NEXORA_IS_PRO' ) || ! NEXORA_IS_PRO ) {
			return [
				'notifications' => [],
				'unread_count'  => 0,
				'total'         => 0,
			];
		}
		global $wpdb;
		$table    = Schema::notifications();
		$page     = max( 1, $page );
		$per_page = min( 100, max( 1, $per_page ) );
		$offset   = ( $page - 1 ) * $per_page;
		// ponytail: wp_options array stores broadcast read IDs per student without a full pivot table.
		// Ceiling: ~1,000 read broadcast IDs per student.
		// Upgrade path: migrate to nexora_student_notifications junction table if school issues >1,000 broadcasts/year.
		$read_broadcast_ids = (array) get_option( "nexora_student_read_notifs_{$student_id}", [] );
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, student_id, title, content, event_type, is_read, url, created_at, read_at
				 FROM {$table}
				 WHERE audience IN ('portal', 'all') AND (student_id = %d OR student_id IS NULL)
				 ORDER BY created_at DESC
				 LIMIT %d OFFSET %d",
				$student_id,
				$per_page,
				$offset
			),
			ARRAY_A
		) ?: [];
		// phpcs:enable

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$all_notifs = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, student_id, is_read
				 FROM {$table}
				 WHERE audience IN ('portal', 'all') AND (student_id = %d OR student_id IS NULL)",
				$student_id
			),
			ARRAY_A
		) ?: [];
		// phpcs:enable

		$total        = count( $all_notifs );
		$unread_count = 0;
		foreach ( $all_notifs as $an ) {
			$nid     = (int) $an['id'];
			$is_read = $an['student_id'] !== null ? (bool) $an['is_read'] : in_array( $nid, $read_broadcast_ids, true );
			if ( ! $is_read ) {
				$unread_count++;
			}
		}

		$notifications = [];
		foreach ( $rows as $r ) {
			$nid     = (int) $r['id'];
			$is_read = $r['student_id'] !== null ? (bool) $r['is_read'] : in_array( $nid, $read_broadcast_ids, true );
			$notifications[] = [
				'id'         => $nid,
				'title'      => (string) $r['title'],
				'content'    => (string) $r['content'],
				'event_type' => (string) $r['event_type'],
				'is_read'    => $is_read,
				'url'        => $r['url'] ? (string) $r['url'] : null,
				'created_at' => (string) $r['created_at'],
				'read_at'    => $r['read_at'] ? (string) $r['read_at'] : null,
			];
		}

		return [
			'notifications' => $notifications,
			'unread_count'  => $unread_count,
			'total'         => $total,
		];
	}

	/**
	 * Marks one or all notifications as read for a student.
	 *
	 * @param int $student_id      Student ID.
	 * @param int $notification_id Optional specific notification ID. If 0, marks all.
	 * @return bool True on success.
	 */
	public function mark_notification_read( int $student_id, int $notification_id = 0 ): bool {
		if ( ! defined( 'NEXORA_IS_PRO' ) || ! NEXORA_IS_PRO ) {
			return true;
		}
		global $wpdb;
		$table              = Schema::notifications();
		$now                = current_time( 'mysql' );
		$read_broadcast_ids = (array) get_option( "nexora_student_read_notifs_{$student_id}", [] );

		if ( $notification_id > 0 ) {
			// Check if notification is direct or broadcast
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$notif = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT id, student_id FROM {$table} WHERE id = %d",
					$notification_id
				),
				ARRAY_A
			);
			// phpcs:enable
			if ( $notif ) {
				if ( null !== $notif['student_id'] && (int) $notif['student_id'] === $student_id ) {
					// Direct student notification
					// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
					$wpdb->query(
						$wpdb->prepare(
							"UPDATE {$table} SET is_read = 1, read_at = %s WHERE id = %d AND student_id = %d",
							$now,
							$notification_id,
							$student_id
						)
					);
					// phpcs:enable
				} elseif ( null === $notif['student_id'] ) {
					// Broadcast notification
					if ( ! in_array( $notification_id, $read_broadcast_ids, true ) ) {
						$read_broadcast_ids[] = $notification_id;
						update_option( "nexora_student_read_notifs_{$student_id}", array_values( array_unique( $read_broadcast_ids ) ), false );
					}
				}
			}
		} else {
			// Mark all direct notifications as read
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$table} SET is_read = 1, read_at = %s WHERE student_id = %d AND is_read = 0",
					$now,
					$student_id
				)
			);
			// phpcs:enable

			// Mark all broadcast notifications as read for this student
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$broadcasts = $wpdb->get_col( "SELECT id FROM {$table} WHERE student_id IS NULL AND audience IN ('portal', 'all')" );
			// phpcs:enable
			if ( ! empty( $broadcasts ) ) {
				$merged = array_unique( array_merge( $read_broadcast_ids, array_map( 'intval', $broadcasts ) ) );
				update_option( "nexora_student_read_notifs_{$student_id}", array_values( $merged ), false );
			}
		}

		return true;
	}
}
