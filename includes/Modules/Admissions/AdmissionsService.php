<?php
/**
 * Admissions service.
 *
 * Implements business logic and validation rules for admissions applications.
 *
 * @package CodeClove\Modules\Admissions
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Admissions;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Core\Logger;
use CodeClove\Database\Schema;
use CodeClove\Database\Transaction;
use CodeClove\Shared\IdentifierService;
use WP_Error;
/**
 * Class AdmissionsService
 */
final class AdmissionsService {

	/**
	 * Gets applications with filters and pagination.
	 *
	 * @param array $args
	 * @return array{applications: array, total: int}
	 */
	public function get_applications( array $args = [] ): array {
		$apps  = $this->db_get_applications( $args );
		$total = $this->db_count_applications( $args );

		$mapped = array_map( [ $this, 'map_application' ], $apps );

		return [
			'applications' => $mapped,
			'total'        => $total,
		];
	}

	/**
	 * Gets a single application profile by ID.
	 *
	 * @param int $id
	 * @return array|null
	 */
	public function get_application( int $id ): ?array {
		$app = $this->db_get_application( $id );
		return $app ? $this->map_application( $app ) : null;
	}

	/**
	 * Submits a public admission application / inquiry form.
	 *
	 * @param array $payload
	 * @return array|WP_Error
	 */
	public function submit_public_application( array $payload ): array|WP_Error {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Custom database table query.
		$active_session = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT id FROM %i WHERE is_current = %d LIMIT 1',
				Schema::sessions(),
				1
			),
			ARRAY_A
		);
		$active_session_id = $active_session ? (int) $active_session['id'] : 0;

		if ( empty( $payload['student_first_name'] ) || empty( $payload['student_last_name'] ) ) {
			return new WP_Error( 'codeclove_validation_failed', __( 'Student first name and last name are required.', 'codeclove-school-management' ), 400 );
		}

		$father_name       = ! empty( $payload['father_name'] ) ? sanitize_text_field( $payload['father_name'] ) : '';
		$father_phone      = ! empty( $payload['father_phone'] ) ? sanitize_text_field( $payload['father_phone'] ) : '';
		$father_email      = ! empty( $payload['father_email'] ) ? sanitize_email( $payload['father_email'] ) : '';
		$father_occ        = ! empty( $payload['father_occupation'] ) ? sanitize_text_field( $payload['father_occupation'] ) : '';

		$mother_name       = ! empty( $payload['mother_name'] ) ? sanitize_text_field( $payload['mother_name'] ) : '';
		$mother_phone      = ! empty( $payload['mother_phone'] ) ? sanitize_text_field( $payload['mother_phone'] ) : '';
		$mother_email      = ! empty( $payload['mother_email'] ) ? sanitize_email( $payload['mother_email'] ) : '';
		$mother_occ        = ! empty( $payload['mother_occupation'] ) ? sanitize_text_field( $payload['mother_occupation'] ) : '';

		$other_name        = ! empty( $payload['guardian_other_name'] ) ? sanitize_text_field( $payload['guardian_other_name'] ) : '';
		$other_phone       = ! empty( $payload['guardian_other_phone'] ) ? sanitize_text_field( $payload['guardian_other_phone'] ) : '';
		$other_email       = ! empty( $payload['guardian_other_email'] ) ? sanitize_email( $payload['guardian_other_email'] ) : '';
		$other_rel         = ! empty( $payload['guardian_other_relationship'] ) ? sanitize_text_field( $payload['guardian_other_relationship'] ) : 'Legal Guardian';

		$primary_comm      = ! empty( $payload['primary_communication'] ) ? sanitize_text_field( $payload['primary_communication'] ) : 'father';

		// Determine primary guardian details for main columns
		if ( 'mother' === $primary_comm && ! empty( $mother_name ) ) {
			$guardian_name  = $mother_name;
			$guardian_email = $mother_email;
			$guardian_phone = $mother_phone;
			$relationship   = 'Mother';
		} elseif ( 'guardian' === $primary_comm && ! empty( $other_name ) ) {
			$guardian_name  = $other_name;
			$guardian_email = $other_email;
			$guardian_phone = $other_phone;
			$relationship   = $other_rel;
		} elseif ( ! empty( $father_name ) ) {
			$guardian_name  = $father_name;
			$guardian_email = $father_email;
			$guardian_phone = $father_phone;
			$relationship   = 'Father';
		} elseif ( ! empty( $mother_name ) ) {
			$guardian_name  = $mother_name;
			$guardian_email = $mother_email;
			$guardian_phone = $mother_phone;
			$relationship   = 'Mother';
		} elseif ( ! empty( $other_name ) ) {
			$guardian_name  = $other_name;
			$guardian_email = $other_email;
			$guardian_phone = $other_phone;
			$relationship   = $other_rel;
		} else {
			$guardian_name  = ! empty( $payload['guardian_name'] ) ? sanitize_text_field( $payload['guardian_name'] ) : 'Guardian';
			$guardian_email = ! empty( $payload['guardian_email'] ) ? sanitize_email( $payload['guardian_email'] ) : '';
			$guardian_phone = ! empty( $payload['guardian_phone'] ) ? sanitize_text_field( $payload['guardian_phone'] ) : '';
			$relationship   = ! empty( $payload['guardian_relationship'] ) ? sanitize_text_field( $payload['guardian_relationship'] ) : 'Guardian';
		}

		if ( empty( $guardian_name ) ) {
			return new WP_Error( 'codeclove_validation_failed', __( 'Parent or guardian name is required.', 'codeclove-school-management' ), 400 );
		}

		$ref_number = IdentifierService::generate( 'admission_application' );
		$now        = current_time( 'mysql', true );

		$address_data = [
			'street'  => ! empty( $payload['street_address'] ) ? sanitize_text_field( $payload['street_address'] ) : '',
			'city'    => ! empty( $payload['city'] ) ? sanitize_text_field( $payload['city'] ) : '',
			'state'   => ! empty( $payload['state'] ) ? sanitize_text_field( $payload['state'] ) : '',
			'zip'     => ! empty( $payload['zip'] ) ? sanitize_text_field( $payload['zip'] ) : '',
			'country' => ! empty( $payload['country'] ) ? sanitize_text_field( $payload['country'] ) : '',
		];

		$custom_data = [
			'father_name'              => $father_name,
			'father_phone'             => $father_phone,
			'father_email'             => $father_email,
			'father_occupation'        => $father_occ,
			'mother_name'              => $mother_name,
			'mother_phone'             => $mother_phone,
			'mother_email'             => $mother_email,
			'mother_occupation'        => $mother_occ,
			'guardian_other_name'      => $other_name,
			'guardian_other_phone'     => $other_phone,
			'guardian_other_email'     => $other_email,
			'guardian_other_rel'       => $other_rel,
			'primary_communication'    => $primary_comm,
			'guardian_relationship'    => $relationship,
			'previous_school_name'     => ! empty( $payload['previous_school_name'] ) ? sanitize_text_field( $payload['previous_school_name'] ) : '',
			'previous_grade_completed' => ! empty( $payload['previous_grade_completed'] ) ? sanitize_text_field( $payload['previous_grade_completed'] ) : '',
			'blood_group'              => ! empty( $payload['blood_group'] ) ? sanitize_text_field( $payload['blood_group'] ) : '',
			'nationality'              => ! empty( $payload['nationality'] ) ? sanitize_text_field( $payload['nationality'] ) : '',
			'remarks'                  => ! empty( $payload['remarks'] ) ? sanitize_textarea_field( $payload['remarks'] ) : '',
		];

		$is_inquiry  = ( $payload['status'] ?? '' ) === 'inquiry';
		$status      = $is_inquiry ? 'inquiry' : 'submitted';
		$source      = ! empty( $payload['source'] ) ? sanitize_text_field( $payload['source'] ) : ( $is_inquiry ? 'inquiry_form' : 'public_form' );

		$insert_data = [
			'reference_number'      => $ref_number,
			'academic_unit_id'      => ! empty( $payload['academic_unit_id'] ) ? (int) $payload['academic_unit_id'] : null,
			'student_first_name'    => sanitize_text_field( $payload['student_first_name'] ),
			'student_middle_name'   => ! empty( $payload['student_middle_name'] ) ? sanitize_text_field( $payload['student_middle_name'] ) : '',
			'student_last_name'     => sanitize_text_field( $payload['student_last_name'] ),
			'student_date_of_birth' => ! empty( $payload['student_date_of_birth'] ) ? sanitize_text_field( $payload['student_date_of_birth'] ) : null,
			'student_gender'        => ! empty( $payload['student_gender'] ) ? sanitize_text_field( $payload['student_gender'] ) : 'male',
			'guardian_name'         => $guardian_name,
			'guardian_email'        => $guardian_email,
			'guardian_phone'        => $guardian_phone,
			'address_json'          => wp_json_encode( $address_data ),
			'custom_fields_json'    => wp_json_encode( $custom_data ),
			'status'                => $status,
			'source'                => $source,
			'created_at'            => $now,
			'updated_at'            => $now,
		];

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->insert( Schema::applications(), $insert_data );
		// phpcs:enable

		if ( ! $result ) {
			Logger::error( 'Failed to submit public admission application', $wpdb->last_error );
			return new WP_Error( 'codeclove_db_error', __( 'Failed to save application to database.', 'codeclove-school-management' ), 500 );
		}

		$app_id = (int) $wpdb->insert_id;

		$this->db_create_status_event( [
			'application_id' => $app_id,
			'from_status'    => null,
			'to_status'      => $status,
			'reason'         => $is_inquiry ? 'Inquiry Submitted' : 'Public Submission',
			'message'        => $is_inquiry ? 'Inquiry submitted via public website form.' : 'Application submitted via public website form.',
			'visibility'     => 'public',
			'changed_at'     => $now,
		] );

		$app    = $this->db_get_application( $app_id );
		$mapped = $this->map_application( $app );

		do_action( 'codeclove_admission_received', $app_id, $mapped );

		return $mapped;
	}

	/**
	 * Looks up application status by reference number and student date of birth.
	 *
	 * @param string $reference_number
	 * @param string $dob
	 * @return array|WP_Error
	 */
	public function lookup_application_status( string $reference_number, string $dob = '' ): array|WP_Error {
		global $wpdb;
		$table       = Schema::applications();
		$units_table = Schema::units();

		$ref_clean = sanitize_text_field( $reference_number );
		$dob_clean = sanitize_text_field( $dob );

		if ( empty( $ref_clean ) || empty( $dob_clean ) ) {
			return new WP_Error( 'codeclove_validation_failed', __( 'Both reference number and date of birth are required.', 'codeclove-school-management' ), 400 );
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Public lookup of application with academic unit.
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT a.*, u.name as academic_unit_name 
		          FROM %i a 
		          LEFT JOIN %i u ON a.academic_unit_id = u.id 
		          WHERE a.reference_number = %s AND a.student_date_of_birth = %s AND a.deleted_at IS NULL',
				Schema::applications(),
				Schema::units(),
				$ref_clean,
				$dob_clean
			),
			ARRAY_A
		);

		if ( ! is_array( $row ) ) {
			return new WP_Error( 'codeclove_not_found', __( 'No matching application found with those credentials.', 'codeclove-school-management' ), 404 );
		}

		$all_events = $this->db_get_status_events( (int) $row['id'] );
		$public_events = array_values( array_filter( $all_events, static function( $e ) {
			return ( $e['visibility'] ?? 'internal' ) === 'public';
		} ) );

		// Filter out sensitive internal actor names/IDs from public responses.
		$safe_history = array_map( static function( $e ) {
			return [
				'from_status' => $e['from_status'] ?? null,
				'to_status'   => $e['to_status'],
				'reason'      => $e['reason'] ?? '',
				'message'     => $e['message'] ?? '',
				'changed_at'  => $e['changed_at'],
			];
		}, $public_events );

		return [
			'id'                 => (int) $row['id'],
			'reference_number'   => $row['reference_number'],
			'student_first_name' => $row['student_first_name'],
			'student_last_name'  => $row['student_last_name'],
			'academic_unit_name' => ! empty( $row['academic_unit_name'] ) ? $row['academic_unit_name'] : 'N/A',
			'status'             => $row['status'],
			'created_at'         => $row['created_at'],
			'updated_at'         => $row['updated_at'],
			'status_history'     => $safe_history,
		];
	}

	/**
	 * Updates application details.
	 *
	 * @param int   $id
	 * @param array $payload
	 * @return array|WP_Error
	 */
	public function update_application( int $id, array $payload ): array|WP_Error {
		$app = $this->db_get_application( $id );
		if ( null === $app ) {
			return new WP_Error( 'codeclove_not_found', __( 'Application not found.', 'codeclove-school-management' ), 404 );
		}

		$validated = $this->validate_application_payload( $payload );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$updated = $this->db_update_application( $id, $validated );
		if ( ! $updated ) {
			return new WP_Error( 'codeclove_update_failed', __( 'Failed to update application.', 'codeclove-school-management' ), 500 );
		}

		$new_app = $this->db_get_application( $id );
		return $this->map_application( $new_app );
	}

	/**
	 * Transitions application pipeline status and logs event.
	 *
	 * @param int    $id
	 * @param string $to_status
	 * @param string $reason
	 * @param string $message
	 * @param int    $changed_by
	 * @return array|WP_Error
	 */
	public function update_application_status(
		int $id,
		string $to_status,
		string $reason = '',
		string $message = '',
		int $changed_by = 0
	): array|WP_Error {
		$app = $this->db_get_application( $id );
		if ( null === $app ) {
			return new WP_Error( 'codeclove_not_found', __( 'Application not found.', 'codeclove-school-management' ), 404 );
		}

		$from_status = $app['status'];
		if ( $from_status === $to_status ) {
			return $this->map_application( $app );
		}

		// Update database status field
		$data = [
			'status'     => $to_status,
			'updated_at' => current_time( 'mysql', true ),
		];

		if ( 'submitted' === $to_status && empty( $app['submitted_at'] ) ) {
			$data['submitted_at'] = current_time( 'mysql', true );
		} elseif ( 'under_review' === $to_status && empty( $app['reviewed_at'] ) ) {
			$data['reviewed_at'] = current_time( 'mysql', true );
		} elseif ( in_array( $to_status, [ 'accepted', 'rejected', 'waitlisted', 'admitted' ], true ) && empty( $app['decision_at'] ) ) {
			$data['decision_at'] = current_time( 'mysql', true );
		}

		$updated = $this->db_update_application( $id, $data );
		if ( ! $updated ) {
			return new WP_Error( 'codeclove_status_failed', __( 'Failed to update status.', 'codeclove-school-management' ), 500 );
		}

		// Log status audit event
		$event = [
			'application_id' => $id,
			'from_status'    => $from_status,
			'to_status'      => $to_status,
			'reason'         => sanitize_text_field( $reason ),
			'message'        => sanitize_textarea_field( $message ),
			'visibility'     => 'internal',
			'changed_by'     => $changed_by,
			'changed_at'     => current_time( 'mysql', true ),
		];

		$this->db_create_status_event( $event );

		$new_app = $this->db_get_application( $id );
		$mapped_app = $this->map_application( $new_app );

		do_action( 'codeclove_admission_status_changed', $id, $to_status, $from_status, $mapped_app );

		return $mapped_app;
	}

	/**
	 * Maps database row to clean front-end API format contract.
	 *
	 * @param array $app
	 * @return array
	 */
	public function map_application( array $app ): array {
		return [
			'id'                      => (int) $app['id'],
			'reference_number'        => $app['reference_number'],
			'status'                  => $app['status'],
			'source'                  => $app['source'],
			'academic_session_id'     => $app['academic_session_id'] !== null ? (int) $app['academic_session_id'] : null,
			'academic_unit_id'        => $app['academic_unit_id'] !== null ? (int) $app['academic_unit_id'] : null,
			'academic_group_id'       => $app['academic_group_id'] !== null ? (int) $app['academic_group_id'] : null,
			'student_first_name'      => $app['student_first_name'],
			'student_middle_name'     => $app['student_middle_name'] ?: '',
			'student_last_name'       => $app['student_last_name'],
			'student_preferred_name'  => $app['student_preferred_name'] ?: '',
			'student_date_of_birth'   => $app['student_date_of_birth'] ?: '',
			'student_gender'          => $app['student_gender'] ?: '',
			'guardian_name'           => $app['guardian_name'],
			'guardian_email'          => $app['guardian_email'],
			'guardian_phone'          => $app['guardian_phone'] ?: '',
			'address_json'            => $app['address_json'] ?: '',
			'custom_fields_json'      => $app['custom_fields_json'] ?: '',
			'student_photo_id'        => $app['student_photo_id'] !== null ? (int) $app['student_photo_id'] : null,
			'student_photo_url'       => ( $app['student_photo_id'] !== null ? wp_get_attachment_image_url( (int) $app['student_photo_id'], 'medium' ) : null ) ?: CODECLOVE_URL . 'assets/defaults/avatar.svg',
			'submitted_at'            => $app['submitted_at'] ?: $app['created_at'], // ponytail: fallback to creation timestamp if unpopulated
			'reviewed_at'             => $app['reviewed_at'] ?: '',
			'decision_at'             => $app['decision_at'] ?: '',
			'converted_student_id'    => $app['converted_student_id'] !== null ? (int) $app['converted_student_id'] : null,
			'converted_guardian_id'   => $app['converted_guardian_id'] !== null ? (int) $app['converted_guardian_id'] : null,
			'converted_enrollment_id' => $app['converted_enrollment_id'] !== null ? (int) $app['converted_enrollment_id'] : null,
			'status_history'          => $this->db_get_status_events( (int) $app['id'] ),
			'created_at'              => $app['created_at'],
			'updated_at'              => $app['updated_at'],
		];
	}

	/**
	 * Validates edit request fields.
	 *
	 * @param array $payload
	 * @return array|WP_Error
	 */
	private function validate_application_payload( array $payload ): array|WP_Error {
		$clean = [];

		if ( isset( $payload['student_first_name'] ) ) {
			$clean['student_first_name'] = sanitize_text_field( $payload['student_first_name'] );
			if ( empty( $clean['student_first_name'] ) ) {
				return new WP_Error( 'validation_failed', __( 'First name is required.', 'codeclove-school-management' ), 400 );
			}
		}

		if ( isset( $payload['student_middle_name'] ) ) {
			$clean['student_middle_name'] = sanitize_text_field( $payload['student_middle_name'] );
		}

		if ( isset( $payload['student_last_name'] ) ) {
			$clean['student_last_name'] = sanitize_text_field( $payload['student_last_name'] );
			if ( empty( $clean['student_last_name'] ) ) {
				return new WP_Error( 'validation_failed', __( 'Last name is required.', 'codeclove-school-management' ), 400 );
			}
		}

		if ( isset( $payload['student_date_of_birth'] ) ) {
			$clean['student_date_of_birth'] = sanitize_text_field( $payload['student_date_of_birth'] );
		}

		if ( isset( $payload['student_gender'] ) ) {
			$clean['student_gender'] = sanitize_text_field( $payload['student_gender'] );
		}

		if ( isset( $payload['academic_session_id'] ) ) {
			$clean['academic_session_id'] = (int) $payload['academic_session_id'];
		}

		if ( isset( $payload['academic_unit_id'] ) ) {
			$clean['academic_unit_id'] = (int) $payload['academic_unit_id'];
		}

		if ( isset( $payload['guardian_name'] ) ) {
			$clean['guardian_name'] = sanitize_text_field( $payload['guardian_name'] );
			if ( empty( $clean['guardian_name'] ) ) {
				return new WP_Error( 'validation_failed', __( 'Guardian name is required.', 'codeclove-school-management' ), 400 );
			}
		}

		if ( isset( $payload['guardian_email'] ) ) {
			$clean['guardian_email'] = sanitize_email( $payload['guardian_email'] );
			if ( empty( $clean['guardian_email'] ) || ! is_email( $clean['guardian_email'] ) ) {
				return new WP_Error( 'validation_failed', __( 'A valid email address is required.', 'codeclove-school-management' ), 400 );
			}
		}

		if ( isset( $payload['guardian_phone'] ) ) {
			$clean['guardian_phone'] = sanitize_text_field( $payload['guardian_phone'] );
		}

		if ( isset( $payload['student_photo_id'] ) ) {
			$clean['student_photo_id'] = empty( $payload['student_photo_id'] ) ? null : (int) $payload['student_photo_id'];
		}

		if ( isset( $payload['address_json'] ) ) {
			$clean['address_json'] = is_array( $payload['address_json'] ) ? wp_json_encode( $payload['address_json'] ) : sanitize_text_field( $payload['address_json'] );
		}

		if ( isset( $payload['custom_fields_json'] ) ) {
			$clean['custom_fields_json'] = is_array( $payload['custom_fields_json'] ) ? wp_json_encode( $payload['custom_fields_json'] ) : sanitize_text_field( $payload['custom_fields_json'] );
		}

		$clean['updated_at'] = current_time( 'mysql', true );

		return $clean;
	}

	/**
	 * Converts an admission application to a registered student record inside a transaction.
	 *
	 * @param int   $id
	 * @param array $params
	 * @return array|WP_Error
	 */
	public function convert_application( int $id, array $params ): array|WP_Error {
		$app = $this->db_get_application( $id );
		if ( null === $app ) {
			return new WP_Error( 'codeclove_not_found', __( 'Application not found.', 'codeclove-school-management' ), 404 );
		}

		if ( ! empty( $app['converted_student_id'] ) ) {
			return new WP_Error( 'already_converted', __( 'This application has already been converted to a student.', 'codeclove-school-management' ), 400 );
		}

		$session_id  = (int) ( $params['session_id'] ?? 0 );
		$unit_id     = (int) ( $params['unit_id'] ?? 0 );
		$group_id    = ! empty( $params['group_id'] ) ? (int) $params['group_id'] : null;
		$guardian_id = ! empty( $params['guardian_id'] ) ? (int) $params['guardian_id'] : null;

		if ( ! $session_id || ! $unit_id ) {
			return new WP_Error( 'validation_failed', __( 'Session ID and Class Level ID are required for conversion.', 'codeclove-school-management' ), 400 );
		}

		// Validation check: ensure essential applicant and parent details exist before converting
		if ( empty( $app['student_first_name'] ) || empty( $app['student_last_name'] ) || empty( $app['guardian_name'] ) ) {
			return new WP_Error( 'incomplete_inquiry', __( 'Application is missing required student or contact details. Please edit and complete all application details first before converting to student.', 'codeclove-school-management' ), 400 );
		}

		$student_number = IdentifierService::generate( 'student_number' );
		if ( is_wp_error( $student_number ) ) {
			return $student_number;
		}

		$admission_number = IdentifierService::generate( 'admission_number' );
		if ( is_wp_error( $admission_number ) ) {
			return $admission_number;
		}

		return Transaction::run( function( $wpdb ) use ( $id, $app, $session_id, $unit_id, $group_id, $guardian_id, $student_number, $admission_number ) {
			$students_service = new \CodeClove\Modules\Students\StudentsService();

			$admission_date = ! empty( $app['submitted_at'] ) ? substr( (string) $app['submitted_at'], 0, 10 ) : substr( (string) $app['created_at'], 0, 10 );

			$student_id = $students_service->db_create_student( [
				'student_number'   => $student_number,
				'admission_number' => $admission_number,
				'first_name'       => $app['student_first_name'],
				'middle_name'      => $app['student_middle_name'] ?? '',
				'last_name'        => $app['student_last_name'],
				'date_of_birth'    => $app['student_date_of_birth'] ?? null,
				'gender'           => $app['student_gender'] ?: 'male',
				'admission_date'   => $admission_date,
				'photo_id'         => $app['student_photo_id'] ? (int) $app['student_photo_id'] : null,
				'address_json'     => $app['address_json'] ?? null,
				'status'           => 'active',
				'created_at'       => current_time( 'mysql', true ),
				'updated_at'       => current_time( 'mysql', true ),
			] );

			if ( ! $student_id ) {
				throw new \Exception( esc_html__( 'Failed to create student record during conversion.', 'codeclove-school-management' ) );
			}

			// 2. Extract and transfer comprehensive parent & guardian details (Father, Mother, Legal Guardian)
			$custom = ! empty( $app['custom_fields_json'] ) ? json_decode( $app['custom_fields_json'], true ) : [];
			if ( ! is_array( $custom ) ) { $custom = []; }

			$split_name = function( string $full ) {
				$full = trim( $full );
				if ( empty( $full ) ) return [ '', '' ];
				$parts = explode( ' ', $full );
				$first = $parts[0];
				$last  = count( $parts ) > 1 ? implode( ' ', array_slice( $parts, 1 ) ) : 'Parent';
				return [ $first, $last ];
			};

			$father_raw = $custom['father_name'] ?? '';
			$mother_raw = $custom['mother_name'] ?? '';
			$other_raw  = $custom['guardian_other_name'] ?? '';

			$parent_payload = [
				'father_first_name' => $split_name( $father_raw )[0],
				'father_last_name'  => $split_name( $father_raw )[1],
				'father_email'      => $custom['father_email'] ?? '',
				'father_phone'      => $custom['father_phone'] ?? '',
				'father_occupation' => $custom['father_occupation'] ?? '',

				'mother_first_name' => $split_name( $mother_raw )[0],
				'mother_last_name'  => $split_name( $mother_raw )[1],
				'mother_email'      => $custom['mother_email'] ?? '',
				'mother_phone'      => $custom['mother_phone'] ?? '',
				'mother_occupation' => $custom['mother_occupation'] ?? '',

				'link_existing_guardian' => ! empty( $guardian_id ),
				'guardian_id'            => $guardian_id,
				'guardian_first_name'    => ! empty( $other_raw ) ? $split_name( $other_raw )[0] : ( empty( $father_raw ) && empty( $mother_raw ) ? $split_name( $app['guardian_name'] )[0] : '' ),
				'guardian_last_name'     => ! empty( $other_raw ) ? $split_name( $other_raw )[1] : ( empty( $father_raw ) && empty( $mother_raw ) ? $split_name( $app['guardian_name'] )[1] : '' ),
				'guardian_email'         => ! empty( $custom['guardian_other_email'] ) ? $custom['guardian_other_email'] : $app['guardian_email'],
				'guardian_phone'         => ! empty( $custom['guardian_other_phone'] ) ? $custom['guardian_other_phone'] : ( $app['guardian_phone'] ?? '' ),
				'relationship'           => $custom['guardian_other_rel'] ?? ( $custom['guardian_other_relationship'] ?? 'guardian' ),
			];

			// Call student parents saver to populate codeclove_guardians & codeclove_student_guardians
			$students_service->save_student_parents( $student_id, $parent_payload );

			// Retrieve primary guardian ID for application reference linking
			$primary_guardians  = $students_service->db_get_student_guardians( $student_id );
			$linked_guardian_id = $guardian_id ? $guardian_id : ( ! empty( $primary_guardians[0]['id'] ) ? (int) $primary_guardians[0]['id'] : null );

			// 3. Create active academic session placement/enrollment record (Class & Section)
			$total_enrolled = $students_service->db_count_students( [
				'academic_session_id' => $session_id,
				'academic_unit_id'    => $unit_id,
			] );
			$roll_number = 'R' . str_pad( (string) ( $total_enrolled + 1 ), 2, '0', STR_PAD_LEFT );

			$enrollment_id = $students_service->db_create_enrollment( [
				'student_id'          => $student_id,
				'academic_session_id' => $session_id,
				'academic_unit_id'    => $unit_id,
				'academic_group_id'   => $group_id,
				'roll_number'         => $roll_number,
				'starts_on'           => current_time( 'mysql', true ),
				'status'              => 'active',
				'created_at'          => current_time( 'mysql', true ),
				'updated_at'          => current_time( 'mysql', true ),
			] );

			if ( ! $enrollment_id ) {
				throw new \Exception( esc_html__( 'Failed to create student enrollment during conversion.', 'codeclove-school-management' ) );
			}

			// 4. Update the Admissions application with status 'admitted' and links
			$updated = $this->db_update_application( $id, [
				'status'                  => 'admitted',
				'converted_student_id'    => $student_id,
				'converted_guardian_id'   => $linked_guardian_id,
				'converted_enrollment_id' => $enrollment_id,
				'decision_at'             => current_time( 'mysql', true ),
				'updated_at'              => current_time( 'mysql', true ),
			] );

			if ( ! $updated ) {
				throw new \Exception( esc_html__( 'Failed to update admissions application reference columns.', 'codeclove-school-management' ) );
			}

			// 5. Log status event
			$this->db_create_status_event( [
				'application_id' => $id,
				'from_status'    => $app['status'] ?? null,
				'to_status'      => 'admitted',
				'reason'         => 'Application Converted',
				'message'        => 'Application converted to enrolled student.',
				'visibility'     => 'internal',
				'changed_by'     => get_current_user_id() ?: null,
				'changed_at'     => current_time( 'mysql', true ),
			] );

			return $this->db_get_application( $id );
		} );
	}

	/**
	 * Performs bulk actions on admissions applications.
	 *
	 * @param array $payload Payload (action, status, ids).
	 * @return array|WP_Error
	 */
	public function bulk_action( array $payload ): array|WP_Error {
		global $wpdb;
		$action = $payload['action'] ?? '';
		$ids    = $payload['ids'] ?? [];

		if ( empty( $ids ) || ! is_array( $ids ) ) {
			return new WP_Error( 'codeclove_invalid_ids', __( 'No IDs provided.', 'codeclove-school-management' ), 400 );
		}

		$ids = array_map( 'intval', $ids );

		if ( 'status' === $action ) {
			$status = $payload['status'] ?? '';
			if ( ! in_array( $status, [ 'inquiry', 'submitted', 'under_review', 'more_info_needed', 'interview_scheduled', 'accepted', 'waitlisted', 'rejected', 'admitted', 'withdrawn' ], true ) ) {
				return new WP_Error( 'codeclove_invalid_status', __( 'Invalid status provided.', 'codeclove-school-management' ), 400 );
			}
			$table = Schema::applications();
			$updated = 0;
			foreach ( $ids as $id ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Custom database table update.
				$result = $wpdb->update(
					$table,
					[ 'status' => $status ],
					[ 'id' => (int) $id ],
					[ '%s' ],
					[ '%d' ]
				);
				if ( false !== $result ) {
					$updated++;
				}
			}
			return [ 'success' => true, 'updated_count' => $updated ];
		}

		if ( 'convert' === $action ) {
			$session_id = isset( $payload['session_id'] ) ? (int) $payload['session_id'] : 0;
			$unit_id    = isset( $payload['unit_id'] ) ? (int) $payload['unit_id'] : 0;
			$group_id   = ! empty( $payload['group_id'] ) ? (int) $payload['group_id'] : null;

			if ( ! $session_id || ! $unit_id ) {
				return new WP_Error( 'validation_failed', __( 'Session ID and Class Level ID are required for conversion.', 'codeclove-school-management' ), 400 );
			}

			$success_count = 0;
			$errors = [];
			foreach ( $ids as $id ) {
				$res = $this->convert_application( $id, [
					'session_id' => $session_id,
					'unit_id'    => $unit_id,
					'group_id'   => $group_id,
				] );
				if ( is_wp_error( $res ) ) {
					$errors[] = "ID {$id}: " . $res->get_error_message();
				} else {
					$success_count++;
				}
			}
			return [
				'success'       => true,
				'updated_count' => $success_count,
				'errors'        => $errors,
			];
		}

		if ( 'delete' === $action ) {
			$errors = [];
			$deleted_count = 0;
			foreach ( $ids as $id ) {
				$res = $this->db_delete_application( $id );
				if ( ! $res ) {
					$errors[] = "ID {$id}: Failed to delete application.";
				} else {
					$deleted_count++;
				}
			}
			if ( ! empty( $errors ) && 0 === $deleted_count ) {
				return new WP_Error( 'codeclove_bulk_delete_failed', implode( '; ', $errors ), 400 );
			}
			return [
				'success'       => true,
				'deleted_count' => $deleted_count,
				'errors'        => $errors,
			];
		}

		return new WP_Error( 'codeclove_invalid_action', __( 'Invalid bulk action.', 'codeclove-school-management' ), 400 );
	}

	// ─── Database Operations ─────────────────────────────────────────────────

	/**
	 * Gets applications matching the filters.
	 */
	private function db_get_applications( array $args = [] ): array {
		global $wpdb;

		$defaults = [
			'limit'               => 25,
			'offset'              => 0,
			'search'              => '',
			'status'              => '',
			'academic_session_id' => null,
			'academic_unit_id'    => null,
			'orderby'             => '',
			'order'               => '',
		];
		$params = array_merge( $defaults, $args );

		$table = Schema::applications();
		$query = 'SELECT * FROM %i WHERE deleted_at IS NULL';
		$binds = [ $table ];

		if ( '' !== $params['status'] ) {
			$query   .= ' AND status = %s';
			$binds[] = $params['status'];
		}

		if ( null !== $params['academic_session_id'] && 0 !== $params['academic_session_id'] ) {
			$query   .= ' AND academic_session_id = %d';
			$binds[] = (int) $params['academic_session_id'];
		}

		if ( null !== $params['academic_unit_id'] && 0 !== $params['academic_unit_id'] ) {
			$query   .= ' AND academic_unit_id = %d';
			$binds[] = (int) $params['academic_unit_id'];
		}

		if ( ! empty( $params['date_from'] ) ) {
			$query   .= ' AND DATE(COALESCE(submitted_at, created_at)) >= %s';
			$binds[] = $params['date_from'];
		}

		if ( ! empty( $params['date_to'] ) ) {
			$query   .= ' AND DATE(COALESCE(submitted_at, created_at)) <= %s';
			$binds[] = $params['date_to'];
		}

		if ( '' !== $params['search'] ) {
			$query   .= ' AND (student_first_name LIKE %s OR student_last_name LIKE %s OR reference_number LIKE %s OR guardian_name LIKE %s)';
			$like    = '%' . $wpdb->esc_like( $params['search'] ) . '%';
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
		}

		$orderby = ! empty( $params['orderby'] ) ? sanitize_text_field( $params['orderby'] ) : 'created_at';
		$order   = ! empty( $params['order'] ) && in_array( strtolower( $params['order'] ), [ 'asc', 'desc' ], true ) ? strtoupper( $params['order'] ) : 'DESC';

		$orderby_whitelist = [
			'student_first_name' => 'student_first_name',
			'reference_number'   => 'reference_number',
			'submitted_at'       => 'submitted_at',
			'status'             => 'status',
			'created_at'         => 'created_at',
		];

		$orderby_sql = isset( $orderby_whitelist[ $orderby ] ) ? $orderby_whitelist[ $orderby ] : 'created_at';

		$query   .= " ORDER BY {$orderby_sql} {$order}, id DESC";
		$query   .= ' LIMIT %d OFFSET %d';
		$binds[] = (int) $params['limit'];
		$binds[] = (int) $params['offset'];

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$results = $wpdb->get_results(
			$wpdb->prepare( $query, ...$binds ),
			ARRAY_A
		);
		// phpcs:enable

		return is_array( $results ) ? $results : [];
	}

	/**
	 * Counts applications matching the filters.
	 */
	private function db_count_applications( array $args = [] ): int {
		global $wpdb;

		$table = Schema::applications();
		$query = 'SELECT COUNT(*) FROM %i WHERE deleted_at IS NULL';
		$binds = [ $table ];

		if ( ! empty( $args['status'] ) ) {
			$query   .= ' AND status = %s';
			$binds[] = $args['status'];
		}

		if ( ! empty( $args['academic_session_id'] ) ) {
			$query   .= ' AND academic_session_id = %d';
			$binds[] = (int) $args['academic_session_id'];
		}

		if ( ! empty( $args['academic_unit_id'] ) ) {
			$query   .= ' AND academic_unit_id = %d';
			$binds[] = (int) $args['academic_unit_id'];
		}

		if ( ! empty( $args['date_from'] ) ) {
			$query   .= ' AND DATE(COALESCE(submitted_at, created_at)) >= %s';
			$binds[] = $args['date_from'];
		}

		if ( ! empty( $args['date_to'] ) ) {
			$query   .= ' AND DATE(COALESCE(submitted_at, created_at)) <= %s';
			$binds[] = $args['date_to'];
		}

		if ( ! empty( $args['search'] ) ) {
			$query   .= ' AND (student_first_name LIKE %s OR student_last_name LIKE %s OR reference_number LIKE %s OR guardian_name LIKE %s)';
			$like    = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
		$count = $wpdb->get_var( $wpdb->prepare( $query, ...$binds ) );
		// phpcs:enable

		return (int) $count;
	}

	/**
	 * Gets a single application by ID.
	 */
	private function db_get_application( int $id ): ?array {
		global $wpdb;
		$table = Schema::applications();

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Single admission application lookup.
		$row = $wpdb->get_row(
			$wpdb->prepare( 'SELECT * FROM %i WHERE id = %d AND deleted_at IS NULL', Schema::applications(), $id ),
			ARRAY_A
		);

		return is_array( $row ) ? $row : null;
	}

	/**
	 * Updates an application.
	 */
	private function db_update_application( int $id, array $data ): bool {
		global $wpdb;
		$table = Schema::applications();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->update(
			$table,
			$data,
			[ 'id' => $id ]
		);
		// phpcs:enable

		if ( false === $result ) {
			Logger::error( sprintf( 'Failed to update application record [ID %d]', $id ), $wpdb->last_error );
			return false;
		}

		return true;
	}

	/**
	 * Log application status event.
	 */
	private function db_create_status_event( array $event ): ?int {
		global $wpdb;
		$table = Schema::app_events();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->insert( $table, $event );
		// phpcs:enable

		if ( ! $result ) {
			Logger::error( 'Failed to insert admission status event', $wpdb->last_error );
			return null;
		}

		return (int) $wpdb->insert_id;
	}

	/**
	 * Get status events for an application.
	 */
	private function db_get_status_events( int $app_id ): array {
		global $wpdb;
		$table = Schema::app_events();

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Admission application status events query.
		$results = $wpdb->get_results(
			$wpdb->prepare( 'SELECT * FROM %i WHERE application_id = %d ORDER BY changed_at ASC', Schema::app_events(), $app_id ),
			ARRAY_A
		);

		if ( ! is_array( $results ) ) {
			return [];
		}

		return array_map( function( $e ) {
			$user_id = ! empty( $e['changed_by'] ) ? (int) $e['changed_by'] : 0;
			$user    = $user_id ? get_userdata( $user_id ) : null;
			$e['actor_name'] = $user ? $user->display_name : ( 'submitted' === $e['to_status'] && empty( $e['from_status'] ) ? 'System Auto' : 'Staff Administrator' ); // ponytail: simple actor name resolution
			return $e;
		}, $results );
	}

	/**
	 * Soft deletes an admission application.
	 */
	private function db_delete_application( int $id ): bool {
		global $wpdb;
		$table = Schema::applications();
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->update(
			$table,
			[ 'deleted_at' => gmdate( 'Y-m-d H:i:s' ) ],
			[ 'id' => $id ]
		);
		// phpcs:enable
		return false !== $result;
	}
}
