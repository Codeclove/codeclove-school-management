<?php
/**
 * Daily Attendance REST API controller.
 *
 * @package Nexora\Modules\Attendance
 */

declare( strict_types=1 );

namespace Nexora\Modules\Attendance;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Nexora\Api\BaseController;
use Nexora\Database\Schema;
use Nexora\Shared\AuditLogger;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class AttendanceController
 */
final class AttendanceController extends BaseController {

	private AttendanceService $service;

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->service = new AttendanceService();
	}

	/**
	 * Registers REST routes.
	 */
	public function register_routes(): void {
		// ─── Student Attendance Routes ──────────────────────────────────────────
		register_rest_route(
			$this->namespace,
			'/attendance',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_student_attendance' ],
					'permission_callback' => $this->permission( 'attendance.view' ),
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'save_student_attendance' ],
					'permission_callback' => $this->any_permission( 'attendance.add', 'attendance.edit' ),
				],
			]
		);

		// ─── Staff Attendance Routes ────────────────────────────────────────────
		register_rest_route(
			$this->namespace,
			'/staff/attendance',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_staff_attendance' ],
					'permission_callback' => $this->permission( 'staff_attendance.view' ),
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'save_staff_attendance' ],
					'permission_callback' => $this->any_permission( 'staff_attendance.add', 'staff_attendance.edit' ),
				],
			]
		);

		// ─── Monthly Overview Routes ────────────────────────────────────────────
		register_rest_route(
			$this->namespace,
			'/attendance/monthly',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_monthly_student_attendance' ],
					'permission_callback' => $this->permission( 'attendance.view' ),
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/staff/attendance/monthly',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_monthly_staff_attendance' ],
					'permission_callback' => $this->permission( 'staff_attendance.view' ),
				],
			]
		);
	}

	/**
	 * Gets student attendance register or history log.
	 *
	 * @param WP_REST_Request $request Incoming REST request.
	 */
	public function get_student_attendance( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$student_id = $request->get_param( 'student_id' );

		if ( ! empty( $student_id ) ) {
			$results = $this->service->get_student_attendance( [ 'student_id' => (int) $student_id ] );
			return $this->success( $results );
		}

		$session_id = $request->get_param( 'academic_session_id' );
		$unit_id    = $request->get_param( 'academic_unit_id' );
		$group_id   = $request->get_param( 'academic_group_id' );
		$date       = $this->get_date_param( $request );

		if ( empty( $session_id ) || empty( $unit_id ) || ! $date ) {
			return $this->error( 'missing_params', __( 'Missing or invalid academic_session_id, academic_unit_id, or attendance_date (YYYY-MM-DD).', 'nexora-school-management' ), 400 );
		}

		$results = $this->service->get_student_attendance( [
			'academic_session_id' => (int) $session_id,
			'academic_unit_id'    => (int) $unit_id,
			'academic_group_id'   => $group_id ? (int) $group_id : null,
			'attendance_date'     => $date,
		] );

		return $this->success( $results );
	}

	/**
	 * Takes or updates student daily attendance register.
	 *
	 * @param WP_REST_Request $request Incoming REST request.
	 */
	public function save_student_attendance( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$session_id = $request->get_param( 'academic_session_id' );
		$unit_id    = $request->get_param( 'academic_unit_id' );
		$group_id   = $request->get_param( 'academic_group_id' );
		$date       = $request->get_param( 'attendance_date' );
		$records    = $request->get_param( 'records' );

		if ( empty( $session_id ) || empty( $unit_id ) || empty( $date ) || ! is_array( $records ) ) {
			return $this->error( 'invalid_data', __( 'Invalid or incomplete attendance payload.', 'nexora-school-management' ), 400 );
		}

		$user_id = get_current_user_id();

		$result = $this->service->save_student_attendance( [
			'academic_session_id' => (int) $session_id,
			'academic_unit_id'    => (int) $unit_id,
			'academic_group_id'   => $group_id ? (int) $group_id : null,
			'attendance_date'     => $date,
			'records'             => $records,
		], $user_id );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log( 'attendance.student_saved', [
			'academic_session_id' => (int) $session_id,
			'academic_unit_id'    => (int) $unit_id,
			'academic_group_id'   => $group_id ? (int) $group_id : null,
			'attendance_date'     => $date,
			'record_count'        => count( $records ),
		] );

		return $this->success( [ 'saved' => true ] );
	}

	/**
	 * Gets staff attendance register or history log.
	 *
	 * @param WP_REST_Request $request Incoming REST request.
	 */
	public function get_staff_attendance( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$staff_member_id = $request->get_param( 'staff_member_id' );

		if ( ! empty( $staff_member_id ) ) {
			$results = $this->service->get_staff_attendance( [ 'staff_member_id' => (int) $staff_member_id ] );
			return $this->success( $results );
		}

		$date = $this->get_date_param( $request );
		if ( ! $date ) {
			return $this->error( 'invalid_date', __( 'Missing or invalid attendance_date query parameter (YYYY-MM-DD).', 'nexora-school-management' ), 400 );
		}

		$results = $this->service->get_staff_attendance( [ 'attendance_date' => $date ] );

		return $this->success( $results );
	}

	/**
	 * Takes or updates staff daily attendance register.
	 *
	 * @param WP_REST_Request $request Incoming REST request.
	 */
	public function save_staff_attendance( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$date    = $this->get_date_param( $request );
		$records = $request->get_param( 'records' );

		if ( ! $date || ! is_array( $records ) ) {
			return $this->error( 'invalid_data', __( 'Invalid or incomplete attendance payload.', 'nexora-school-management' ), 400 );
		}

		$user_id = get_current_user_id();

		$result = $this->service->save_staff_attendance( [
			'attendance_date' => $date,
			'records'         => $records,
		], $user_id );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log( 'attendance.staff_saved', [
			'attendance_date' => $date,
			'record_count'    => count( $records ),
		] );

		return $this->success( [ 'saved' => true ] );
	}

	/**
	 * Gets monthly attendance matrix for students.
	 *
	 * @param WP_REST_Request $request Incoming REST request.
	 */
	public function get_monthly_student_attendance( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$session_id = $request->get_param( 'academic_session_id' );
		$unit_id    = $request->get_param( 'academic_unit_id' );
		$group_id   = $request->get_param( 'academic_group_id' );
		$year       = $request->get_param( 'year' );
		$month      = $request->get_param( 'month' );

		if ( empty( $session_id ) || empty( $unit_id ) || empty( $year ) || empty( $month ) ) {
			return $this->error( 'missing_params', __( 'Missing academic_session_id, academic_unit_id, year, or month.', 'nexora-school-management' ), 400 );
		}

		$result = $this->service->get_monthly_student_attendance( [
			'academic_session_id' => (int) $session_id,
			'academic_unit_id'    => (int) $unit_id,
			'academic_group_id'   => $group_id ? (int) $group_id : null,
			'year'                => (int) $year,
			'month'               => (int) $month,
		] );

		return $this->success( $result );
	}

	/**
	 * Gets monthly attendance matrix for staff.
	 *
	 * @param WP_REST_Request $request Incoming REST request.
	 */
	public function get_monthly_staff_attendance( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$year  = $request->get_param( 'year' );
		$month = $request->get_param( 'month' );

		if ( empty( $year ) || empty( $month ) ) {
			return $this->error( 'missing_params', __( 'Missing year or month query parameter.', 'nexora-school-management' ), 400 );
		}

		$result = $this->service->get_monthly_staff_attendance( [
			'year'  => (int) $year,
			'month' => (int) $month,
		] );

		return $this->success( $result );
	}
	/**
	 * Extracts and validates a YYYY-MM-DD date parameter from request.
	 */
	private function get_date_param( WP_REST_Request $request, string $param = 'attendance_date' ): ?string {
		$raw = $request->get_param( $param );
		$val = $raw ? sanitize_text_field( (string) $raw ) : null;
		return ( $val && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $val ) ) ? $val : null;
	}
}
