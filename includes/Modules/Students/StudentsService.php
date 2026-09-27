<?php
/**
 * Students service.
 *
 * Implements business logic and validation rules for students, guardians, and enrollments.
 *
 * @package Nexora\Modules\Students
 */

declare( strict_types=1 );

namespace Nexora\Modules\Students;

use Nexora\Core\Logger;
use Nexora\Database\Schema;
use Nexora\Database\Transaction;
use WP_Error;
use Nexora\Shared\IdentifierService;

/**
 * Class StudentsService
 */
final class StudentsService {

	/**
	 * Gets students with filters and pagination.
	 *
	 * @param array $args
	 * @return array{students: array, total: int}
	 */
	public function get_students( array $args = [] ): array {
		$students = $this->db_get_students( $args );
		$total    = $this->db_count_students( $args );

		$mapped = array_map( [ $this, 'map_student' ], $students );

		return [
			'students' => $mapped,
			'total'    => $total,
		];
	}

	/**
	 * Gets a single student profile by ID.
	 *
	 * @param int $id
	 * @return array|null
	 */
	public function get_student( int $id ): ?array {
		$student = $this->db_get_student( $id );
		return $student ? $this->map_student( $student ) : null;
	}

	/**
	 * Admits a new student record inside a database transaction.
	 *
	 * @param array $payload
	 * @return array|WP_Error
	 */
	public function create_student( array $payload ): array|WP_Error {
		$validated = $this->validate_admit_payload( $payload );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		return Transaction::run( function() use ( $validated ) {
			// 1. Generate unique identifiers and write student record
			$student_number   = IdentifierService::generate( 'student_number' );
			$admission_number = ! empty( $validated['admission_number'] ) ? $validated['admission_number'] : IdentifierService::generate( 'admission_number' );

			$student_data = [
				'student_number'   => $student_number,
				'admission_number' => $admission_number,
				'first_name'       => $validated['first_name'],
				'middle_name'      => $validated['middle_name'] ?? '',
				'last_name'        => $validated['last_name'],
				'date_of_birth'    => $validated['date_of_birth'] ?? null,
				'gender'           => $validated['gender'] ?? 'male',
				'admission_date'   => $validated['admission_date'] ?? null,
				'graduation_year'  => $validated['graduation_year'] ?? null,
				'address_json'     => $validated['address_json'] ?? null,
				'status'           => 'active',
				'created_at'       => current_time( 'mysql', true ),
				'updated_at'       => current_time( 'mysql', true ),
			];
			if ( isset( $validated['photo_id'] ) ) {
				$student_data['photo_id'] = $validated['photo_id'];
			}

			$student_id = $this->db_create_student( $student_data );

			if ( ! $student_id ) {
				return new WP_Error( 'insert_failed', __( 'Failed to create student record.', 'nexora-school-management' ), 500 );
			}

			// Save normalized subjects
			if ( ! empty( $validated['subject_ids'] ) && is_array( $validated['subject_ids'] ) ) {
				$this->db_update_student_subjects( $student_id, $validated['subject_ids'] );
			}

			// 2. Create or link guardians (Father & Mother)
			$this->save_student_parents( $student_id, $validated );

			// 3. Create active academic session placement/enrollment record
			$total_enrolled = $this->db_count_students( [
				'academic_session_id' => $validated['academic_session_id'],
				'academic_unit_id'    => $validated['academic_unit_id'],
			] );
			$roll_number = 'R' . str_pad( (string) ( $total_enrolled + 1 ), 2, '0', STR_PAD_LEFT );

			$enrollment_id = $this->db_create_enrollment( [
				'student_id'          => $student_id,
				'academic_session_id' => $validated['academic_session_id'],
				'academic_unit_id'    => $validated['academic_unit_id'],
				'academic_group_id'   => $validated['academic_group_id'] ?? null,
				'roll_number'         => $roll_number,
				'starts_on'           => current_time( 'mysql', true ),
				'status'              => 'active',
				'created_at'          => current_time( 'mysql', true ),
				'updated_at'          => current_time( 'mysql', true ),
			] );

			if ( ! $enrollment_id ) {
				return new WP_Error( 'insert_failed', __( 'Failed to create student enrollment.', 'nexora-school-management' ), 500 );
			}

			return $this->get_student( $student_id );
		} );
	}

	/**
	 * Updates a student and links guardian inside a transaction.
	 *
	 * @param int   $id
	 * @param array $payload
	 * @return array|WP_Error
	 */
	public function update_student( int $id, array $payload ): array|WP_Error {
		$student = $this->db_get_student( $id );
		if ( null === $student ) {
			return new WP_Error( 'nexora_not_found', __( 'Student not found.', 'nexora-school-management' ), 404 );
		}

		$validated = $this->validate_update_payload( $payload, $id );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		return Transaction::run( function() use ( $id, $validated ) {
			// 1. Update Student Profile
			$student_data = [
				'first_name'      => $validated['first_name'],
				'middle_name'     => $validated['middle_name'] ?? '',
				'last_name'       => $validated['last_name'],
				'date_of_birth'   => $validated['date_of_birth'] ?? null,
				'gender'          => $validated['gender'] ?? 'male',
				'admission_date'  => $validated['admission_date'] ?? null,
				'graduation_year' => $validated['graduation_year'] ?? null,
				'address_json'    => $validated['address_json'] ?? null,
				'updated_at'      => current_time( 'mysql', true ),
			];
			if ( isset( $validated['admission_number'] ) && '' !== $validated['admission_number'] ) {
				$student_data['admission_number'] = $validated['admission_number'];
			}
			if ( isset( $validated['status'] ) ) {
				$student_data['status'] = $validated['status'];
			}
			if ( array_key_exists( 'photo_id', $validated ) ) {
				$student_data['photo_id'] = $validated['photo_id'];
			}

			$this->db_update_student( $id, $student_data );

			// Save normalized subjects
			$this->db_update_student_subjects( $id, $validated['subject_ids'] ?? [] );

			// 2. Update Enrollment active group (Section) or level
			$active_enrollment = $this->db_get_active_enrollment( $id );
			if ( $active_enrollment ) {
				$enrollment_data = [
					'academic_unit_id'  => $validated['academic_unit_id'],
					'academic_group_id' => $validated['academic_group_id'] ?? null,
					'updated_at'        => current_time( 'mysql', true ),
				];
				$this->db_update_enrollment( (int) $active_enrollment['id'], $enrollment_data );
			}

			// 3. Save both Father and Mother details in guardians/student_guardians
			$this->save_student_parents( $id, $validated );

			return $this->get_student( $id );
		} );
	}

	/**
	 * Returns active enrollment counts grouped by group ID.
	 *
	 * @return array
	 */
	public function get_group_enrollment_counts(): array {
		$counts = $this->db_get_group_enrollment_counts();
		$map    = [];

		foreach ( $counts as $row ) {
			$map[ (int) $row['academic_group_id'] ] = (int) $row['active_count'];
		}

		return $map;
	}

	/**
	 * Returns all active guardians.
	 *
	 * @return array
	 */
	public function get_guardians(): array {
		$guardians = $this->db_get_guardians();
		return array_map( function ( $g ) {
			return [
				'id'         => (int) $g['id'],
				'first_name' => $g['first_name'],
				'last_name'  => $g['last_name'],
				'email'      => $g['email'],
				'phone'      => $g['phone'] ?: '',
				'status'     => $g['status'],
			];
		}, $guardians );
	}

	/**
	 * Creates a WordPress portal user account for a student or guardian.
	 *
	 * @param int    $entity_id   Student or Guardian ID.
	 * @param string $entity_type 'student' or 'guardian'.
	 * @param array  $data        Optional payload: username, email, password, send_email.
	 * @return array{user_id: int, username: string, email: string}|WP_Error
	 */
	public function create_portal_account( int $entity_id, string $entity_type, array $data = [] ): array|WP_Error {
		global $wpdb;

		if ( ! in_array( $entity_type, [ 'student', 'guardian' ], true ) ) {
			return new WP_Error( 'invalid_type', __( 'Invalid entity type. Must be student or guardian.', 'nexora-school-management' ), 400 );
		}

		if ( ! function_exists( 'wp_insert_user' ) ) {
			require_once ABSPATH . 'wp-includes/user.php';
		}
		if ( ! function_exists( 'wp_generate_password' ) ) {
			require_once ABSPATH . 'wp-includes/pluggable.php';
		}

		if ( 'student' === $entity_type ) {
			$entity = $this->db_get_student( $entity_id );
			if ( ! $entity ) {
				return new WP_Error( 'not_found', __( 'Student not found.', 'nexora-school-management' ), 404 );
			}
			$table = Schema::students();
			$role  = 'nexora_student';

			$first_name     = $entity['first_name'] ?? '';
			$last_name      = $entity['last_name'] ?? '';
			$existing_email = $entity['email'] ?? '';
			$default_base   = ! empty( $entity['admission_number'] )
				? $entity['admission_number']
				: ( ! empty( $entity['student_number'] ) ? $entity['student_number'] : $first_name . $last_name );
		} else {
			$entity = $this->db_get_guardian_by_id( $entity_id );
			if ( ! $entity ) {
				return new WP_Error( 'not_found', __( 'Guardian not found.', 'nexora-school-management' ), 404 );
			}
			$table = Schema::guardians();
			$role  = 'nexora_guardian';

			$first_name     = $entity['first_name'] ?? '';
			$last_name      = $entity['last_name'] ?? '';
			$existing_email = $entity['email'] ?? '';
			$default_base   = $first_name . $last_name;
		}

		// If user_id is already set and user exists in WP
		if ( ! empty( $entity['user_id'] ) ) {
			$existing_wp_user = get_userdata( (int) $entity['user_id'] );
			if ( $existing_wp_user ) {
				return new WP_Error(
					'account_exists',
					sprintf( 'A portal account (%s) is already linked to this %s.', $existing_wp_user->user_login, $entity_type ),
					400
				);
			}
		}

		// 1. Resolve Username
		if ( ! empty( $data['username'] ) ) {
			$username = sanitize_user( (string) $data['username'], true );
			if ( ! validate_username( $username ) ) {
				return new WP_Error( 'invalid_username', __( 'The provided username contains invalid characters.', 'nexora-school-management' ), 400 );
			}
			if ( username_exists( $username ) ) {
				return new WP_Error( 'username_exists', __( 'This username is already registered in WordPress.', 'nexora-school-management' ), 400 );
			}
		} else {
			$clean_base = strtolower( preg_replace( '/[^a-zA-Z0-9_.-]/', '', (string) $default_base ) );
			if ( empty( $clean_base ) ) {
				$clean_base = $entity_type . '_' . $entity_id;
			}
			$username = $clean_base;
			$suffix   = 1;
			while ( username_exists( $username ) ) {
				$username = $clean_base . $suffix;
				$suffix++;
			}
		}

		// 2. Resolve Email
		$host = wp_parse_url( home_url(), PHP_URL_HOST ) ?: 'portal.local';
		if ( ! empty( $data['email'] ) ) {
			$email = sanitize_email( (string) $data['email'] );
			if ( ! is_email( $email ) ) {
				return new WP_Error( 'invalid_email', __( 'The provided email address is invalid.', 'nexora-school-management' ), 400 );
			}
		} elseif ( ! empty( $existing_email ) && is_email( $existing_email ) ) {
			$email = sanitize_email( $existing_email );
		} else {
			$email = sanitize_email( "{$username}@{$host}" );
		}

		$existing_email_user_id = email_exists( $email );
		if ( $existing_email_user_id ) {
			return new WP_Error( 'email_exists', __( 'This email address is already in use by another WordPress user.', 'nexora-school-management' ), 400 );
		}

		// 3. Password
		$password = ! empty( $data['password'] ) ? (string) $data['password'] : wp_generate_password( 18, true, true );

		// 4. Create WP User
		$user_id = wp_insert_user( [
			'user_login'   => $username,
			'user_pass'    => $password,
			'user_email'   => $email,
			'first_name'   => $first_name,
			'last_name'    => $last_name,
			'display_name' => trim( "$first_name $last_name" ) ?: $username,
			'role'         => $role,
		] );

		if ( is_wp_error( $user_id ) ) {
			return $user_id;
		}

		$user = get_userdata( $user_id );
		if ( $user && ! in_array( $role, (array) $user->roles, true ) ) {
			$user->set_role( $role );
		}

		// 5. Update user_id on entity table
		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$wpdb->update(
			$table,
			[
				'user_id'    => $user_id,
				'updated_at' => current_time( 'mysql', true ),
			],
			[ 'id' => $entity_id ],
			[ '%d', '%s' ],
			[ '%d' ]
		);
		// phpcs:enable

		// Also update email on record if empty
		if ( empty( $existing_email ) && ! empty( $data['email'] ) && is_email( $data['email'] ) ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery
			$wpdb->update(
				$table,
				[ 'email' => $email ],
				[ 'id' => $entity_id ],
				[ '%s' ],
				[ '%d' ]
			);
			// phpcs:enable
		}

		// 6. Optional Notification Email
		if ( ! empty( $data['send_email'] ) && function_exists( 'wp_new_user_notification' ) ) {
			wp_new_user_notification( $user_id, null, 'user' );
		}

		Logger::info(
			sprintf( 'Created portal account user #%d (%s) for %s #%d', $user_id, $username, $entity_type, $entity_id ),
			[ 'user_id' => $user_id, 'entity_type' => $entity_type, 'entity_id' => $entity_id ]
		);

		return [
			'user_id'  => (int) $user_id,
			'username' => $username,
			'email'    => $email,
			'password' => $password,
		];
	}

	/**
	 * Unlinks a WordPress portal account from a student or guardian.
	 *
	 * @param int    $entity_id   Student or Guardian ID.
	 * @param string $entity_type 'student' or 'guardian'.
	 * @return bool|WP_Error
	 */
	public function unlink_portal_account( int $entity_id, string $entity_type ): bool|WP_Error {
		global $wpdb;

		if ( ! in_array( $entity_type, [ 'student', 'guardian' ], true ) ) {
			return new WP_Error( 'invalid_type', __( 'Invalid entity type. Must be student or guardian.', 'nexora-school-management' ), 400 );
		}

		$table = 'student' === $entity_type ? Schema::students() : Schema::guardians();

		// Check existence
		if ( 'student' === $entity_type ) {
			$entity = $this->db_get_student( $entity_id );
		} else {
			$entity = $this->db_get_guardian_by_id( $entity_id );
		}

		if ( ! $entity ) {
			return new WP_Error( 'not_found', ucfirst( $entity_type ) . ' not found.', 404 );
		}

		// Set user_id = NULL
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->query(
			$wpdb->prepare(
				'UPDATE ' . ( 'student' === $entity_type ? Schema::students() : Schema::guardians() ) . ' SET user_id = NULL, updated_at = %s WHERE id = %d',
				current_time( 'mysql', true ),
				$entity_id
			)
		);
		// phpcs:enable

		Logger::info(
			sprintf( 'Unlinked portal account for %s #%d', $entity_type, $entity_id ),
			[ 'entity_type' => $entity_type, 'entity_id' => $entity_id ]
		);

		return true;
	}

	/**
	 * Maps raw database joins to front-end DTO shape contracts.
	 *
	 * @param array $row
	 * @return array
	 */
	public function map_student( array $row ): array {
		$user_id        = ! empty( $row['user_id'] ) ? (int) $row['user_id'] : null;
		$portal_account = null;
		if ( $user_id ) {
			$wp_user = get_userdata( $user_id );
			if ( $wp_user ) {
				$portal_account = [
					'user_id'  => (int) $wp_user->ID,
					'username' => $wp_user->user_login,
					'email'    => $wp_user->user_email,
				];
			}
		}

		$student = [
			'id'               => (int) $row['id'],
			'user_id'          => $user_id,
			'portal_account'   => $portal_account,
			'student_number'   => $row['student_number'],
			'admission_number' => $row['admission_number'],
			'first_name'       => $row['first_name'],
			'middle_name'      => $row['middle_name'] ?: '',
			'last_name'        => $row['last_name'],
			'preferred_name'   => $row['preferred_name'] ?: '',
			'date_of_birth'    => $row['date_of_birth'] ?: '',
			'gender'           => strtolower( $row['gender'] ?: 'male' ),
			'admission_date'   => $row['admission_date'] ?: '',
			'graduation_year'  => $row['graduation_year'] !== null ? (int) $row['graduation_year'] : null,
			'photo_id'         => $row['photo_id'] !== null ? (int) $row['photo_id'] : null,
			'photo_url'        => ( $row['photo_id'] !== null ? wp_get_attachment_image_url( (int) $row['photo_id'], 'medium' ) : null ) ?: NEXORA_URL . 'assets/defaults/avatar.svg',
			'status'           => $row['status'],
			'created_at'       => $row['created_at'],
			'updated_at'       => $row['updated_at'],
			'email'            => $row['email'] ?? '',
			'phone'            => $row['phone'] ?? '',
		];

		// Decode address
		$address = [
			'address'     => '',
			'city'        => '',
			'state'       => '',
			'postal_code' => '',
			'country'     => '',
		];
		if ( ! empty( $row['address_json'] ) ) {
			$decoded = json_decode( $row['address_json'], true );
			if ( is_array( $decoded ) ) {
				$address = array_merge( $address, $decoded );
				if ( empty( $address['postal_code'] ) && ! empty( $decoded['zip_code'] ) ) {
					$address['postal_code'] = $decoded['zip_code'];
				}
				unset( $address['zip_code'] );
			}
		}
		foreach ( $address as $key => $val ) {
			$student[ $key ] = $val;
		}

		// Decode subjects (now loaded from normalized student_subjects table)
		$student_id             = (int) $row['id'];
		$student['subject_ids'] = $this->db_get_student_subject_ids( $student_id );

		// Decode enrollments across all sessions
		$enrollments            = $this->db_get_student_enrollments( $student_id );
		$student['enrollments'] = $enrollments;

		if ( ! empty( $row['enrollment_id'] ) ) {
			$student['enrollment'] = [
				'id'                  => (int) $row['enrollment_id'],
				'student_id'          => (int) $row['id'],
				'academic_session_id' => (int) $row['academic_session_id'],
				'academic_unit_id'    => (int) $row['academic_unit_id'],
				'academic_group_id'   => $row['academic_group_id'] !== null ? (int) $row['academic_group_id'] : null,
				'unit_name'           => $row['unit_name'] ?? null,
				'group_name'          => $row['group_name'] ?? null,
				'roll_number'         => $row['roll_number'] ?: '',
				'starts_on'           => $row['starts_on'],
				'status'              => $row['enrollment_status'],
			];
		} elseif ( ! empty( $enrollments ) ) {
			// Fallback to latest historical enrollment
			$student['enrollment'] = $enrollments[0];
		}

		// Fetch all guardians for detailed parent mapping
		$guardians = $this->db_get_student_guardians( (int) $row['id'] );
		
		$student['father']           = null;
		$student['mother']           = null;
		$student['guardians']        = [];
		$student['primary_guardian'] = null;
		foreach ( $guardians as $g ) {
			$g_user_id = ! empty( $g['user_id'] ) ? (int) $g['user_id'] : null;
			$g_portal  = null;
			if ( $g_user_id ) {
				$wp_u = get_userdata( $g_user_id );
				if ( $wp_u ) {
					$g_portal = [
						'user_id'  => (int) $wp_u->ID,
						'username' => $wp_u->user_login,
						'email'    => $wp_u->user_email,
					];
				}
			}

			$guardian_mapped = [
				'id'             => (int) $g['id'],
				'user_id'        => $g_user_id,
				'portal_account' => $g_portal,
				'first_name'     => $g['first_name'],
				'last_name'      => $g['last_name'],
				'email'          => $g['email'] ?: '',
				'phone'          => $g['phone'] ?: '',
				'occupation'     => $g['occupation'] ?: '',
				'status'         => $g['status'],
				'relationship'   => $g['relationship'] ?? '',
			];

			$student['guardians'][] = $guardian_mapped;

			if ( ! empty( $g['is_primary'] ) && null === $student['primary_guardian'] ) {
				$student['primary_guardian'] = $guardian_mapped;
			}

			if ( 'Father' === $g['relationship'] ) {
				$student['father'] = $guardian_mapped;
			} elseif ( 'Mother' === $g['relationship'] ) {
				$student['mother'] = $guardian_mapped;
			}
		}

		// Map other guardian (not Father/Mother)
		$has_other_guardian = false;
		foreach ( $guardians as $g ) {
			if ( 'Father' !== $g['relationship'] && 'Mother' !== $g['relationship'] ) {
				$g_user_id = ! empty( $g['user_id'] ) ? (int) $g['user_id'] : null;
				$g_portal  = null;
				if ( $g_user_id ) {
					$wp_u = get_userdata( $g_user_id );
					if ( $wp_u ) {
						$g_portal = [
							'user_id'  => (int) $wp_u->ID,
							'username' => $wp_u->user_login,
							'email'    => $wp_u->user_email,
						];
					}
				}

				$student['guardian'] = [
					'id'             => (int) $g['id'],
					'user_id'        => $g_user_id,
					'portal_account' => $g_portal,
					'first_name'     => $g['first_name'],
					'last_name'      => $g['last_name'],
					'email'          => $g['email'] ?: '',
					'phone'          => $g['phone'] ?: '',
					'status'         => $g['status'],
				];
				$student['relationship'] = $g['relationship'];
				$has_other_guardian = true;
				break;
			}
		}

		if ( ! $has_other_guardian ) {
			$student['guardian']     = null;
			$student['relationship'] = '';
		}

		if ( null === $student['primary_guardian'] ) {
			$student['primary_guardian'] = $student['father'] ?? $student['mother'] ?? $student['guardian'] ?? null;
		}

		return $student;
	}

	/**
	 * Validates student creation payloads.
	 *
	 * @param array $payload
	 * @return array|WP_Error
	 */
	private function validate_admit_payload( array $payload, bool $is_update = false, ?int $student_id = null ): array|WP_Error {
		$clean = [];

		if ( empty( $payload['first_name'] ) ) {
			return new WP_Error( 'validation_failed', __( 'First name is required.', 'nexora-school-management' ), 400 );
		}
		$clean['first_name'] = sanitize_text_field( $payload['first_name'] );

		$clean['middle_name'] = isset( $payload['middle_name'] ) ? sanitize_text_field( $payload['middle_name'] ) : '';

		if ( empty( $payload['last_name'] ) ) {
			return new WP_Error( 'validation_failed', __( 'Last name is required.', 'nexora-school-management' ), 400 );
		}
		$clean['last_name'] = sanitize_text_field( $payload['last_name'] );

		$clean['date_of_birth'] = isset( $payload['date_of_birth'] ) ? sanitize_text_field( $payload['date_of_birth'] ) : '';
		$clean['gender']        = isset( $payload['gender'] ) ? strtolower( sanitize_text_field( $payload['gender'] ) ) : 'male';

		if ( isset( $payload['photo_id'] ) ) {
			$clean['photo_id'] = empty( $payload['photo_id'] ) ? null : (int) $payload['photo_id'];
		}

		if ( ! $is_update ) {
			if ( empty( $payload['academic_session_id'] ) ) {
				return new WP_Error( 'validation_failed', __( 'Session is required.', 'nexora-school-management' ), 400 );
			}
			$clean['academic_session_id'] = (int) $payload['academic_session_id'];
		} else {
			if ( isset( $payload['academic_session_id'] ) ) {
				$clean['academic_session_id'] = (int) $payload['academic_session_id'];
			}
		}

		if ( empty( $payload['academic_unit_id'] ) ) {
			return new WP_Error( 'validation_failed', __( 'Class Level is required.', 'nexora-school-management' ), 400 );
		}
		$clean['academic_unit_id'] = (int) $payload['academic_unit_id'];

		if ( isset( $payload['academic_group_id'] ) ) {
			$clean['academic_group_id'] = $payload['academic_group_id'] ? (int) $payload['academic_group_id'] : null;
		}

		// Ensure at least Father, Mother, or Legal Guardian details are provided
		$has_father   = ! empty( $payload['father_first_name'] );
		$has_mother   = ! empty( $payload['mother_first_name'] );
		$has_guardian = ! empty( $payload['link_existing_guardian'] ) 
			? ! empty( $payload['guardian_id'] ) 
			: ( ! empty( $payload['guardian_first_name'] ) && ! empty( $payload['guardian_last_name'] ) );

		if ( ! $has_father && ! $has_mother && ! $has_guardian ) {
			return new WP_Error( 'validation_failed', __( 'At least Father, Mother, or Legal Guardian details must be provided.', 'nexora-school-management' ), 400 );
		}

		$clean['link_existing_guardian'] = ! empty( $payload['link_existing_guardian'] );
		if ( $clean['link_existing_guardian'] ) {
			$clean['guardian_id'] = isset( $payload['guardian_id'] ) ? (int) $payload['guardian_id'] : null;
		} else {
			if ( ! empty( $payload['guardian_first_name'] ) ) {
				$clean['guardian_first_name'] = sanitize_text_field( $payload['guardian_first_name'] );
				if ( empty( $payload['guardian_last_name'] ) ) {
					return new WP_Error( 'validation_failed', __( 'Guardian last name is required.', 'nexora-school-management' ), 400 );
				}
				$clean['guardian_last_name'] = sanitize_text_field( $payload['guardian_last_name'] );
				
				if ( ! empty( $payload['guardian_email'] ) ) {
					if ( ! is_email( $payload['guardian_email'] ) ) {
						return new WP_Error( 'validation_failed', __( 'Guardian email address is invalid.', 'nexora-school-management' ), 400 );
					}
					$clean['guardian_email'] = sanitize_email( $payload['guardian_email'] );
				} else {
					$clean['guardian_email'] = '';
				}
				$clean['guardian_phone'] = isset( $payload['guardian_phone'] ) ? sanitize_text_field( $payload['guardian_phone'] ) : '';
			}
		}
		$clean['relationship'] = isset( $payload['relationship'] ) ? sanitize_text_field( $payload['relationship'] ) : 'guardian';

		// New Student-level fields
		$clean['admission_date'] = isset( $payload['admission_date'] ) ? sanitize_text_field( $payload['admission_date'] ) : null;
		$clean['graduation_year'] = isset( $payload['graduation_year'] ) ? (int) $payload['graduation_year'] : null;
		$clean['admission_number'] = isset( $payload['admission_number'] ) ? sanitize_text_field( $payload['admission_number'] ) : '';

		if ( ! empty( $clean['admission_number'] ) ) {
			$existing = $this->db_get_student_by_admission_number( $clean['admission_number'] );
			if ( $existing && ( ! $is_update || (int) $existing['id'] !== $student_id ) ) {
				return new WP_Error( 'validation_failed', __( 'Admission ID already in use.', 'nexora-school-management' ), 400 );
			}
		}

		// Address fields -> serialized as address_json
		if ( isset( $payload['address'] ) || isset( $payload['city'] ) || isset( $payload['state'] ) || isset( $payload['postal_code'] ) || isset( $payload['zip_code'] ) || isset( $payload['country'] ) ) {
			$p_code = isset( $payload['postal_code'] ) ? sanitize_text_field( $payload['postal_code'] ) : ( isset( $payload['zip_code'] ) ? sanitize_text_field( $payload['zip_code'] ) : '' );
			$address_data = [
				'address'     => isset( $payload['address'] ) ? sanitize_textarea_field( $payload['address'] ) : '',
				'city'        => isset( $payload['city'] ) ? sanitize_text_field( $payload['city'] ) : '',
				'state'       => isset( $payload['state'] ) ? sanitize_text_field( $payload['state'] ) : '',
				'postal_code' => $p_code,
				'country'     => isset( $payload['country'] ) ? sanitize_text_field( $payload['country'] ) : '',
			];
			$clean['address_json'] = wp_json_encode( $address_data );
		} else {
			$clean['address_json'] = null;
		}

		// Subject IDs -> array of integers
		if ( isset( $payload['subject_ids'] ) && is_array( $payload['subject_ids'] ) ) {
			$clean['subject_ids'] = array_map( 'intval', $payload['subject_ids'] );
		} else {
			$clean['subject_ids'] = [];
		}

		// Father Details
		if ( ! empty( $payload['father_first_name'] ) ) {
			$clean['father_first_name'] = sanitize_text_field( $payload['father_first_name'] );
			if ( empty( $payload['father_last_name'] ) ) {
				return new WP_Error( 'validation_failed', __( 'Father last name is required.', 'nexora-school-management' ), 400 );
			}
			$clean['father_last_name'] = sanitize_text_field( $payload['father_last_name'] );
			
			if ( ! empty( $payload['father_email'] ) ) {
				if ( ! is_email( $payload['father_email'] ) ) {
					return new WP_Error( 'validation_failed', __( 'Father email address is invalid.', 'nexora-school-management' ), 400 );
				}
				$clean['father_email'] = sanitize_email( $payload['father_email'] );
			} else {
				$clean['father_email'] = '';
			}
			$clean['father_phone']      = isset( $payload['father_phone'] ) ? sanitize_text_field( $payload['father_phone'] ) : '';
			$clean['father_occupation'] = isset( $payload['father_occupation'] ) ? sanitize_text_field( $payload['father_occupation'] ) : '';
		}

		// Mother Details
		if ( ! empty( $payload['mother_first_name'] ) ) {
			$clean['mother_first_name'] = sanitize_text_field( $payload['mother_first_name'] );
			if ( empty( $payload['mother_last_name'] ) ) {
				return new WP_Error( 'validation_failed', __( 'Mother last name is required.', 'nexora-school-management' ), 400 );
			}
			$clean['mother_last_name'] = sanitize_text_field( $payload['mother_last_name'] );
			
			if ( ! empty( $payload['mother_email'] ) ) {
				if ( ! is_email( $payload['mother_email'] ) ) {
					return new WP_Error( 'validation_failed', __( 'Mother email address is invalid.', 'nexora-school-management' ), 400 );
				}
				$clean['mother_email'] = sanitize_email( $payload['mother_email'] );
			} else {
				$clean['mother_email'] = '';
			}
			$clean['mother_phone']      = isset( $payload['mother_phone'] ) ? sanitize_text_field( $payload['mother_phone'] ) : '';
			$clean['mother_occupation'] = isset( $payload['mother_occupation'] ) ? sanitize_text_field( $payload['mother_occupation'] ) : '';
		}

		return $clean;
	}

	/**
	 * Validates student update payloads.
	 *
	 * @param array $payload
	 * @return array|WP_Error
	 */
	private function validate_update_payload( array $payload, int $student_id ): array|WP_Error {
		$clean = $this->validate_admit_payload( $payload, true, $student_id );
		if ( is_wp_error( $clean ) ) {
			return $clean;
		}

		if ( isset( $payload['status'] ) ) {
			$clean['status'] = sanitize_text_field( $payload['status'] );
		}

		return $clean;
	}

	/**
	 * Performs bulk actions on students.
	 *
	 * @param array $payload Payload (action, status, ids).
	 * @return array|WP_Error
	 */
	public function bulk_action( array $payload ): array|WP_Error {
		global $wpdb;
		$action = $payload['action'] ?? '';
		$ids    = $payload['ids'] ?? [];

		if ( empty( $ids ) || ! is_array( $ids ) ) {
			return new WP_Error( 'nexora_invalid_ids', __( 'No IDs provided.', 'nexora-school-management' ), 400 );
		}

		$ids = array_map( 'intval', $ids );
		$table = Schema::students();

		if ( 'status' === $action ) {
			$status = $payload['status'] ?? '';
			if ( ! in_array( $status, [ 'active', 'inactive', 'graduated', 'withdrawn' ], true ) ) {
				return new WP_Error( 'nexora_invalid_status', __( 'Invalid status provided.', 'nexora-school-management' ), 400 );
			}
			$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$wpdb->query(
				$wpdb->prepare(
					'UPDATE ' . Schema::students() . " SET status = %s WHERE id IN ($placeholders)",
					$status,
					...$ids
				)
			);
			// phpcs:enable
			return [ 'success' => true, 'updated_count' => count( $ids ) ];
		}

		if ( 'assign_section' === $action ) {
			$unit_id  = isset( $payload['unit_id'] ) ? (int) $payload['unit_id'] : 0;
			$group_id = ! empty( $payload['group_id'] ) ? (int) $payload['group_id'] : null;

			if ( ! $unit_id ) {
				return new WP_Error( 'validation_failed', __( 'Class Level ID is required for section assignment.', 'nexora-school-management' ), 400 );
			}

			$success_count = 0;
			$errors = [];
			foreach ( $ids as $id ) {
				$enrollment = $this->db_get_active_enrollment( $id );
				if ( $enrollment ) {
					$updated = $this->db_update_enrollment( (int) $enrollment['id'], [
						'academic_unit_id'  => $unit_id,
						'academic_group_id' => $group_id,
					] );
					if ( $updated ) {
						$success_count++;
					} else {
						$errors[] = "ID {$id}: Failed to update enrollment.";
					}
				} else {
					$session_id = isset( $payload['session_id'] ) ? (int) $payload['session_id'] : 0;
					if ( ! $session_id ) {
						// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Custom database table query.
						$session_id = (int) $wpdb->get_var(
							$wpdb->prepare(
								'SELECT id FROM %i WHERE status = %s LIMIT 1',
								Schema::sessions(),
								'active'
							)
						);
					}
					if ( $session_id ) {
						$enroll_id = $this->db_create_enrollment( [
							'student_id'          => $id,
							'academic_session_id' => $session_id,
							'academic_unit_id'    => $unit_id,
							'academic_group_id'   => $group_id,
							'starts_on'           => gmdate( 'Y-m-d' ),
							'status'              => 'active',
						] );
						if ( $enroll_id ) {
							$success_count++;
						} else {
							$errors[] = "ID {$id}: Failed to create new enrollment.";
						}
					} else {
						$errors[] = "ID {$id}: No active enrollment found and session is not specified.";
					}
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
				$res = $this->db_delete_student( $id );
				if ( ! $res ) {
					$errors[] = "ID {$id}: Failed to delete student.";
				} else {
					$deleted_count++;
				}
			}
			if ( ! empty( $errors ) && 0 === $deleted_count ) {
				return new WP_Error( 'nexora_bulk_delete_failed', implode( '; ', $errors ), 400 );
			}
			return [
				'success'       => true,
				'deleted_count' => $deleted_count,
				'errors'        => $errors,
			];
		}

		return new WP_Error( 'nexora_invalid_action', __( 'Invalid bulk action.', 'nexora-school-management' ), 400 );
	}

	/**
	 * Saves student father and mother guardian records and links them.
	 *
	 * @param int   $student_id Student ID.
	 * @param array $validated  Validated payload.
	 * @return void
	 */
	public function save_student_parents( int $student_id, array $validated ): void {
		$existing_guardians = $this->db_get_student_guardians( $student_id );
		
		$father_guardian_id = null;
		$mother_guardian_id = null;
		$other_guardian_id  = null;
		
		foreach ( $existing_guardians as $eg ) {
			if ( 'Father' === $eg['relationship'] ) {
				$father_guardian_id = (int) $eg['id'];
			} elseif ( 'Mother' === $eg['relationship'] ) {
				$mother_guardian_id = (int) $eg['id'];
			} else {
				$other_guardian_id = (int) $eg['id'];
				// Clear the junction link first so we can re-create or clean up
				global $wpdb;
				$student_guardians_table = Schema::student_guardians();
				// phpcs:disable WordPress.DB.DirectDatabaseQuery
				$wpdb->delete( $student_guardians_table, [
					'student_id'  => $student_id,
					'guardian_id' => $other_guardian_id,
				] );
				// phpcs:enable
			}
		}

		// 1. Father Details
		if ( ! empty( $validated['father_first_name'] ) ) {
			$father_data = [
				'first_name' => $validated['father_first_name'],
				'last_name'  => $validated['father_last_name'] ?? '',
				'email'      => $validated['father_email'] ?? '',
				'phone'      => $validated['father_phone'] ?? '',
				'occupation' => $validated['father_occupation'] ?? '',
				'status'     => 'active',
				'updated_at' => current_time( 'mysql', true ),
			];
			if ( $father_guardian_id ) {
				$this->db_update_guardian( $father_guardian_id, $father_data );
			} else {
				$father_data['created_at'] = current_time( 'mysql', true );
				$father_guardian_id = $this->db_create_guardian( $father_data );
				if ( $father_guardian_id ) {
					$this->db_link_student_guardian( [
						'student_id'           => $student_id,
						'guardian_id'          => $father_guardian_id,
						'relationship'         => 'Father',
						'is_primary'           => 1,
						'is_billing_contact'   => 1,
						'is_emergency_contact' => 1,
						'created_at'           => current_time( 'mysql', true ),
					] );
				}
			}
		}

		// 2. Mother Details
		if ( ! empty( $validated['mother_first_name'] ) ) {
			$mother_data = [
				'first_name' => $validated['mother_first_name'],
				'last_name'  => $validated['mother_last_name'] ?? '',
				'email'      => $validated['mother_email'] ?? '',
				'phone'      => $validated['mother_phone'] ?? '',
				'occupation' => $validated['mother_occupation'] ?? '',
				'status'     => 'active',
				'updated_at' => current_time( 'mysql', true ),
			];
			if ( $mother_guardian_id ) {
				$this->db_update_guardian( $mother_guardian_id, $mother_data );
			} else {
				$mother_data['created_at'] = current_time( 'mysql', true );
				$mother_guardian_id = $this->db_create_guardian( $mother_data );
				if ( $mother_guardian_id ) {
					$this->db_link_student_guardian( [
						'student_id'           => $student_id,
						'guardian_id'          => $mother_guardian_id,
						'relationship'         => 'Mother',
						'is_primary'           => empty( $validated['father_first_name'] ) ? 1 : 0,
						'is_billing_contact'   => empty( $validated['father_first_name'] ) ? 1 : 0,
						'is_emergency_contact' => 1,
						'created_at'           => current_time( 'mysql', true ),
					] );
				}
			}
		}

		// 3. Other Legal Guardian Details
		if ( ! empty( $validated['link_existing_guardian'] ) && ! empty( $validated['guardian_id'] ) ) {
			$guardian_id = (int) $validated['guardian_id'];
			$this->db_link_student_guardian( [
				'student_id'           => $student_id,
				'guardian_id'          => $guardian_id,
				'relationship'         => $validated['relationship'] ?? 'guardian',
				'is_primary'           => ( empty( $validated['father_first_name'] ) && empty( $validated['mother_first_name'] ) ) ? 1 : 0,
				'is_billing_contact'   => ( empty( $validated['father_first_name'] ) && empty( $validated['mother_first_name'] ) ) ? 1 : 0,
				'is_emergency_contact' => 1,
				'created_at'           => current_time( 'mysql', true ),
			] );
		} elseif ( ! empty( $validated['guardian_first_name'] ) ) {
			$guardian_data = [
				'first_name' => $validated['guardian_first_name'],
				'last_name'  => $validated['guardian_last_name'] ?? '',
				'email'      => $validated['guardian_email'] ?? '',
				'phone'      => $validated['guardian_phone'] ?? '',
				'status'     => 'active',
				'updated_at' => current_time( 'mysql', true ),
			];
			if ( $other_guardian_id ) {
				$this->db_update_guardian( $other_guardian_id, $guardian_data );
				$guardian_id = $other_guardian_id;
			} else {
				$guardian_data['created_at'] = current_time( 'mysql', true );
				$guardian_id = $this->db_create_guardian( $guardian_data );
			}
			if ( $guardian_id ) {
				$this->db_link_student_guardian( [
					'student_id'           => $student_id,
					'guardian_id'          => $guardian_id,
					'relationship'         => $validated['relationship'] ?? 'guardian',
					'is_primary'           => ( empty( $validated['father_first_name'] ) && empty( $validated['mother_first_name'] ) ) ? 1 : 0,
					'is_billing_contact'   => ( empty( $validated['father_first_name'] ) && empty( $validated['mother_first_name'] ) ) ? 1 : 0,
					'is_emergency_contact' => 1,
					'created_at'           => current_time( 'mysql', true ),
				] );
			}
		}
	}

	// ─── Database Operations ─────────────────────────────────────────────────

	/**
	 * Gets students matching arguments.
	 */
	private function db_get_students( array $args = [] ): array {
		global $wpdb;

		$defaults = [
			'limit'               => 25,
			'offset'              => 0,
			'search'              => '',
			'status'              => '',
			'academic_session_id' => null,
			'academic_unit_id'    => null,
			'academic_group_id'   => null,
			'orderby'             => '',
			'order'               => '',
		];
		$params = array_merge( $defaults, $args );

		$has_session_filter = ( ! empty( $params['academic_session_id'] ) );
		$enrollment_join    = $has_session_filter
			? 'INNER JOIN ' . Schema::enrollments() . ' se ON se.student_id = s.id AND se.academic_session_id = %d'
			: 'LEFT JOIN ' . Schema::enrollments() . " se ON se.student_id = s.id AND se.status = 'active'";

		$query = 'SELECT s.*, 
			se.id as enrollment_id, se.academic_session_id, se.academic_unit_id, se.academic_group_id, se.roll_number, se.starts_on, se.status as enrollment_status,
			u.name as unit_name,
			grp.name as group_name,
			g.id as guardian_id, g.first_name as guardian_first_name, g.last_name as guardian_last_name, g.email as guardian_email, g.phone as guardian_phone,
			sg.relationship as guardian_relationship
			FROM ' . Schema::students() . " s
			{$enrollment_join}
			LEFT JOIN " . Schema::units() . ' u ON u.id = se.academic_unit_id
			LEFT JOIN ' . Schema::groups() . ' grp ON grp.id = se.academic_group_id
			LEFT JOIN ' . Schema::student_guardians() . ' sg ON sg.student_id = s.id AND sg.is_primary = 1
			LEFT JOIN ' . Schema::guardians() . ' g ON g.id = sg.guardian_id AND g.deleted_at IS NULL
			WHERE s.deleted_at IS NULL';
		$binds = [];

		if ( $has_session_filter ) {
			$binds[] = (int) $params['academic_session_id'];
		}

		if ( null !== $params['academic_unit_id'] && 0 !== $params['academic_unit_id'] ) {
			$query   .= ' AND se.academic_unit_id = %d';
			$binds[] = (int) $params['academic_unit_id'];
		}

		if ( null !== $params['academic_group_id'] && 0 !== $params['academic_group_id'] ) {
			$query   .= ' AND se.academic_group_id = %d';
			$binds[] = (int) $params['academic_group_id'];
		}

		if ( '' !== $params['status'] ) {
			$query   .= ' AND s.status = %s';
			$binds[] = $params['status'];
		}

		if ( '' !== $params['search'] ) {
			$query   .= ' AND (s.first_name LIKE %s OR s.last_name LIKE %s OR s.student_number LIKE %s OR se.roll_number LIKE %s OR g.first_name LIKE %s OR g.last_name LIKE %s)';
			$like    = '%' . $wpdb->esc_like( $params['search'] ) . '%';
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
		}

		$orderby = ! empty( $params['orderby'] ) ? sanitize_text_field( $params['orderby'] ) : 'created_at';
		$order   = ! empty( $params['order'] ) && in_array( strtolower( $params['order'] ), [ 'asc', 'desc' ], true ) ? strtoupper( $params['order'] ) : 'DESC';

		$orderby_whitelist = [
			'first_name'       => 's.first_name',
			'student_number'   => 's.student_number',
			'admission_number' => 's.admission_number',
			'created_at'       => 's.created_at',
			'status'           => 's.status',
		];

		$orderby_sql = isset( $orderby_whitelist[ $orderby ] ) ? $orderby_whitelist[ $orderby ] : 's.created_at';

		$query   .= " ORDER BY {$orderby_sql} {$order}, s.id DESC";
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
	 * Counts students matching the filters.
	 */
	public function db_count_students( array $args = [] ): int {
		global $wpdb;

		$has_session_filter = ( ! empty( $args['academic_session_id'] ) );
		$enrollment_join    = $has_session_filter
			? 'INNER JOIN ' . Schema::enrollments() . ' se ON se.student_id = s.id AND se.academic_session_id = %d'
			: 'LEFT JOIN ' . Schema::enrollments() . " se ON se.student_id = s.id AND se.status = 'active'";

		$query = 'SELECT COUNT(*) FROM ' . Schema::students() . " s
			{$enrollment_join}
			LEFT JOIN " . Schema::student_guardians() . ' sg ON sg.student_id = s.id AND sg.is_primary = 1
			LEFT JOIN ' . Schema::guardians() . ' g ON g.id = sg.guardian_id AND g.deleted_at IS NULL
			WHERE s.deleted_at IS NULL';
		$binds = [];

		if ( $has_session_filter ) {
			$binds[] = (int) $args['academic_session_id'];
		}

		if ( ! empty( $args['academic_unit_id'] ) ) {
			$query   .= ' AND se.academic_unit_id = %d';
			$binds[] = (int) $args['academic_unit_id'];
		}

		if ( ! empty( $args['academic_group_id'] ) ) {
			$query   .= ' AND se.academic_group_id = %d';
			$binds[] = (int) $args['academic_group_id'];
		}

		if ( ! empty( $args['status'] ) ) {
			$query   .= ' AND s.status = %s';
			$binds[] = $args['status'];
		}

		if ( ! empty( $args['search'] ) ) {
			$query   .= ' AND (s.first_name LIKE %s OR s.last_name LIKE %s OR s.student_number LIKE %s OR se.roll_number LIKE %s OR g.first_name LIKE %s OR g.last_name LIKE %s)';
			$like    = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$count = ! empty( $binds )
			? $wpdb->get_var( $wpdb->prepare( $query, ...$binds ) )
			: $wpdb->get_var( $query );
		// phpcs:enable

		return (int) $count;
	}

	/**
	 * Gets a single student by ID.
	 */
	private function db_get_student( int $id ): ?array {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT s.*, 
				se.id as enrollment_id, se.academic_session_id, se.academic_unit_id, se.academic_group_id, se.roll_number, se.starts_on, se.status as enrollment_status,
				u.name as unit_name,
				grp.name as group_name,
				g.id as guardian_id, g.first_name as guardian_first_name, g.last_name as guardian_last_name, g.email as guardian_email, g.phone as guardian_phone,
				sg.relationship as guardian_relationship
				FROM ' . Schema::students() . ' s
				LEFT JOIN ' . Schema::enrollments() . " se ON se.student_id = s.id AND se.status = 'active'
				LEFT JOIN " . Schema::units() . ' u ON u.id = se.academic_unit_id
				LEFT JOIN ' . Schema::groups() . ' grp ON grp.id = se.academic_group_id
				LEFT JOIN ' . Schema::student_guardians() . ' sg ON sg.student_id = s.id AND sg.is_primary = 1
				LEFT JOIN ' . Schema::guardians() . ' g ON g.id = sg.guardian_id AND g.deleted_at IS NULL
				WHERE s.id = %d AND s.deleted_at IS NULL LIMIT 1',
				$id
			),
			ARRAY_A
		);
		// phpcs:enable

		return is_array( $row ) ? $row : null;
	}

	/**
	 * Gets a student profile by their admission number.
	 */
	private function db_get_student_by_admission_number( string $admission_number ): ?array {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . Schema::students() . ' WHERE admission_number = %s AND deleted_at IS NULL LIMIT 1',
				$admission_number
			),
			ARRAY_A
		);
		// phpcs:enable

		return is_array( $row ) ? $row : null;
	}

	/**
	 * Creates a student base record.
	 */
	public function db_create_student( array $data ): ?int {
		global $wpdb;
		$table = Schema::students();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$result = $wpdb->insert( $table, $data );
		// phpcs:enable

		if ( ! $result ) {
			Logger::error( 'Failed to insert student record', $wpdb->last_error );
			return null;
		}

		return (int) $wpdb->insert_id;
	}

	/**
	 * Updates student base record.
	 */
	private function db_update_student( int $id, array $data ): bool {
		global $wpdb;
		$table = Schema::students();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$result = $wpdb->update( $table, $data, [ 'id' => $id ] );
		// phpcs:enable

		if ( false === $result ) {
			Logger::error( sprintf( 'Failed to update student record [ID %d]', $id ), $wpdb->last_error );
			return false;
		}

		return true;
	}

	/**
	 * Creates an enrollment record.
	 */
	public function db_create_enrollment( array $data ): ?int {
		global $wpdb;
		$table = Schema::enrollments();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$result = $wpdb->insert( $table, $data );
		// phpcs:enable

		return $result ? (int) $wpdb->insert_id : null;
	}

	/**
	 * Updates enrollment record.
	 */
	private function db_update_enrollment( int $id, array $data ): bool {
		global $wpdb;
		$table = Schema::enrollments();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$result = $wpdb->update( $table, $data, [ 'id' => $id ] );
		// phpcs:enable

		return false !== $result;
	}

	/**
	 * Gets active enrollment for a student.
	 */
	private function db_get_active_enrollment( int $student_id ): ?array {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . Schema::enrollments() . " WHERE student_id = %d AND status = 'active' LIMIT 1",
				$student_id
			),
			ARRAY_A
		);
		// phpcs:enable

		return is_array( $row ) ? $row : null;
	}

	/**
	 * Creates a guardian record.
	 */
	public function db_create_guardian( array $data ): ?int {
		global $wpdb;
		$table = Schema::guardians();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$result = $wpdb->insert( $table, $data );
		// phpcs:enable

		return $result ? (int) $wpdb->insert_id : null;
	}

	/**
	 * Updates a guardian record.
	 */
	private function db_update_guardian( int $id, array $data ): bool {
		global $wpdb;
		$table = Schema::guardians();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$result = $wpdb->update( $table, $data, [ 'id' => $id ] );
		// phpcs:enable

		return false !== $result;
	}

	/**
	 * Links student to a guardian.
	 */
	public function db_link_student_guardian( array $data ): ?int {
		global $wpdb;
		$table = Schema::student_guardians();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$result = $wpdb->insert( $table, $data );
		// phpcs:enable

		return $result ? (int) $wpdb->insert_id : null;
	}

	/**
	 * Removes linked guardians for a student.
	 */
	private function db_clear_student_guardians( int $student_id ): bool {
		global $wpdb;
		$table = Schema::student_guardians();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$result = $wpdb->delete( $table, [ 'student_id' => $student_id ] );
		// phpcs:enable

		return false !== $result;
	}

	/**
	 * Gets a guardian by primary ID.
	 *
	 * @param int $id
	 * @return array|null
	 */
	public function db_get_guardian_by_id( int $id ): ?array {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . Schema::guardians() . ' WHERE id = %d AND deleted_at IS NULL LIMIT 1',
				$id
			),
			ARRAY_A
		);
		// phpcs:enable

		return is_array( $row ) ? $row : null;
	}

	/**
	 * Gets a guardian by email.
	 */
	private function db_get_guardian_by_email( string $email ): ?array {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . Schema::guardians() . ' WHERE email = %s AND deleted_at IS NULL LIMIT 1',
				$email
			),
			ARRAY_A
		);
		// phpcs:enable

		return is_array( $row ) ? $row : null;
	}

	/**
	 * Gets all guardians.
	 */
	private function db_get_guardians(): array {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$results = $wpdb->get_results(
			'SELECT * FROM ' . Schema::guardians() . " WHERE status = 'active' AND deleted_at IS NULL ORDER BY last_name ASC, first_name ASC",
			ARRAY_A
		);
		// phpcs:enable

		return is_array( $results ) ? $results : [];
	}

	/**
	 * Gets active enrollment counts grouped by group ID.
	 */
	private function db_get_group_enrollment_counts(): array {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$results = $wpdb->get_results(
			'SELECT academic_group_id, COUNT(*) as active_count FROM ' . Schema::enrollments() . " WHERE status = 'active' AND academic_group_id IS NOT NULL GROUP BY academic_group_id",
			ARRAY_A
		);
		// phpcs:enable

		return is_array( $results ) ? $results : [];
	}

	/**
	 * Soft deletes a student.
	 */
	private function db_delete_student( int $id ): bool {
		global $wpdb;
		$table = Schema::students();
		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$result = $wpdb->update(
			$table,
			[ 'deleted_at' => gmdate( 'Y-m-d H:i:s' ) ],
			[ 'id' => $id ]
		);
		// phpcs:enable
		return false !== $result;
	}

	/**
	 * Gets all guardians linked to a student.
	 */
	public function db_get_student_guardians( int $student_id ): array {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT g.*, sg.relationship, sg.is_primary, sg.is_billing_contact, sg.is_emergency_contact
				FROM ' . Schema::guardians() . ' g
				INNER JOIN ' . Schema::student_guardians() . ' sg ON sg.guardian_id = g.id
				WHERE sg.student_id = %d AND g.deleted_at IS NULL
				ORDER BY sg.sort_order ASC',
				$student_id
			),
			ARRAY_A
		);
		// phpcs:enable

		return is_array( $rows ) ? $rows : [];
	}
	/**
	 * Gets all enrollment records for a student across all academic sessions.
	 *
	 * @param int $student_id
	 * @return array
	 */
	public function db_get_student_enrollments( int $student_id ): array {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT e.*, s.name as session_name, u.name as unit_name, g.name as group_name 
				FROM ' . Schema::enrollments() . ' e 
				JOIN ' . Schema::sessions() . ' s ON s.id = e.academic_session_id 
				JOIN ' . Schema::units() . ' u ON u.id = e.academic_unit_id 
				LEFT JOIN ' . Schema::groups() . ' g ON g.id = e.academic_group_id 
				WHERE e.student_id = %d 
				ORDER BY s.starts_on DESC, e.id DESC',
				$student_id
			),
			ARRAY_A
		);
		// phpcs:enable
		return is_array( $rows ) ? array_map( function( $r ) {
			$r['id']                  = (int) $r['id'];
			$r['student_id']          = (int) $r['student_id'];
			$r['academic_session_id'] = (int) $r['academic_session_id'];
			$r['academic_unit_id']    = (int) $r['academic_unit_id'];
			$r['academic_group_id']   = isset( $r['academic_group_id'] ) ? (int) $r['academic_group_id'] : null;
			return $r;
		}, $rows ) : [];
	}

	/**
	 * Gets subject IDs mapped to a student.
	 */
	private function db_get_student_subject_ids( int $student_id ): array {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$results = $wpdb->get_col(
			$wpdb->prepare(
				'SELECT subject_id FROM ' . Schema::student_subjects() . ' WHERE student_id = %d',
				$student_id
			)
		);
		// phpcs:enable

		return is_array( $results ) ? array_map( 'intval', $results ) : [];
	}

	/**
	 * Transfers a student's active enrollment to a different class/section within the same session.
	 *
	 * @param int   $student_id
	 * @param array $args { target_unit_id: int, target_group_id?: int|null, roll_number?: string }
	 * @return array|WP_Error
	 */
	public function transfer_student( int $student_id, array $args ): array|WP_Error {
		global $wpdb;
		$enrollments_table = Schema::enrollments();

		$target_unit_id  = isset( $args['target_unit_id'] ) ? (int) $args['target_unit_id'] : 0;
		$target_group_id = isset( $args['target_group_id'] ) ? (int) $args['target_group_id'] : null;
		$roll_number     = isset( $args['roll_number'] ) ? sanitize_text_field( $args['roll_number'] ) : null;

		if ( ! $target_unit_id ) {
			return new WP_Error( 'nexora_invalid_unit', __( 'Target class is required.', 'nexora-school-management' ), 400 );
		}

		// Fetch the student's current active enrollment.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$enrollment = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . Schema::enrollments() . " WHERE student_id = %d AND status = 'active' ORDER BY id DESC LIMIT 1",
				$student_id
			),
			ARRAY_A
		);
		// phpcs:enable

		if ( ! $enrollment ) {
			return new WP_Error( 'nexora_no_enrollment', __( 'Student has no active enrollment to transfer.', 'nexora-school-management' ), 404 );
		}

		// Validate target unit belongs to the same session.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$unit_session = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT academic_session_id FROM ' . Schema::units() . ' WHERE id = %d',
				$target_unit_id
			)
		);
		// phpcs:enable
		if ( (int) $unit_session !== (int) $enrollment['academic_session_id'] ) {
			return new WP_Error( 'nexora_invalid_unit', __( 'Target class must belong to the same academic session as the current enrollment.', 'nexora-school-management' ), 400 );
		}

		$update_data = [
			'academic_unit_id'  => $target_unit_id,
			'academic_group_id' => $target_group_id ?: null,
			'updated_at'        => gmdate( 'Y-m-d H:i:s' ),
		];

		if ( null !== $roll_number && '' !== $roll_number ) {
			$update_data['roll_number'] = $roll_number;
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$updated = $wpdb->update(
			$enrollments_table,
			$update_data,
			[ 'id' => (int) $enrollment['id'] ]
		);
		// phpcs:enable

		if ( false === $updated ) {
			return new WP_Error( 'nexora_transfer_failed', __( 'Failed to update enrollment record.', 'nexora-school-management' ), 500 );
		}

		$student = $this->get_student( $student_id );
		return $student ?? [];
	}

	/**
	 * Updates the subject mappings for a student.
	 */
	private function db_update_student_subjects( int $student_id, array $subject_ids ): void {
		global $wpdb;
		$table = Schema::student_subjects();

		// 1. Delete existing mappings
		// phpcs:disable WordPress.DB.DirectDatabaseQuery
		$wpdb->delete( $table, [ 'student_id' => $student_id ], [ '%d' ] );
		// phpcs:enable

		// 2. Insert new mappings
		foreach ( $subject_ids as $subject_id ) {
			$subject_id = (int) $subject_id;
			if ( $subject_id <= 0 ) {
				continue;
			}

			// phpcs:disable WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				$table,
				[
					'student_id' => $student_id,
					'subject_id' => $subject_id,
				],
				[ '%d', '%d' ]
			);
			// phpcs:enable
		}
	}

	/**
	 * Bulk imports students from an array of parsed row payloads.
	 *
	 * ponytail: simple loop over rows reusing create_student validation and database transaction logic.
	 *
	 * @param array $payload
	 * @return array|WP_Error
	 */
	public function import_students_bulk( array $payload ): array|WP_Error {
		if ( empty( $payload['academic_session_id'] ) || empty( $payload['academic_unit_id'] ) ) {
			return new WP_Error( 'validation_failed', __( 'Academic Session and Class Unit are required for bulk import.', 'nexora-school-management' ), 400 );
		}

		$rows = $payload['rows'] ?? [];
		if ( ! is_array( $rows ) || empty( $rows ) ) {
			return new WP_Error( 'validation_failed', __( 'No student rows provided for import.', 'nexora-school-management' ), 400 );
		}

		$session_id = (int) $payload['academic_session_id'];
		$unit_id    = (int) $payload['academic_unit_id'];
		$group_id   = ! empty( $payload['academic_group_id'] ) ? (int) $payload['academic_group_id'] : null;

		$imported_count = 0;
		$failed_count   = 0;
		$details        = [];

		foreach ( $rows as $index => $row ) {
			$row_number = $index + 1;
			$normalized = $this->normalize_import_row( (array) $row, $session_id, $unit_id, $group_id );

			$result = $this->create_student( $normalized );

			if ( is_wp_error( $result ) ) {
				$failed_count++;
				$details[] = [
					'row'     => $row_number,
					'name'    => trim( ( $normalized['first_name'] ?? '' ) . ' ' . ( $normalized['last_name'] ?? '' ) ),
					'status'  => 'error',
					'message' => $result->get_error_message(),
				];
			} else {
				$imported_count++;
				$details[] = [
					'row'            => $row_number,
					'student_id'     => $result['id'],
					'student_number' => $result['student_number'],
					'name'           => trim( $result['first_name'] . ' ' . $result['last_name'] ),
					'status'         => 'success',
				];
			}
		}

		return [
			'imported_count' => $imported_count,
			'failed_count'   => $failed_count,
			'details'        => $details,
		];
	}

	/**
	 * Normalizes raw import row keys and aliases for multi-country support.
	 *
	 * ponytail: map common alias variations (US zip / UK postcode / India pincode) without complex schema engines.
	 */
	private function normalize_import_row( array $row, int $session_id, int $unit_id, ?int $group_id ): array {
		$map = [];
		foreach ( $row as $k => $v ) {
			$key         = strtolower( trim( (string) $k ) );
			$map[ $key ] = is_string( $v ) ? trim( $v ) : $v;
		}

		$clean = [
			'academic_session_id' => $session_id,
			'academic_unit_id'    => $unit_id,
			'academic_group_id'   => $group_id,
		];

		// Student Name
		if ( empty( $map['first_name'] ) && ! empty( $map['student_name'] ) ) {
			$parts               = explode( ' ', (string) $map['student_name'], 2 );
			$clean['first_name'] = $parts[0] ?? '';
			$clean['last_name']  = $parts[1] ?? '';
		} else {
			$clean['first_name']  = $map['first_name'] ?? $map['given_name'] ?? '';
			$clean['middle_name'] = $map['middle_name'] ?? '';
			$clean['last_name']   = $map['last_name'] ?? $map['surname'] ?? $map['family_name'] ?? '';
		}

		$clean['date_of_birth']    = $map['date_of_birth'] ?? $map['dob'] ?? '';
		$raw_gender             = preg_replace( '/[-\s]+/', '_', strtolower( trim( (string) ( $map['gender'] ?? $map['sex'] ?? 'male' ) ) ) );
		$gender_aliases         = [
			'm' => 'male', 'male' => 'male',
			'f' => 'female', 'female' => 'female',
			'x' => 'non_binary', 'non_binary' => 'non_binary', 'nonbinary' => 'non_binary',
			'prefer_not_to_say' => 'prefer_not_to_say', 'prefer_not_to_disclose' => 'prefer_not_to_say', 'unspecified' => 'prefer_not_to_say',
			'o' => 'other', 'other' => 'other',
		];
		$clean['gender']        = $gender_aliases[ $raw_gender ] ?? $raw_gender;
		$clean['admission_number'] = $map['admission_number'] ?? $map['adm_no'] ?? '';
		$clean['admission_date']   = $map['admission_date'] ?? '';

		// Father
		if ( empty( $map['father_first_name'] ) && ! empty( $map['father_name'] ) ) {
			$f_parts                    = explode( ' ', (string) $map['father_name'], 2 );
			$clean['father_first_name'] = $f_parts[0] ?? '';
			$clean['father_last_name']  = $f_parts[1] ?? $clean['last_name'];
		} else {
			$clean['father_first_name'] = $map['father_first_name'] ?? '';
			$clean['father_last_name']  = $map['father_last_name'] ?? '';
		}
		$clean['father_email'] = $map['father_email'] ?? '';
		$clean['father_phone'] = $map['father_phone'] ?? $map['father_mobile'] ?? '';

		// Mother
		if ( empty( $map['mother_first_name'] ) && ! empty( $map['mother_name'] ) ) {
			$m_parts                    = explode( ' ', (string) $map['mother_name'], 2 );
			$clean['mother_first_name'] = $m_parts[0] ?? '';
			$clean['mother_last_name']  = $m_parts[1] ?? $clean['last_name'];
		} else {
			$clean['mother_first_name'] = $map['mother_first_name'] ?? '';
			$clean['mother_last_name']  = $map['mother_last_name'] ?? '';
		}
		$clean['mother_email'] = $map['mother_email'] ?? '';
		$clean['mother_phone'] = $map['mother_phone'] ?? $map['mother_mobile'] ?? '';

		// Guardian / Other
		$clean['guardian_first_name'] = $map['guardian_first_name'] ?? $map['guardian_name'] ?? '';
		$clean['guardian_last_name']  = $map['guardian_last_name'] ?? '';
		$clean['guardian_email']      = $map['guardian_email'] ?? '';
		$clean['guardian_phone']      = $map['guardian_phone'] ?? '';
		$clean['relationship']        = $map['relationship'] ?? 'guardian';

		// Address mapping (US zip, UK postcode, IN pincode)
		$postal = $map['postal_code'] ?? $map['zip_code'] ?? $map['zip'] ?? $map['postcode'] ?? $map['pincode'] ?? '';
		$clean['address_json'] = json_encode( [
			'address'     => $map['address'] ?? $map['street'] ?? '',
			'city'        => $map['city'] ?? $map['town'] ?? '',
			'state'       => $map['state'] ?? $map['province'] ?? $map['county'] ?? '',
			'postal_code' => $postal,
			'country'     => $map['country'] ?? '',
		] );

		return $clean;
	}
}
