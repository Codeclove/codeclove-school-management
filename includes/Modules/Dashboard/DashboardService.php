<?php
/**
 * Dashboard aggregation service.
 *
 * Assembles the stats payload for the dashboard endpoint.
 * Each bucket is permission-gated: if the user lacks the required
 * permission, that bucket is omitted entirely.
 *
 * Ranges are school-native:
 *   today   — calendar day (attendance-focused snapshot)
 *   term    — current academic term's start→end dates
 *   session — full academic session start→end dates
 *   30days  — rolling 30-day window
 *
 * @package CodeClove\Modules\Dashboard
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Dashboard;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Database\Schema;

/**
 * Class DashboardService
 */
final class DashboardService {

	/**
	 * Returns the full dashboard payload for the given user.
	 *
	 * @param int    $user_id    WordPress user ID.
	 * @param int    $session_id Academic session ID (0 = current/latest).
	 * @param string $range      today|term|session|30days.
	 * @return array<string, mixed>
	 */
	public function get_stats( int $user_id, int $session_id, string $range ): array {
		global $wpdb;

		$is_admin   = user_can( $user_id, 'manage_options' );
		$session_id = $session_id ?: $this->current_session_id();

		// Resolve date bounds for chart queries.
		[ $date_from, $date_to, $current_term ] = $this->resolve_range( $session_id, $range );

		$stats = [];

		// Always include term context so the frontend can label the range correctly.
		$stats['current_term'] = $current_term;

		// ── KPI Counts ──────────────────────────────────────────────────────────
		$thirty_days_ago = gmdate( 'Y-m-d H:i:s', strtotime( '-30 days' ) );

		if ( $is_admin || codeclove_user_can( $user_id, 'students.view' ) ) {
			if ( $session_id ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- KPI students count query.
				$row = $wpdb->get_row(
					$wpdb->prepare(
						'SELECT COUNT(DISTINCT e.student_id) AS total,
						        COUNT(DISTINCT CASE WHEN e.created_at < %s THEN e.student_id END) AS prev
						 FROM %i e
						 INNER JOIN %i s ON s.id = e.student_id
						 WHERE e.academic_session_id = %d AND e.status = %s AND s.deleted_at IS NULL',
						$thirty_days_ago,
						Schema::enrollments(),
						Schema::students(),
						$session_id,
						'active'
					),
					ARRAY_A
				);
			} else {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- KPI students count query.
				$row = $wpdb->get_row(
					$wpdb->prepare(
						'SELECT COUNT(*) AS total,
						        SUM(CASE WHEN created_at < %s THEN 1 ELSE 0 END) AS prev
						 FROM %i
						 WHERE status = %s AND deleted_at IS NULL',
						$thirty_days_ago,
						Schema::students(),
						'active'
					),
					ARRAY_A
				);
			}
			$total_students = (int) ( $row['total'] ?? 0 );
			$prev_students  = (int) ( $row['prev'] ?? 0 );
			$new_students   = $total_students - $prev_students;
			$student_pct    = $prev_students > 0 ? round( ( $new_students / $prev_students ) * 100, 1 ) : 0;

			$stats['total_students']         = $total_students;
			$stats['student_delta']          = $student_pct > 0 ? '+' . $student_pct . '%' : ( $student_pct < 0 ? $student_pct . '%' : '0%' );
			$stats['student_delta_positive'] = $student_pct >= 0;
			$stats['student_delta_label']    = 'vs last month';
		}

		if ( $is_admin || codeclove_user_can( $user_id, 'admissions.view' ) ) {
			if ( $session_id ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- KPI admissions total query.
				$total_admissions = (int) $wpdb->get_var(
					$wpdb->prepare(
						'SELECT COUNT(*) FROM %i WHERE status NOT IN (%s,%s,%s) AND deleted_at IS NULL AND academic_session_id = %d',
						Schema::applications(),
						'admitted',
						'rejected',
						'withdrawn',
						$session_id
					)
				);

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- KPI admissions new query.
				$new_admissions = (int) $wpdb->get_var(
					$wpdb->prepare(
						'SELECT COUNT(*) FROM %i WHERE created_at >= %s AND status NOT IN (%s,%s,%s) AND deleted_at IS NULL AND academic_session_id = %d',
						Schema::applications(),
						$thirty_days_ago,
						'admitted',
						'rejected',
						'withdrawn',
						$session_id
					)
				);
			} else {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- KPI admissions total query.
				$total_admissions = (int) $wpdb->get_var(
					$wpdb->prepare(
						'SELECT COUNT(*) FROM %i WHERE status NOT IN (%s,%s,%s) AND deleted_at IS NULL',
						Schema::applications(),
						'admitted',
						'rejected',
						'withdrawn'
					)
				);

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- KPI admissions new query.
				$new_admissions = (int) $wpdb->get_var(
					$wpdb->prepare(
						'SELECT COUNT(*) FROM %i WHERE created_at >= %s AND status NOT IN (%s,%s,%s) AND deleted_at IS NULL',
						Schema::applications(),
						$thirty_days_ago,
						'admitted',
						'rejected',
						'withdrawn'
					)
				);
			}

			$stats['open_admissions']           = $total_admissions;
			$stats['admissions_delta']          = '+' . $new_admissions;
			$stats['admissions_delta_positive'] = true;
			$stats['admissions_delta_label']    = 'new this month';
		}

		if ( $is_admin || codeclove_user_can( $user_id, 'staff.view' ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- KPI active staff count query.
			$total_staff = (int) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT COUNT(*) FROM %i WHERE status = %s AND deleted_at IS NULL',
					Schema::staff_members(),
					'active'
				)
			);
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- KPI prev staff count query.
			$prev_staff  = (int) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT COUNT(*) FROM %i WHERE status = %s AND created_at < %s AND deleted_at IS NULL',
					Schema::staff_members(),
					'active',
					$thirty_days_ago
				)
			);
			$new_staff = $total_staff - $prev_staff;

			$stats['total_staff']            = $total_staff;
			$stats['staff_delta']            = '+' . $new_staff;
			$stats['staff_delta_positive']   = true;
			$stats['staff_delta_label']      = 'joined this month';
		}

		if ( $is_admin || codeclove_user_can( $user_id, 'finance.view' ) ) {
			if ( $session_id ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Outstanding fees query.
				$stats['outstanding_fees_minor'] = (int) $wpdb->get_var(
					$wpdb->prepare(
						'SELECT COALESCE(SUM(balance_minor),0) FROM %i WHERE status IN (%s,%s,%s) AND deleted_at IS NULL AND academic_session_id = %d',
						Schema::invoices(),
						'issued',
						'partially_paid',
						'overdue',
						$session_id
					)
				);

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Collected fees 30d query.
				$collected_30d = (int) $wpdb->get_var(
					$wpdb->prepare(
						'SELECT COALESCE(SUM(p.amount_minor),0) FROM %i p
						 INNER JOIN %i i ON i.id = p.invoice_id
						 WHERE p.paid_on >= %s AND p.status = %s AND p.deleted_at IS NULL AND i.academic_session_id = %d',
						Schema::payments(),
						Schema::invoices(),
						$thirty_days_ago,
						'completed',
						$session_id
					)
				);

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Overdue invoices count query.
				$overdue_invoices = (int) $wpdb->get_var(
					$wpdb->prepare(
						'SELECT COUNT(*) FROM %i WHERE status = %s AND deleted_at IS NULL AND academic_session_id = %d',
						Schema::invoices(),
						'overdue',
						$session_id
					)
				);

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- New overdue invoices query.
				$new_overdue = (int) $wpdb->get_var(
					$wpdb->prepare(
						'SELECT COUNT(*) FROM %i WHERE status = %s AND updated_at >= %s AND deleted_at IS NULL AND academic_session_id = %d',
						Schema::invoices(),
						'overdue',
						$thirty_days_ago,
						$session_id
					)
				);
			} else {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Outstanding fees query.
				$stats['outstanding_fees_minor'] = (int) $wpdb->get_var(
					$wpdb->prepare(
						'SELECT COALESCE(SUM(balance_minor),0) FROM %i WHERE status IN (%s,%s,%s) AND deleted_at IS NULL',
						Schema::invoices(),
						'issued',
						'partially_paid',
						'overdue'
					)
				);

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Collected fees 30d query.
				$collected_30d = (int) $wpdb->get_var(
					$wpdb->prepare(
						'SELECT COALESCE(SUM(p.amount_minor),0) FROM %i p
						 INNER JOIN %i i ON i.id = p.invoice_id
						 WHERE p.paid_on >= %s AND p.status = %s AND p.deleted_at IS NULL',
						Schema::payments(),
						Schema::invoices(),
						$thirty_days_ago,
						'completed'
					)
				);

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Overdue invoices count query.
				$overdue_invoices = (int) $wpdb->get_var(
					$wpdb->prepare(
						'SELECT COUNT(*) FROM %i WHERE status = %s AND deleted_at IS NULL',
						Schema::invoices(),
						'overdue'
					)
				);

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- New overdue invoices query.
				$new_overdue = (int) $wpdb->get_var(
					$wpdb->prepare(
						'SELECT COUNT(*) FROM %i WHERE status = %s AND updated_at >= %s AND deleted_at IS NULL',
						Schema::invoices(),
						'overdue',
						$thirty_days_ago
					)
				);
			}
			$stats['overdue_invoices']       = $overdue_invoices;
			$stats['overdue_delta']          = '+' . $new_overdue;
			$stats['overdue_delta_positive'] = false;
			$stats['overdue_delta_label']    = 'added this month';
		}

		// ── Pending Approvals (computed once, reused in attendance summary + breakdown) ──

		$pa_adm   = 0;
		$pa_staff = 0;
		if ( $is_admin || codeclove_user_can( $user_id, 'admissions.approve' ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Pending admissions count query.
			$pa_adm = (int) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT COUNT(*) FROM %i WHERE status = %s AND deleted_at IS NULL',
					Schema::applications(),
					'under_review'
				)
			);
		}
		if ( $is_admin || codeclove_user_can( $user_id, 'staff_applications.approve' ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Pending staff apps count query.
			$pa_staff = (int) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT COUNT(*) FROM %i WHERE status = %s AND deleted_at IS NULL',
					Schema::staff_apps(),
					'under_review'
				)
			);
		}

		// ── Today at a Glance ──────────────────────────────────────────────────

		if ( $is_admin || codeclove_user_can( $user_id, 'attendance.view' ) ) {
			$today = current_time( 'Y-m-d' );

			if ( $session_id ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Today student attendance summary.
				$att_row = $wpdb->get_row(
					$wpdb->prepare(
						'SELECT COUNT(*) AS total, SUM(CASE WHEN status IN (%s,%s,%s) THEN 1 ELSE 0 END) AS present
						 FROM %i WHERE attendance_date = %s AND deleted_at IS NULL AND academic_session_id = %d',
						'present',
						'late',
						'half_day',
						Schema::attendance(),
						$today,
						$session_id
					),
					ARRAY_A
				);
			} else {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Today student attendance summary.
				$att_row = $wpdb->get_row(
					$wpdb->prepare(
						'SELECT COUNT(*) AS total, SUM(CASE WHEN status IN (%s,%s,%s) THEN 1 ELSE 0 END) AS present
						 FROM %i WHERE attendance_date = %s AND deleted_at IS NULL',
						'present',
						'late',
						'half_day',
						Schema::attendance(),
						$today
					),
					ARRAY_A
				);
			}
			$total_today   = (int) ( $att_row['total'] ?? 0 );
			$present_today = (int) ( $att_row['present'] ?? 0 );

			$stats['today_summary'] = [
				'date'              => $today,
				'attendance_pct'    => $total_today > 0 ? round( ( $present_today / $total_today ) * 100, 1 ) : null,
				'present'           => $present_today,
				'absent'            => $total_today > 0 ? $total_today - $present_today : 0,
				'total'             => $total_today,
				'pending_approvals' => $pa_adm + $pa_staff,
			];
		}

		// Staff attendance for today — separate permission gate.
		// ponytail: staff_attendance has no academic_session_id column — no session filter here.
		if ( $is_admin || codeclove_user_can( $user_id, 'staff_attendance.view' ) ) {
			$today = $today ?? current_time( 'Y-m-d' );

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Staff attendance total today.
			$staff_total = (int) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT COUNT(*) FROM %i WHERE attendance_date = %s AND deleted_at IS NULL',
					Schema::staff_attendance(),
					$today
				)
			);
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Staff attendance present today.
			$staff_present = $staff_total > 0 ? (int) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT COUNT(*) FROM %i WHERE attendance_date = %s AND status IN (%s,%s,%s) AND deleted_at IS NULL',
					Schema::staff_attendance(),
					$today,
					'present',
					'late',
					'half_day'
				)
			) : 0;

			$stats['staff_attendance_today'] = [
				'total'   => $staff_total,
				'present' => $staff_present,
				'absent'  => $staff_total > 0 ? $staff_total - $staff_present : 0,
				'pct'     => $staff_total > 0 ? round( ( $staff_present / $staff_total ) * 100, 1 ) : null,
			];
		}
		// ── Pending Approvals breakdown (for non-attendance users) ─────────────

		if ( $is_admin || codeclove_user_can( $user_id, 'admissions.approve' ) || codeclove_user_can( $user_id, 'staff_applications.approve' ) ) {
			$stats['pending_approvals'] = [
				'admissions' => $pa_adm,
				'staff_apps' => $pa_staff,
				'total'      => $pa_adm + $pa_staff,
			];
		}

		// ── Trend Charts ───────────────────────────────────────────────────────

		if ( $is_admin || codeclove_user_can( $user_id, 'admissions.view' ) ) {
			$stats['admissions_trend'] = $this->admissions_trend( $session_id, $date_from, $date_to, $range );
		}

		if ( ( $is_admin || codeclove_user_can( $user_id, 'finance.view' ) ) && $session_id ) {
			$stats['finance_trend'] = $this->finance_trend( $session_id, $date_from, $date_to, $range );
		}

		if ( $is_admin || codeclove_user_can( $user_id, 'attendance.view' ) ) {
			$stats['attendance_trend'] = $this->attendance_trend( $session_id, $date_from, $date_to );
		}

		// ── Recent Audit Events ────────────────────────────────────────────────

		if ( $is_admin
			|| codeclove_user_can( $user_id, 'students.view' )
			|| codeclove_user_can( $user_id, 'admissions.view' )
			|| codeclove_user_can( $user_id, 'finance.view' ) ) {
			$stats['recent_events'] = $this->recent_events( $user_id, $is_admin );
		}

		// ── Setup Checklist (admin only) ───────────────────────────────────────

		if ( $is_admin ) {
			$stats['setup_checklist'] = $this->setup_checklist( $session_id );
		}

		// ── Current user's CodeClove role name ───────────────────────────────────

		$stats['user_role'] = $this->user_role_name( $user_id );

		return $stats;
	}

	// ─── Date Range Resolution ────────────────────────────────────────────────

	/**
	 * Resolves a school-native range to absolute date bounds.
	 *
	 * Returns [ date_from, date_to, current_term_or_null ]
	 *
	 * @param int    $session_id Current session ID.
	 * @param string $range      today|term|session|30days.
	 * @return array{string, string, array<string,mixed>|null}
	 */
	private function resolve_range( int $session_id, string $range ): array {
		global $wpdb;
		$today = current_time( 'Y-m-d' );

		switch ( $range ) {
			case 'today':
				return [ $today, $today, null ];

			case 'session':
				if ( $session_id ) {
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Session dates query.
					$row = $wpdb->get_row(
						$wpdb->prepare(
							'SELECT starts_on, ends_on FROM %i WHERE id = %d',
							Schema::sessions(),
							$session_id
						),
						ARRAY_A
					);
					if ( $row ) {
						return [ $row['starts_on'], $row['ends_on'], null ];
					}
				}
				// Fallback: calendar year.
				return [ gmdate( 'Y-01-01' ), gmdate( 'Y-12-31' ), null ];

			case 'term':
				// Find the term whose window contains today (or the most recent past term).
				if ( $session_id ) {
					// ponytail: find active or most recently ended term.
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Active or recent term query.
					$term = $wpdb->get_row(
						$wpdb->prepare(
							'SELECT id, name, starts_on, ends_on FROM %i
							 WHERE academic_session_id = %d
							   AND starts_on <= %s
							 ORDER BY ends_on DESC LIMIT %d',
							Schema::terms(),
							$session_id,
							$today,
							1
						),
						ARRAY_A
					);
					if ( $term ) {
						return [
							$term['starts_on'],
							min( $term['ends_on'], $today ),
							[
								'id'        => (int) $term['id'],
								'name'      => $term['name'],
								'starts_on' => $term['starts_on'],
								'ends_on'   => $term['ends_on'],
							],
						];
					}
				}
				// No term found — fall through to 30days.
				return [ gmdate( 'Y-m-d', strtotime( '-30 days' ) ), $today, null ];

			case '30days':
			default:
				return [ gmdate( 'Y-m-d', strtotime( '-30 days' ) ), $today, null ];
		}
	}

	// ─── Private Aggregation Helpers ────────────────────────────────────────────

	/** Returns the current active session ID, or 0 if none. */
	private function current_session_id(): int {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Custom database table query.
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM %i WHERE is_current = %d LIMIT 1',
				Schema::sessions(),
				1
			)
		);
	}

	/**
	 * Admission counts grouped by date bucket within the resolved range.
	 * Uses daily grouping for today/30days, monthly for term/session.
	 *
	 * @param int    $session_id  Session ID.
	 * @param string $date_from   ISO start date.
	 * @param string $date_to     ISO end date.
	 * @param string $range       Original range key (for format selection).
	 * @return array<int, array{label: string, count: int}>
	 */
	private function admissions_trend( int $session_id, string $date_from, string $date_to, string $range ): array {
		global $wpdb;
		// ponytail: daily buckets for tight ranges, monthly for wider ones.
		$day_diff = max( 1, (int) round( ( strtotime( $date_to ) - strtotime( $date_from ) ) / 86400 ) );
		$format   = $day_diff <= 31 ? '%Y-%m-%d' : '%Y-%m';

		if ( $session_id ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Admissions trend query.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT DATE_FORMAT(created_at, %s) AS label, COUNT(*) AS count
					 FROM %i
					 WHERE created_at >= %s AND created_at <= %s AND deleted_at IS NULL AND academic_session_id = %d
					 GROUP BY label ORDER BY label ASC',
					$format,
					Schema::applications(),
					$date_from . ' 00:00:00',
					$date_to . ' 23:59:59',
					$session_id
				),
				ARRAY_A
			);
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Admissions trend query.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT DATE_FORMAT(created_at, %s) AS label, COUNT(*) AS count
					 FROM %i
					 WHERE created_at >= %s AND created_at <= %s AND deleted_at IS NULL
					 GROUP BY label ORDER BY label ASC',
					$format,
					Schema::applications(),
					$date_from . ' 00:00:00',
					$date_to . ' 23:59:59'
				),
				ARRAY_A
			);
		}
		// Fill in missing dates to make charts look professional
		$buckets = [];
		$curr    = strtotime( $date_from );
		$end     = strtotime( $date_to );
		if ( $day_diff <= 31 ) {
			while ( $curr <= $end ) {
				$buckets[ gmdate( 'Y-m-d', $curr ) ] = 0;
				$curr += 86400;
			}
		} else {
			while ( $curr <= $end ) {
				$buckets[ gmdate( 'Y-m', $curr ) ] = 0;
				$curr = strtotime( '+1 month', strtotime( gmdate( 'Y-m-01', $curr ) ) );
			}
		}

		foreach ( (array) $rows as $r ) {
			$buckets[ $r['label'] ] = (int) $r['count'];
		}

		$result = [];
		foreach ( $buckets as $label => $count ) {
			$result[] = [ 'label' => $label, 'count' => $count ];
		}
		return $result;
	}

	/**
	 * Monthly billed vs collected totals within range.
	 *
	 * @param int    $session_id Session ID.
	 * @param string $date_from  ISO start date.
	 * @param string $date_to    ISO end date.
	 * @param string $range      Original range key.
	 * @return array<int, array{label: string, billed: int, collected: int}>
	 */
	private function finance_trend( int $session_id, string $date_from, string $date_to, string $range ): array {
		global $wpdb;
		$day_diff = max( 1, (int) round( ( strtotime( $date_to ) - strtotime( $date_from ) ) / 86400 ) );
		$format   = $day_diff <= 31 ? '%Y-%m-%d' : '%Y-%m';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Billed trend query.
		$billed_rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT DATE_FORMAT(created_at, %s) AS label, COALESCE(SUM(total_minor),0) AS amount
				 FROM %i
				 WHERE academic_session_id = %d
				   AND created_at >= %s AND created_at <= %s
				   AND status NOT IN (%s,%s,%s) AND deleted_at IS NULL
				 GROUP BY label ORDER BY label ASC',
				$format,
				Schema::invoices(),
				$session_id,
				$date_from . ' 00:00:00',
				$date_to . ' 23:59:59',
				'draft',
				'void',
				'cancelled'
			),
			ARRAY_A
		);

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Collected trend query.
		$collected_rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT DATE_FORMAT(p.paid_on, %s) AS label, COALESCE(SUM(p.amount_minor),0) AS amount
				 FROM %i p
				 INNER JOIN %i i ON i.id = p.invoice_id
				 WHERE i.academic_session_id = %d
				   AND p.paid_on >= %s AND p.paid_on <= %s
				   AND p.status = %s AND p.deleted_at IS NULL
				 GROUP BY label ORDER BY label ASC',
				$format,
				Schema::payments(),
				Schema::invoices(),
				$session_id,
				$date_from,
				$date_to,
				'completed'
			),
			ARRAY_A
		);
		// phpcs:enable

		$billed_map    = array_column( (array) $billed_rows, 'amount', 'label' );
		$collected_map = array_column( (array) $collected_rows, 'amount', 'label' );

		// Fill in missing dates to make charts look professional
		$buckets = [];
		$curr    = strtotime( $date_from );
		$end     = strtotime( $date_to );
		if ( $day_diff <= 31 ) {
			while ( $curr <= $end ) {
				$buckets[ gmdate( 'Y-m-d', $curr ) ] = [ 'billed' => 0, 'collected' => 0 ];
				$curr += 86400;
			}
		} else {
			while ( $curr <= $end ) {
				$buckets[ gmdate( 'Y-m', $curr ) ] = [ 'billed' => 0, 'collected' => 0 ];
				$curr = strtotime( '+1 month', strtotime( gmdate( 'Y-m-01', $curr ) ) );
			}
		}

		foreach ( $buckets as $l => $v ) {
			if ( isset( $billed_map[ $l ] ) ) {
				$buckets[ $l ]['billed'] = (int) $billed_map[ $l ];
			}
			if ( isset( $collected_map[ $l ] ) ) {
				$buckets[ $l ]['collected'] = (int) $collected_map[ $l ];
			}
		}

		// Also handle any labels from maps that might have fallen outside the generated range
		$all_labels = array_unique( array_merge( array_keys( $billed_map ), array_keys( $collected_map ) ) );
		foreach ( $all_labels as $l ) {
			if ( ! isset( $buckets[ $l ] ) ) {
				$buckets[ $l ] = [
					'billed'    => (int) ( $billed_map[ $l ] ?? 0 ),
					'collected' => (int) ( $collected_map[ $l ] ?? 0 ),
				];
			}
		}

		ksort( $buckets );

		$result = [];
		foreach ( $buckets as $label => $vals ) {
			$result[] = [
				'label'     => $label,
				'billed'    => $vals['billed'],
				'collected' => $vals['collected'],
			];
		}
		return $result;
	}

	/**
	 * Daily attendance rate within date range.
	 *
	 * @param int    $session_id Session ID.
	 * @param string $date_from  ISO start date.
	 * @param string $date_to    ISO end date.
	 * @return array<int, array{label: string, present: int, total: int}>
	 */
	private function attendance_trend( int $session_id, string $date_from, string $date_to ): array {
		global $wpdb;
		if ( $session_id ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Attendance trend query.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT attendance_date AS label,
					        COUNT(*) AS total,
					        SUM(CASE WHEN status IN (%s,%s,%s) THEN 1 ELSE 0 END) AS present
					 FROM %i
					 WHERE attendance_date >= %s AND attendance_date <= %s AND deleted_at IS NULL AND academic_session_id = %d
					 GROUP BY attendance_date ORDER BY attendance_date ASC',
					'present',
					'late',
					'half_day',
					Schema::attendance(),
					$date_from,
					$date_to,
					$session_id
				),
				ARRAY_A
			);
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Attendance trend query.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT attendance_date AS label,
					        COUNT(*) AS total,
					        SUM(CASE WHEN status IN (%s,%s,%s) THEN 1 ELSE 0 END) AS present
					 FROM %i
					 WHERE attendance_date >= %s AND attendance_date <= %s AND deleted_at IS NULL
					 GROUP BY attendance_date ORDER BY attendance_date ASC',
					'present',
					'late',
					'half_day',
					Schema::attendance(),
					$date_from,
					$date_to
				),
				ARRAY_A
			);
		}
		return array_map(
			static fn( $r ) => [
				'label'   => $r['label'],
				'present' => (int) $r['present'],
				'total'   => (int) $r['total'],
			],
			(array) $rows
		);
	}

	/**
	 * Formats minor currency units according to school localization settings.
	 */
	private function format_currency_amount( int $minor ): string {
		$settings = get_option( 'codeclove_settings', [] );
		$loc      = $settings['localization'] ?? [];
		$code     = strtoupper( (string) ( $loc['currency'] ?? 'INR' ) );
		$symbol   = match ( $code ) {
			'INR'   => '₹',
			'USD'   => '$',
			'GBP'   => '£',
			'EUR'   => '€',
			'NGN'   => '₦',
			'KES'   => 'KSh',
			'GHS'   => 'GH₵',
			'ZAR'   => 'R',
			'PKR'   => '₨',
			'BDT'   => '৳',
			'AED'   => 'AED ',
			'SAR'   => 'SAR ',
			default => $code . ' ',
		};

		$position  = $loc['currency_position'] ?? 'left';
		$precision = isset( $loc['decimal_precision'] ) ? (int) $loc['decimal_precision'] : 2;
		$amount    = number_format( $minor / 100, $precision );

		return match ( $position ) {
			'right'       => $amount . $symbol,
			'right_space' => $amount . ' ' . $symbol,
			'left_space'  => $symbol . ' ' . $amount,
			default       => $symbol . $amount,
		};
	}

	/**
	 * Returns the 10 most recent audit log events visible to the user,
	 * formatted as human-readable activity narratives.
	 *
	 * @param int  $user_id  WordPress user ID.
	 * @param bool $is_admin True for WP admins (see all events).
	 * @return array<int, array<string,mixed>>
	 */
	private function recent_events( int $user_id, bool $is_admin ): array {
		global $wpdb;
		if ( ! $is_admin ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Recent audit logs user-scoped query.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT id, event_type, actor_type, actor_id, actor_label, created_at, metadata_json
					 FROM %i
					 WHERE actor_id = %d OR actor_type = %s
					 ORDER BY created_at DESC LIMIT %d',
					Schema::app_logs(),
					$user_id,
					'system',
					10
				),
				ARRAY_A
			);
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Recent audit logs admin query.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT id, event_type, actor_type, actor_id, actor_label, created_at, metadata_json
					 FROM %i
					 ORDER BY created_at DESC LIMIT %d',
					Schema::app_logs(),
					10
				),
				ARRAY_A
			);
		}
		if ( empty( $rows ) ) {
			return [];
		}

		// ponytail: collect IDs for 1-query batch resolution (no N+1 joins)
		$app_ids     = [];
		$unit_ids    = [];
		$payment_ids = [];
		$meta_parsed = [];

		foreach ( $rows as $idx => $r ) {
			$meta                = json_decode( $r['metadata_json'] ?? '{}', true ) ?: [];
			$meta_parsed[ $idx ] = $meta;

			if ( ! empty( $meta['application_id'] ) ) {
				$app_ids[] = (int) $meta['application_id'];
			}
			if ( ! empty( $meta['academic_unit_id'] ) ) {
				$unit_ids[] = (int) $meta['academic_unit_id'];
			}
			if ( ! empty( $meta['unit_id'] ) ) {
				$unit_ids[] = (int) $meta['unit_id'];
			}
			if ( ! empty( $meta['payment_id'] ) ) {
				$payment_ids[] = (int) $meta['payment_id'];
			}
		}

		// 1. Batch load applications
		$app_map = [];
		if ( ! empty( $app_ids ) ) {
			$unique_app_ids   = array_values( array_map( 'intval', array_unique( $app_ids ) ) );
			$app_placeholders = implode( ',', array_fill( 0, count( $unique_app_ids ), '%d' ) );
			// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- Batch applications lookup with dynamic IN placeholders.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Custom database query.
			$app_rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT a.id, a.student_first_name, a.student_last_name, a.status, u.name AS unit_name
					 FROM %i a
					 LEFT JOIN %i u ON u.id = a.academic_unit_id
					 WHERE a.id IN ({$app_placeholders})",
					Schema::applications(),
					Schema::units(),
					...$unique_app_ids
				),
				ARRAY_A
			);
			// phpcs:enable
			$app_map = array_column( (array) $app_rows, null, 'id' );
		}

		// 2. Batch load units
		$unit_map = [];
		if ( ! empty( $unit_ids ) ) {
			$unique_unit_ids   = array_values( array_map( 'intval', array_unique( $unit_ids ) ) );
			$unit_placeholders = implode( ',', array_fill( 0, count( $unique_unit_ids ), '%d' ) );
			// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- Batch units lookup with dynamic IN placeholders.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Custom database query.
			$unit_rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT id, name FROM %i WHERE id IN ({$unit_placeholders})",
					Schema::units(),
					...$unique_unit_ids
				),
				ARRAY_A
			);
			// phpcs:enable
			$unit_map = array_column( (array) $unit_rows, 'name', 'id' );
		}

		// 3. Batch load payments
		$pay_map = [];
		if ( ! empty( $payment_ids ) ) {
			$unique_payment_ids = array_values( array_map( 'intval', array_unique( $payment_ids ) ) );
			$pay_placeholders   = implode( ',', array_fill( 0, count( $unique_payment_ids ), '%d' ) );
			// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- Batch payments lookup with dynamic IN placeholders.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Custom database query.
			$pay_rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT p.id, p.amount_minor, s.first_name, s.last_name, u.name AS unit_name
					 FROM %i p
					 LEFT JOIN %i i ON i.id = p.invoice_id
					 LEFT JOIN %i s ON s.id = i.student_id
					 LEFT JOIN %i e ON (e.student_id = s.id AND e.status = %s)
					 LEFT JOIN %i u ON u.id = e.academic_unit_id
					 WHERE p.id IN ({$pay_placeholders})",
					Schema::payments(),
					Schema::invoices(),
					Schema::students(),
					Schema::enrollments(),
					'active',
					Schema::units(),
					...$unique_payment_ids
				),
				ARRAY_A
			);
			// phpcs:enable
			$pay_map = array_column( (array) $pay_rows, null, 'id' );
		}

		$events = [];

		foreach ( $rows as $idx => $r ) {
			$meta       = $meta_parsed[ $idx ];
			$event_type = $r['event_type'];
			$prefix     = '';
			$detail     = '';
			$actor_name = $r['actor_label'] ?: 'Administrator';

			// Normalise actor name
			if ( 'system' === $r['actor_type'] || strtolower( (string) $r['actor_label'] ) === 'system' ) {
				$actor_name = 'Automated Cron';
			} elseif ( strtolower( (string) $r['actor_label'] ) === 'admin' ) {
				$actor_name = 'Administrator';
			}

			// Format structured narrative
			if ( str_starts_with( $event_type, 'admission' ) || 'status_change' === $event_type ) {
				$app_id       = (int) ( $meta['application_id'] ?? 0 );
				$app          = $app_map[ $app_id ] ?? null;
				$student_name = $app ? trim( $app['student_first_name'] . ' ' . $app['student_last_name'] ) : ( $meta['student_name'] ?? 'Applicant' );
				$unit_name    = $app['unit_name'] ?? ( $meta['unit_name'] ?? '' );
				$to_status    = $meta['to'] ?? ( $meta['to_status'] ?? ( $app['status'] ?? 'submitted' ) );
				$verb         = match ( $to_status ) {
					'admitted'     => 'enrolled in',
					'approved'     => 'approved for',
					'under_review' => 'under review for',
					'rejected'     => 'rejected for',
					default        => 'submitted for',
				};
				$prefix = 'Admission status updated:';
				$detail = $unit_name ? "{$student_name} {$verb} {$unit_name}" : "{$student_name} {$verb} admission";
			} elseif ( str_starts_with( $event_type, 'payment' ) || str_starts_with( $event_type, 'invoice' ) ) {
				$pay_id       = (int) ( $meta['payment_id'] ?? 0 );
				$pay          = $pay_map[ $pay_id ] ?? null;
				$student_name = $pay ? trim( $pay['first_name'] . ' ' . $pay['last_name'] ) : ( $meta['student_name'] ?? 'Student' );
				$unit_name    = $pay['unit_name'] ?? '';
				$amount_minor = (int) ( $pay['amount_minor'] ?? ( $meta['amount_minor'] ?? 0 ) );
				$amount_fmt   = $this->format_currency_amount( $amount_minor );
				$prefix       = 'Fee payment reconciled:';
				$detail       = $unit_name ? "{$student_name} ({$unit_name}) · {$amount_fmt}" : "{$student_name} · {$amount_fmt}";
				if ( 'Administrator' === $actor_name ) {
					$actor_name = 'Finance Desk';
				}
			} elseif ( 'attendance.staff_saved' === $event_type ) {
				$count      = (int) ( $meta['record_count'] ?? 0 );
				$prefix     = 'Biometric morning attendance sync locked ·';
				$detail     = $count > 0 ? "{$count} present" : 'Staff attendance updated';
				$actor_name = 'Automated Cron';
			} elseif ( 'attendance.student_saved' === $event_type ) {
				$unit_id    = (int) ( $meta['academic_unit_id'] ?? 0 );
				$unit_name  = $unit_map[ $unit_id ] ?? 'Class';
				$count      = (int) ( $meta['record_count'] ?? 0 );
				$prefix     = 'Morning attendance recorded:';
				$detail     = "{$unit_name} · {$count} present";
				$actor_name = 'Automated Cron';
			} elseif ( str_starts_with( $event_type, 'settings' ) ) {
				$sections   = (array) ( $meta['sections'] ?? [] );
				$sec_str    = ! empty( $sections ) ? implode( ' & ', array_map( 'ucfirst', $sections ) ) : 'General';
				$prefix     = 'System settings updated:';
				$detail     = "{$sec_str} configuration saved";
			} else {
				// ponytail: clean fallback for unmapped custom events
				$clean_name = ucwords( str_replace( [ '.', '_' ], ' ', $event_type ) );
				$prefix     = "{$clean_name}:";
				$detail     = $meta['label'] ?? 'Action completed';
			}

			$events[] = [
				'id'         => (int) $r['id'],
				'event_type' => $event_type,
				'actor_type' => $r['actor_type'],
				'actor_id'   => (int) $r['actor_id'],
				'actor_name' => $actor_name,
				'created_at' => $r['created_at'],
				'prefix'     => $prefix,
				'detail'     => $detail,
				'label'      => $meta['label'] ?? "{$prefix} {$detail}",
				'url'        => $meta['url'] ?? null,
			];
		}

		return $events;
	}

	/**
	 * Returns the setup checklist completion state (admin-only).
	 *
	 * @param int $session_id Current session ID.
	 * @return array<string, bool>
	 */
	private function setup_checklist( int $session_id ): array {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Setup checklist session existence check.
		$has_session     = (bool) $wpdb->get_var(
			$wpdb->prepare( 'SELECT id FROM %i LIMIT %d', Schema::sessions(), 1 )
		);
		$has_units       = $session_id
			? (bool) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT id FROM %i WHERE academic_session_id = %d LIMIT %d',
					Schema::units(),
					$session_id,
					1
				)
			)
			: false;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Setup checklist custom role check.
		$has_custom_role = (bool) $wpdb->get_var(
			$wpdb->prepare( 'SELECT id FROM %i WHERE is_system = %d LIMIT %d', Schema::roles(), 0, 1 )
		);
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Setup checklist user roles check.
		$has_user_roles  = (bool) $wpdb->get_var(
			$wpdb->prepare( 'SELECT id FROM %i LIMIT %d', Schema::user_roles(), 1 )
		);
		$has_roles       = $has_custom_role || $has_user_roles;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Setup checklist admission check.
		$has_admission   = (bool) $wpdb->get_var(
			$wpdb->prepare( 'SELECT id FROM %i WHERE deleted_at IS NULL LIMIT %d', Schema::applications(), 1 )
		);
		$settings   = get_option( 'codeclove_settings', [] );
		$has_preset = ! empty( $settings['education_system']['preset'] );

		return [
			'preset'    => $has_preset,
			'session'   => $has_session,
			'units'     => $has_units,
			'roles'     => $has_roles,
			'admission' => $has_admission,
		];
	}

	/**
	 * Returns the display name of the user's first CodeClove role.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return string|null
	 */
	private function user_role_name( int $user_id ): ?string {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- User primary role display name query.
		return $wpdb->get_var(
			$wpdb->prepare(
				'SELECT r.name FROM %i r
				 INNER JOIN %i ur ON ur.role_id = r.id
				 WHERE ur.user_id = %d LIMIT %d',
				Schema::roles(),
				Schema::user_roles(),
				$user_id,
				1
			)
		) ?: null;
}
}
