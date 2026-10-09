<?php
/**
 * Staff Directory database service.
 *
 * Handles DB queries and CRUD operations for staff members.
 *
 * @package CodeClove\Modules\Staff
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Staff;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Database\Schema;
use CodeClove\Shared\IdentifierService;
use CodeClove\Core\Logger;
use WP_Error;

/**
 * Class StaffService
 */
final class StaffService {

	/**
	 * Gets a list of staff members based on filters and pagination.
	 *
	 * @param array $params Filter and pagination params.
	 * @return array{items: array, total: int}
	 */
	public function get_staff_members( array $params ): array {
		global $wpdb;

		$page     = (int) ( $params['page'] ?? 1 );
		$per_page = (int) ( $params['per_page'] ?? 25 );
		$offset   = ( $page - 1 ) * $per_page;

		$search  = $params['search'] ?? null;
		$status  = $params['status'] ?? null;
		$role_id = $params['role_id'] ?? null;
		$whitelist = [
			'id'           => 's.id',
			'name'         => 's.first_name',
			'first_name'   => 's.first_name',
			'last_name'    => 's.last_name',
			'email'        => 's.email',
			'staff_number' => 's.staff_number',
			'designation'  => 's.designation',
			'department'   => 's.department',
			'status'       => 's.status',
			'created_at'   => 's.created_at',
		];
		$orderby_param = $params['orderby'] ?? 'id';
		$orderby       = $whitelist[ $orderby_param ] ?? 's.id';
		$order         = strtoupper( $params['order'] ?? 'DESC' ) === 'ASC' ? 'ASC' : 'DESC';
		$table       = Schema::staff_members();
		$roles_table = Schema::roles();
		$where       = [ 's.deleted_at IS NULL' ];
		$args        = [];

		if ( $status ) {
			$where[] = 's.status = %s';
			$args[]  = $status;
		}

		if ( $role_id ) {
			$where[] = 's.role_id = %d';
			$args[]  = (int) $role_id;
		}

		if ( $search ) {
			$like    = '%' . $wpdb->esc_like( $search ) . '%';
			$where[] = '(s.first_name LIKE %s OR s.last_name LIKE %s OR s.email LIKE %s OR s.staff_number LIKE %s OR s.designation LIKE %s OR s.department LIKE %s)';
			array_push( $args, $like, $like, $like, $like, $like, $like );
		}

		$where_clause = implode( ' AND ', $where );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Staff members list and count queries with dynamic clauses.
		$query_args = array_merge( [ Schema::staff_members(), Schema::roles() ], $args, [ $per_page, $offset ] );
		$items      = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT s.*, r.name as role_name FROM %i s LEFT JOIN %i r ON s.role_id = r.id WHERE {$where_clause} ORDER BY {$orderby} {$order} LIMIT %d OFFSET %d",
				...$query_args
			),
			ARRAY_A
		);
		$total = (int) ( empty( $args )
			? $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM %i s WHERE {$where_clause}", Schema::staff_members() ) )
			: $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM %i s WHERE {$where_clause}", Schema::staff_members(), ...$args ) ) );
		// phpcs:enable

		foreach ( $items as &$item ) {
			$item = $this->format_staff_member( $item );
		}

		return [
			'items' => $items,
			'total' => $total,
		];
	}

	/**
	 * Gets a single staff member.
	 *
	 * @param int $id Staff ID.
	 * @return array|null
	 */
	public function get_staff_member( int $id ): ?array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Get single staff member query.
		$item = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT s.*, r.name as role_name FROM %i s LEFT JOIN %i r ON s.role_id = r.id WHERE s.id = %d AND s.deleted_at IS NULL',
				Schema::staff_members(),
				Schema::roles(),
				$id
			),
			ARRAY_A
		);

		if ( ! $item ) {
			return null;
		}

		return $this->format_staff_member( $item );
	}

	/**
	 * Creates a new staff member.
	 *
	 * @param array $body Request body.
	 * @return array|WP_Error
	 */
	public function create_staff_member( array $body ): array|WP_Error {
		global $wpdb;

		if ( empty( $body['first_name'] ) || empty( $body['last_name'] ) || empty( $body['email'] ) ) {
			return new WP_Error( 'codeclove_validation_failed', __( 'First name, last name, and email are required.', 'codeclove-school-management' ), [ 'status' => 400 ] );
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Check duplicate staff email.
		$email_check = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE email = %s AND deleted_at IS NULL',
				Schema::staff_members(),
				$body['email']
			)
		);
		if ( $email_check > 0 ) {
			return new WP_Error( 'codeclove_duplicate_email', __( 'A staff member with this email already exists.', 'codeclove-school-management' ), [ 'status' => 400 ] );
		}

		$staff_number = ! empty( $body['staff_number'] ) ? sanitize_text_field( $body['staff_number'] ) : ( IdentifierService::generate( 'staff_member' ) ?: '' );
		if ( ! $staff_number || is_wp_error( $staff_number ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Max staff ID query.
			$max_id = (int) $wpdb->get_var(
				$wpdb->prepare( 'SELECT MAX(id) FROM %i', Schema::staff_members() )
			);
			$staff_number = 'STF-' . str_pad( (string) ( $max_id + 1 ), 3, '0', STR_PAD_LEFT );
		}

		$data = [
			'staff_number'    => $staff_number,
			'user_id'         => ! empty( $body['user_id'] ) ? (int) $body['user_id'] : null,
			'role_id'         => ! empty( $body['role_id'] ) ? (int) $body['role_id'] : null,
			'title'           => ! empty( $body['title'] ) ? sanitize_text_field( $body['title'] ) : null,
			'first_name'      => sanitize_text_field( $body['first_name'] ),
			'middle_name'     => ! empty( $body['middle_name'] ) ? sanitize_text_field( $body['middle_name'] ) : null,
			'last_name'       => sanitize_text_field( $body['last_name'] ),
			'preferred_name'  => ! empty( $body['preferred_name'] ) ? sanitize_text_field( $body['preferred_name'] ) : null,
			'date_of_birth'   => ! empty( $body['date_of_birth'] ) ? sanitize_text_field( $body['date_of_birth'] ) : null,
			'gender'          => ! empty( $body['gender'] ) ? sanitize_text_field( $body['gender'] ) : null,
			'email'           => sanitize_email( $body['email'] ),
			'phone'           => ! empty( $body['phone'] ) ? sanitize_text_field( $body['phone'] ) : null,
			'department'      => ! empty( $body['department'] ) ? sanitize_text_field( $body['department'] ) : null,
			'designation'     => ! empty( $body['designation'] ) ? sanitize_text_field( $body['designation'] ) : null,
			'staff_category'  => ! empty( $body['staff_category'] ) ? sanitize_text_field( $body['staff_category'] ) : null,
			'employment_type' => ! empty( $body['employment_type'] ) ? sanitize_text_field( $body['employment_type'] ) : null,
			'joined_on'       => ! empty( $body['joined_on'] ) ? sanitize_text_field( $body['joined_on'] ) : null,
			'photo_id'        => ! empty( $body['photo_id'] ) ? (int) $body['photo_id'] : null,
			'status'          => ! empty( $body['status'] ) ? sanitize_text_field( $body['status'] ) : 'active',
			'created_at'      => current_time( 'mysql', true ),
			'updated_at'      => current_time( 'mysql', true ),
		];

		$data['emergency_contact_json'] = ( ! empty( $body['emergency_contact_name'] ) || ! empty( $body['emergency_contact_phone'] ) )
			? wp_json_encode( [
				'name'         => sanitize_text_field( $body['emergency_contact_name'] ?? '' ),
				'relationship' => sanitize_text_field( $body['emergency_contact_relationship'] ?? '' ),
				'phone'        => sanitize_text_field( $body['emergency_contact_phone'] ?? '' ),
			] )
			: null;

		$data['qualifications_json'] = ( ! empty( $body['highest_qualification'] ) || ! empty( $body['specialization'] ) )
			? wp_json_encode( [
				'highest_qualification' => sanitize_text_field( $body['highest_qualification'] ?? '' ),
				'specialization'        => sanitize_text_field( $body['specialization'] ?? '' ),
			] )
			: null;

		$data['metadata_json'] = ( isset( $body['metadata'] ) && is_array( $body['metadata'] ) )
			? wp_json_encode( array_map( 'sanitize_text_field', array_filter( $body['metadata'], 'is_scalar' ) ) )
			: null;
		if ( isset( $body['address'] ) || isset( $body['city'] ) || isset( $body['state'] ) || isset( $body['postal_code'] ) || isset( $body['zip_code'] ) || isset( $body['country'] ) ) {
			$p_code = isset( $body['postal_code'] ) ? sanitize_text_field( $body['postal_code'] ) : ( isset( $body['zip_code'] ) ? sanitize_text_field( $body['zip_code'] ) : '' );
			$address_data = [
				'address'     => isset( $body['address'] ) ? sanitize_textarea_field( $body['address'] ) : '',
				'city'        => isset( $body['city'] ) ? sanitize_text_field( $body['city'] ) : '',
				'state'       => isset( $body['state'] ) ? sanitize_text_field( $body['state'] ) : '',
				'postal_code' => $p_code,
				'country'     => isset( $body['country'] ) ? sanitize_text_field( $body['country'] ) : '',
			];
			$data['address_json'] = wp_json_encode( $address_data );
		} else {
			$data['address_json'] = null;
		}

		if ( isset( $body['documents'] ) && is_array( $body['documents'] ) ) {
			$sanitized_docs = [];
			foreach ( $body['documents'] as $doc ) {
				if ( is_array( $doc ) && isset( $doc['attachment_id'] ) ) {
					$sanitized_docs[] = [
						'label'         => sanitize_text_field( $doc['label'] ?? 'Document' ),
						'attachment_id' => (int) $doc['attachment_id'],
						'url'           => esc_url_raw( $doc['url'] ?? '' ),
					];
				}
			}
			$data['documents_json'] = wp_json_encode( $sanitized_docs );
		} else {
			$data['documents_json'] = '[]';
		}

		// Check if we should create a new WordPress user account
		if ( ! empty( $body['create_user'] ) ) {
			$username = ! empty( $body['username'] ) ? sanitize_user( $body['username'] ) : '';
			$password = ! empty( $body['password'] ) ? $body['password'] : '';

			if ( empty( $username ) || empty( $password ) ) {
				return new WP_Error( 'codeclove_validation_failed', __( 'Username and password are required to create a user account.', 'codeclove-school-management' ), [ 'status' => 400 ] );
			}

			if ( username_exists( $username ) ) {
				return new WP_Error( 'codeclove_username_exists', __( 'Username already exists.', 'codeclove-school-management' ), [ 'status' => 400 ] );
			}

			if ( email_exists( $data['email'] ) ) {
				return new WP_Error( 'codeclove_email_exists', __( 'A user with this email address already exists.', 'codeclove-school-management' ), [ 'status' => 400 ] );
			}

			$user_id = wp_create_user( $username, $password, $data['email'] );
			if ( is_wp_error( $user_id ) ) {
				return $user_id;
			}

			// Assign the codeclove_staff WP role and populate WP user profile.
			wp_update_user( [
				'ID'           => $user_id,
				'role'         => 'codeclove_staff',
				'first_name'   => $data['first_name'],
				'last_name'    => $data['last_name'],
				'display_name' => trim( $data['first_name'] . ' ' . $data['last_name'] ),
			] );

			$data['user_id'] = $user_id;
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->insert( Schema::staff_members(), $data );
		if ( false === $result || ! $wpdb->insert_id ) {
			Logger::error( 'Failed to insert staff member: ' . $wpdb->last_error );
			return new WP_Error( 'codeclove_db_error', __( 'Failed to create staff member in database.', 'codeclove-school-management' ), 500 );
		}
		$insert_id = (int) $wpdb->insert_id;

		// Synchronize WP user role if mapping exists
		if ( ! empty( $data['user_id'] ) && ! empty( $data['role_id'] ) ) {
			$this->sync_user_role( (int) $data['user_id'], (int) $data['role_id'] );
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Fresh staff member retrieval.
		$fresh = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT s.*, r.name as role_name FROM %i s LEFT JOIN %i r ON s.role_id = r.id WHERE s.id = %d',
				Schema::staff_members(),
				Schema::roles(),
				$insert_id
			),
			ARRAY_A
		);

		if ( ! is_array( $fresh ) ) {
			return new WP_Error( 'codeclove_not_found', __( 'Failed to retrieve newly created staff member.', 'codeclove-school-management' ), 500 );
		}

		return $this->format_staff_member( $fresh );
	}

	/**
	 * Updates an existing staff member.
	 *
	 * @param int   $id   Staff ID.
	 * @param array $body Request body.
	 * @return array|WP_Error
	 */
	public function update_staff_member( int $id, array $body ): array|WP_Error {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Get staff member for update.
		$exists_row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM %i WHERE id = %d AND deleted_at IS NULL',
				Schema::staff_members(),
				$id
			),
			ARRAY_A
		);
		if ( ! $exists_row ) {
			return new WP_Error( 'codeclove_not_found', __( 'Staff member not found.', 'codeclove-school-management' ), [ 'status' => 404 ] );
		}

		// Prevent lockout: check if this is the last Owner user
		if ( ! empty( $exists_row['user_id'] ) && $this->is_last_owner( (int) $exists_row['user_id'] ) ) {
			if ( isset( $body['role_id'] ) ) {
				$new_role_id = empty( $body['role_id'] ) ? null : (int) $body['role_id'];
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Owner role ID query.
				$owner_role_id = (int) $wpdb->get_var(
					$wpdb->prepare(
						'SELECT id FROM %i WHERE slug = %s',
						Schema::roles(),
						'owner'
					)
				);
				if ( $new_role_id !== $owner_role_id ) {
					return new WP_Error( 'codeclove_lockout_prevented', __( 'Cannot remove the Owner role from the last remaining Owner user.', 'codeclove-school-management' ), [ 'status' => 400 ] );
				}
			}

			if ( isset( $body['status'] ) && in_array( $body['status'], [ 'inactive', 'suspended' ], true ) ) {
				return new WP_Error( 'codeclove_lockout_prevented', __( 'Cannot deactivate or suspend the last remaining Owner user.', 'codeclove-school-management' ), [ 'status' => 400 ] );
			}
		}

		$data = [];
		if ( isset( $body['staff_number'] ) )    { $data['staff_number'] = sanitize_text_field( $body['staff_number'] ); }
		if ( isset( $body['title'] ) )           { $data['title'] = sanitize_text_field( $body['title'] ); }
		if ( isset( $body['first_name'] ) )      { $data['first_name'] = sanitize_text_field( $body['first_name'] ); }
		if ( isset( $body['middle_name'] ) )     { $data['middle_name'] = sanitize_text_field( $body['middle_name'] ); }
		if ( isset( $body['last_name'] ) )       { $data['last_name'] = sanitize_text_field( $body['last_name'] ); }
		if ( isset( $body['preferred_name'] ) )  { $data['preferred_name'] = sanitize_text_field( $body['preferred_name'] ); }
		if ( isset( $body['date_of_birth'] ) )   { $data['date_of_birth'] = sanitize_text_field( $body['date_of_birth'] ); }
		if ( isset( $body['gender'] ) )          { $data['gender'] = sanitize_text_field( $body['gender'] ); }
		if ( isset( $body['email'] ) )           { $data['email'] = sanitize_email( $body['email'] ); }
		if ( isset( $body['phone'] ) )           { $data['phone'] = sanitize_text_field( $body['phone'] ); }
		if ( isset( $body['department'] ) )      { $data['department'] = sanitize_text_field( $body['department'] ); }
		if ( isset( $body['designation'] ) )     { $data['designation'] = sanitize_text_field( $body['designation'] ); }
		if ( isset( $body['staff_category'] ) )  { $data['staff_category'] = sanitize_text_field( $body['staff_category'] ); }
		if ( isset( $body['employment_type'] ) ) { $data['employment_type'] = sanitize_text_field( $body['employment_type'] ); }
		if ( isset( $body['joined_on'] ) )       { $data['joined_on'] = sanitize_text_field( $body['joined_on'] ); }
		if ( isset( $body['status'] ) )          { $data['status'] = sanitize_text_field( $body['status'] ); }
		if ( isset( $body['user_id'] ) )         { $data['user_id'] = $body['user_id'] ? (int) $body['user_id'] : null; }
		if ( isset( $body['photo_id'] ) )        { $data['photo_id'] = empty( $body['photo_id'] ) ? null : (int) $body['photo_id']; }
		if ( isset( $body['role_id'] ) )         { $data['role_id'] = empty( $body['role_id'] ) ? null : (int) $body['role_id']; }

		if ( isset( $body['emergency_contact_name'] ) || isset( $body['emergency_contact_phone'] ) || isset( $body['emergency_contact_relationship'] ) ) {
			$data['emergency_contact_json'] = wp_json_encode( [
				'name'         => sanitize_text_field( $body['emergency_contact_name'] ?? '' ),
				'relationship' => sanitize_text_field( $body['emergency_contact_relationship'] ?? '' ),
				'phone'        => sanitize_text_field( $body['emergency_contact_phone'] ?? '' ),
			] );
		}

		if ( isset( $body['highest_qualification'] ) || isset( $body['specialization'] ) ) {
			$data['qualifications_json'] = wp_json_encode( [
				'highest_qualification' => sanitize_text_field( $body['highest_qualification'] ?? '' ),
				'specialization'        => sanitize_text_field( $body['specialization'] ?? '' ),
			] );
		}

		if ( isset( $body['metadata'] ) && is_array( $body['metadata'] ) ) {
			$data['metadata_json'] = wp_json_encode( array_map( 'sanitize_text_field', array_filter( $body['metadata'], 'is_scalar' ) ) );
		}

		if ( isset( $body['address'] ) || isset( $body['city'] ) || isset( $body['state'] ) || isset( $body['postal_code'] ) || isset( $body['zip_code'] ) || isset( $body['country'] ) ) {
			$p_code = isset( $body['postal_code'] ) ? sanitize_text_field( $body['postal_code'] ) : ( isset( $body['zip_code'] ) ? sanitize_text_field( $body['zip_code'] ) : '' );
			$address_data = [
				'address'     => isset( $body['address'] ) ? sanitize_textarea_field( $body['address'] ) : '',
				'city'        => isset( $body['city'] ) ? sanitize_text_field( $body['city'] ) : '',
				'state'       => isset( $body['state'] ) ? sanitize_text_field( $body['state'] ) : '',
				'postal_code' => $p_code,
				'country'     => isset( $body['country'] ) ? sanitize_text_field( $body['country'] ) : '',
			];
			$data['address_json'] = wp_json_encode( $address_data );
		}

		if ( isset( $body['documents'] ) && is_array( $body['documents'] ) ) {
			$sanitized_docs = [];
			foreach ( $body['documents'] as $doc ) {
				if ( is_array( $doc ) && isset( $doc['attachment_id'] ) ) {
					$sanitized_docs[] = [
						'label'         => sanitize_text_field( $doc['label'] ?? 'Document' ),
						'attachment_id' => (int) $doc['attachment_id'],
						'url'           => esc_url_raw( $doc['url'] ?? '' ),
					];
				}
			}
			$data['documents_json'] = wp_json_encode( $sanitized_docs );
		}

		// Check if we should create a new WordPress user account during update
		if ( ! empty( $body['create_user'] ) && empty( $exists_row['user_id'] ) ) {
			$username = ! empty( $body['username'] ) ? sanitize_user( $body['username'] ) : '';
			$password = ! empty( $body['password'] ) ? $body['password'] : '';

			if ( empty( $username ) || empty( $password ) ) {
				return new WP_Error( 'codeclove_validation_failed', __( 'Username and password are required to create a user account.', 'codeclove-school-management' ), [ 'status' => 400 ] );
			}

			if ( username_exists( $username ) ) {
				return new WP_Error( 'codeclove_username_exists', __( 'Username already exists.', 'codeclove-school-management' ), [ 'status' => 400 ] );
			}

			$email = ! empty( $data['email'] ) ? $data['email'] : $exists_row['email'];
			if ( email_exists( $email ) ) {
				return new WP_Error( 'codeclove_email_exists', __( 'A user with this email address already exists.', 'codeclove-school-management' ), [ 'status' => 400 ] );
			}

			$user_id = wp_create_user( $username, $password, $email );
			if ( is_wp_error( $user_id ) ) {
				return $user_id;
			}

			// Assign the codeclove_staff WP role and populate WP user profile.
			$first = $data['first_name'] ?? $exists_row['first_name'] ?? '';
			$last  = $data['last_name'] ?? $exists_row['last_name'] ?? '';
			wp_update_user( [
				'ID'           => $user_id,
				'role'         => 'codeclove_staff',
				'first_name'   => $first,
				'last_name'    => $last,
				'display_name' => trim( $first . ' ' . $last ),
			] );

			$data['user_id'] = $user_id;
		}

		// Check if we should update password of an existing user account
		if ( ! empty( $exists_row['user_id'] ) && ! empty( $body['password'] ) ) {
			if ( strlen( $body['password'] ) < 6 ) {
				return new WP_Error( 'codeclove_validation_failed', __( 'Password must be at least 6 characters.', 'codeclove-school-management' ), [ 'status' => 400 ] );
			}
			wp_set_password( $body['password'], (int) $exists_row['user_id'] );
		}

		if ( ! empty( $data['email'] ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Check duplicate staff email on update.
			$email_check = (int) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT COUNT(*) FROM %i WHERE email = %s AND id != %d AND deleted_at IS NULL',
					Schema::staff_members(),
					$data['email'],
					$id
				)
			);
			if ( $email_check > 0 ) {
				return new WP_Error( 'codeclove_duplicate_email', __( 'A staff member with this email already exists.', 'codeclove-school-management' ), [ 'status' => 400 ] );
			}
		}

		if ( isset( $body['notification_preferences'] ) && is_array( $body['notification_preferences'] ) ) {
			$target_user_id = ! empty( $exists_row['user_id'] ) ? (int) $exists_row['user_id'] : ( ! empty( $data['user_id'] ) ? (int) $data['user_id'] : 0 );
			if ( $target_user_id ) {
				update_user_meta( $target_user_id, '_codeclove_notification_preferences', $body['notification_preferences'] );
			}
		}

		if ( ! empty( $data ) ) {
			$data['updated_at'] = current_time( 'mysql', true );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Update staff member record.
			$wpdb->update( Schema::staff_members(), $data, [ 'id' => $id ] );

			// Sync WP user details if user is linked
			if ( ! empty( $exists_row['user_id'] ) ) {
				$wp_user_id = (int) $exists_row['user_id'];
				$wp_data = [ 'ID' => $wp_user_id ];
				$wp_changed = false;

				if ( isset( $data['email'] ) && $data['email'] !== $exists_row['email'] ) {
					$wp_data['user_email'] = $data['email'];
					$wp_changed = true;
				}

				if ( isset( $data['first_name'] ) || isset( $data['last_name'] ) ) {
					$first = isset( $data['first_name'] ) ? $data['first_name'] : $exists_row['first_name'];
					$last  = isset( $data['last_name'] ) ? $data['last_name'] : $exists_row['last_name'];
					$wp_data['first_name'] = $first;
					$wp_data['last_name']  = $last;
					$wp_data['display_name'] = trim( $first . ' ' . $last );
					$wp_changed = true;
				}

				if ( $wp_changed ) {
					wp_update_user( $wp_data );
				}
			}
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Updated staff member query.
		$updated = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT s.*, r.name as role_name FROM %i s LEFT JOIN %i r ON s.role_id = r.id WHERE s.id = %d',
				Schema::staff_members(),
				Schema::roles(),
				$id
			),
			ARRAY_A
		);

		// Synchronize WP user role if mapping exists
		if ( ! empty( $updated['user_id'] ) && ! empty( $updated['role_id'] ) ) {
			$this->sync_user_role( (int) $updated['user_id'], (int) $updated['role_id'] );
		}

		return $this->format_staff_member( $updated );
	}

	public function delete_staff_member( int $id ): bool|WP_Error {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Staff member existence check before delete.
		$exists = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT id, user_id FROM %i WHERE id = %d AND deleted_at IS NULL',
				Schema::staff_members(),
				$id
			),
			ARRAY_A
		);
		if ( ! $exists ) {
			return new WP_Error( 'codeclove_not_found', __( 'Staff member not found.', 'codeclove-school-management' ), [ 'status' => 404 ] );
		}

		if ( ! empty( $exists['user_id'] ) && $this->is_last_owner( (int) $exists['user_id'] ) ) {
			return new WP_Error( 'codeclove_lockout_prevented', __( 'Cannot delete the last remaining Owner user.', 'codeclove-school-management' ), [ 'status' => 400 ] );
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Soft delete staff member.
		$wpdb->update(
			Schema::staff_members(),
			[ 'deleted_at' => current_time( 'mysql', true ) ],
			[ 'id' => $id ]
		);
		// phpcs:enable

		return true;
	}

	/**
	 * Performs bulk actions on staff members.
	 *
	 * @param array $params Action parameters.
	 * @return array|WP_Error
	 */
	public function bulk_staff_action( array $params ): array|WP_Error {
		global $wpdb;

		$action = $params['action'] ?? '';
		$ids    = $params['ids'] ?? [];

		if ( empty( $ids ) || ! is_array( $ids ) ) {
			return new WP_Error( 'codeclove_invalid_ids', __( 'No IDs provided.', 'codeclove-school-management' ), [ 'status' => 400 ] );
		}

		$ids = array_map( 'intval', $ids );

		if ( 'status' === $action ) {
			$status = $params['status'] ?? '';
			if ( ! in_array( $status, [ 'active', 'inactive', 'suspended' ], true ) ) {
				return new WP_Error( 'codeclove_invalid_status', __( 'Invalid status provided.', 'codeclove-school-management' ), [ 'status' => 400 ] );
			}

			// Prevent lockout in bulk status update
			if ( in_array( $status, [ 'inactive', 'suspended' ], true ) ) {
				foreach ( $ids as $id ) {
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Staff user_id lookup.
					$staff = $wpdb->get_row(
						$wpdb->prepare(
							'SELECT user_id FROM %i WHERE id = %d',
							Schema::staff_members(),
							$id
						),
						ARRAY_A
					);
					if ( $staff && ! empty( $staff['user_id'] ) && $this->is_last_owner( (int) $staff['user_id'] ) ) {
						return new WP_Error( 'codeclove_lockout_prevented', __( 'Cannot deactivate or suspend the last remaining Owner user.', 'codeclove-school-management' ), [ 'status' => 400 ] );
					}
				}
			}

			$table   = Schema::staff_members();
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

		if ( 'delete' === $action ) {
			// Prevent lockout in bulk delete
			foreach ( $ids as $id ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Custom database table query.
				$staff = $wpdb->get_row(
					$wpdb->prepare(
						'SELECT user_id FROM %i WHERE id = %d',
						Schema::staff_members(),
						$id
					),
					ARRAY_A
				);
				if ( $staff && ! empty( $staff['user_id'] ) && $this->is_last_owner( (int) $staff['user_id'] ) ) {
					return new WP_Error( 'codeclove_lockout_prevented', __( 'Cannot delete the last remaining Owner user.', 'codeclove-school-management' ), [ 'status' => 400 ] );
				}
			}

			$table   = Schema::staff_members();
			$now     = current_time( 'mysql', true );
			$deleted = 0;
			foreach ( $ids as $id ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Custom database table update.
				$result = $wpdb->update(
					$table,
					[ 'deleted_at' => $now ],
					[ 'id' => (int) $id ],
					[ '%s' ],
					[ '%d' ]
				);
				if ( false !== $result ) {
					$deleted++;
				}
			}
			return [ 'success' => true, 'deleted_count' => $deleted ];
		}

		return new WP_Error( 'codeclove_invalid_action', __( 'Invalid bulk action.', 'codeclove-school-management' ), [ 'status' => 400 ] );
	}

	/**
	 * Formats a raw database staff member row for REST API responses.
	 *
	 * @param array $item Raw database row.
	 */
	public function format_staff_member( array $item ): array {
		$item['id']        = (int) $item['id'];
		$item['user_id']   = $item['user_id'] ? (int) $item['user_id'] : null;
		$item['username']  = '';
		if ( $item['user_id'] ) {
			$user = get_userdata( $item['user_id'] );
			if ( $user ) {
				$item['username'] = $user->user_login;
			}
		}
		$item['role_id']   = ! empty( $item['role_id'] ) ? (int) $item['role_id'] : null;
		$item['role_name'] = ! empty( $item['role_name'] ) ? $item['role_name'] : '—';
		$item['photo_id']  = ! empty( $item['photo_id'] ) ? (int) $item['photo_id'] : null;

		$item['notification_preferences'] = [];
		if ( $item['user_id'] ) {
			$prefs = get_user_meta( $item['user_id'], '_codeclove_notification_preferences', true );
			if ( is_array( $prefs ) ) {
				$item['notification_preferences'] = $prefs;
			}
		}

		$item['photo_url'] = ( ! empty( $item['photo_id'] ) ? wp_get_attachment_image_url( (int) $item['photo_id'], 'medium' ) : null ) ?: CODECLOVE_URL . 'assets/defaults/avatar.svg';

		$item['documents'] = ! empty( $item['documents_json'] ) ? json_decode( $item['documents_json'], true ) : [];
		if ( ! is_array( $item['documents'] ) ) {
			$item['documents'] = [];
		}
		unset( $item['documents_json'] );

		$item['title']           = $item['title'] ?? null;
		$item['date_of_birth']   = $item['date_of_birth'] ?? null;
		$item['gender']          = $item['gender'] ?? null;
		$item['staff_category']  = $item['staff_category'] ?? null;
		$item['employment_type'] = $item['employment_type'] ?? null;

		$ec = ! empty( $item['emergency_contact_json'] ) ? json_decode( $item['emergency_contact_json'], true ) : [];
		$item['emergency_contact_name']         = $ec['name'] ?? '';
		$item['emergency_contact_relationship'] = $ec['relationship'] ?? '';
		$item['emergency_contact_phone']        = $ec['phone'] ?? '';
		unset( $item['emergency_contact_json'] );

		$qual = ! empty( $item['qualifications_json'] ) ? json_decode( $item['qualifications_json'], true ) : [];
		$item['highest_qualification'] = $qual['highest_qualification'] ?? '';
		$item['specialization']        = $qual['specialization'] ?? '';
		unset( $item['qualifications_json'] );

		$decoded_meta = ! empty( $item['metadata_json'] ) ? json_decode( $item['metadata_json'], true ) : null;
		$item['metadata'] = ( is_array( $decoded_meta ) && ! empty( $decoded_meta ) ) ? $decoded_meta : (object) [];
		unset( $item['metadata_json'] );

		$address = [
			'address'     => '',
			'city'        => '',
			'state'       => '',
			'postal_code' => '',
			'country'     => '',
		];
		if ( ! empty( $item['address_json'] ) ) {
			$decoded = json_decode( $item['address_json'], true );
			if ( is_array( $decoded ) ) {
				$address = array_merge( $address, $decoded );
				if ( empty( $address['postal_code'] ) && ! empty( $decoded['zip_code'] ) ) {
					$address['postal_code'] = $decoded['zip_code'];
				}
				unset( $address['zip_code'] );
			}
		}
		foreach ( $address as $key => $val ) {
			$item[ $key ] = $val;
		}
		unset( $item['address_json'] );

		return $item;
	}

	/**
	 * Synchronizes a custom role mapping to the wp_codeclove_user_roles table.
	 *
	 * @param int      $user_id User ID.
	 * @param int|null $role_id Role ID.
	 */
	public function sync_user_role( int $user_id, ?int $role_id ): void {
		global $wpdb;
		if ( ! $role_id ) {
			return;
		}

		// Delete existing roles for this user to avoid duplication
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->delete( Schema::user_roles(), [ 'user_id' => $user_id ] );

		// Insert the new role mapping
		$wpdb->insert( Schema::user_roles(), [
			'user_id' => $user_id,
			'role_id' => $role_id,
		] );
		// phpcs:enable

		// Ensure the WP user has the codeclove_staff WP role (avoid demoting administrators).
		$wp_user = get_user_by( 'id', $user_id );
		if ( $wp_user && ! $wp_user->has_cap( 'codeclove_staff' ) && ! in_array( 'administrator', (array) $wp_user->roles, true ) ) {
			$wp_user->set_role( 'codeclove_staff' );
		}

		// Flush permissions cache for the user
		\CodeClove\Core\Permissions::flush_cache( $user_id );
	}

	/**
	 * Bulk imports staff members from an array of parsed row payloads.
	 *
	 * ponytail: loop over rows reusing create_staff_member validation logic.
	 *
	 * @param array $payload
	 * @return array|WP_Error
	 */
	public function import_staff_bulk( array $payload ): array|WP_Error {
		$rows = $payload['rows'] ?? [];
		if ( ! is_array( $rows ) || empty( $rows ) ) {
			return new WP_Error( 'validation_failed', __( 'No staff rows provided for import.', 'codeclove-school-management' ), 400 );
		}

		$role_id = ! empty( $payload['role_id'] ) ? (int) $payload['role_id'] : null;

		$imported_count = 0;
		$failed_count   = 0;
		$details        = [];

		foreach ( $rows as $index => $row ) {
			$row_number = $index + 1;
			$normalized = $this->normalize_staff_import_row( (array) $row, $role_id );

			$result = $this->create_staff_member( $normalized );

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
					'row'          => $row_number,
					'staff_id'     => $result['id'],
					'staff_number' => $result['staff_number'],
					'name'         => trim( $result['first_name'] . ' ' . $result['last_name'] ),
					'status'       => 'success',
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
	 * Normalizes raw staff import row keys and aliases for multi-country support.
	 */
	private function normalize_staff_import_row( array $row, ?int $role_id ): array {
		$map = [];
		foreach ( $row as $k => $v ) {
			$key         = strtolower( trim( (string) $k ) );
			$map[ $key ] = is_string( $v ) ? trim( $v ) : $v;
		}

		$clean = [
			'role_id' => ! empty( $map['role_id'] ) ? (int) $map['role_id'] : $role_id,
		];

		if ( empty( $map['first_name'] ) && ! empty( $map['name'] ) ) {
			$parts               = explode( ' ', (string) $map['name'], 2 );
			$clean['first_name'] = $parts[0] ?? '';
			$clean['last_name']  = $parts[1] ?? '';
		} else {
			$clean['first_name']  = $map['first_name'] ?? $map['given_name'] ?? '';
			$clean['middle_name'] = $map['middle_name'] ?? '';
			$clean['last_name']   = $map['last_name'] ?? $map['surname'] ?? '';
		}

		$clean['email']       = $map['email'] ?? '';
		$clean['phone']       = $map['phone'] ?? $map['mobile'] ?? '';
		$clean['department']  = $map['department'] ?? $map['dept'] ?? '';
		$clean['designation'] = $map['designation'] ?? $map['title'] ?? '';
		$clean['joined_on']   = $map['joined_on'] ?? $map['joining_date'] ?? '';

		// Address mapping
		$postal = $map['postal_code'] ?? $map['zip_code'] ?? $map['zip'] ?? $map['postcode'] ?? $map['pincode'] ?? '';
		$clean['address']     = $map['address'] ?? $map['street'] ?? '';
		$clean['city']        = $map['city'] ?? $map['town'] ?? '';
		$clean['state']       = $map['state'] ?? $map['province'] ?? '';
		$clean['postal_code'] = $postal;
		$clean['country']     = $map['country'] ?? '';

		return $clean;
	}

	/**
	 * Checks if a WordPress user is the last active Owner in CodeClove.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return bool
	 */
	private function is_last_owner( int $user_id ): bool {
		global $wpdb;

		// 1. Check if the user currently has the Owner role assigned.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Owner role ID query.
		$owner_role_id = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM %i WHERE slug = %s',
				Schema::roles(),
				'owner'
			)
		);
		if ( ! $owner_role_id ) {
			return false;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- User has owner role query.
		$user_has_owner = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE user_id = %d AND role_id = %d',
				Schema::user_roles(),
				$user_id,
				$owner_role_id
			)
		) > 0;

		if ( ! $user_has_owner ) {
			return false;
		}

		// 2. Count how many total users have the Owner role.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Total owners count query.
		$owner_count = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE role_id = %d',
				Schema::user_roles(),
				$owner_role_id
			)
		);

		return $owner_count <= 1;
	}

	/**
	 * Submits a public staff employment application.
	 *
	 * @param array $payload
	 * @return array|WP_Error
	 */
	public function submit_public_application( array $payload ): array|WP_Error {
		global $wpdb;

		$first_name = ! empty( $payload['first_name'] ) ? sanitize_text_field( $payload['first_name'] ) : '';
		$last_name  = ! empty( $payload['last_name'] ) ? sanitize_text_field( $payload['last_name'] ) : '';
		$email      = ! empty( $payload['email'] ) ? sanitize_email( $payload['email'] ) : '';

		if ( empty( $first_name ) || empty( $last_name ) ) {
			return new WP_Error( 'codeclove_validation_failed', __( 'First name and last name are required.', 'codeclove-school-management' ), 400 );
		}

		if ( empty( $email ) || ! is_email( $email ) ) {
			return new WP_Error( 'codeclove_validation_failed', __( 'A valid email address is required.', 'codeclove-school-management' ), 400 );
		}

		$ref_number = IdentifierService::generate( 'staff_application' ) ?: 'STAFF-' . gmdate( 'Y' ) . '-' . strtoupper( wp_generate_password( 5, false ) );
		$now        = current_time( 'mysql', true );

		$address_data = array_map( 'sanitize_text_field', [
			'address'     => $payload['address'] ?? '',
			'city'        => $payload['city'] ?? '',
			'state'       => $payload['state'] ?? '',
			'postal_code' => $payload['postal_code'] ?? '',
			'country'     => $payload['country'] ?? '',
		] );

		$experience_data = [
			'years'   => sanitize_text_field( $payload['experience_years'] ?? '' ),
			'details' => sanitize_textarea_field( $payload['experience_details'] ?? '' ),
		];

		$custom_data = [
			'qualification' => sanitize_text_field( $payload['qualification'] ?? '' ),
			'cover_letter'  => sanitize_textarea_field( $payload['cover_letter'] ?? '' ),
			'remarks'       => sanitize_textarea_field( $payload['remarks'] ?? '' ),
		];

		$insert_data = [
			'reference_number'   => $ref_number,
			'source'             => 'public_form',
			'desired_role'       => ! empty( $payload['desired_role'] ) ? sanitize_text_field( $payload['desired_role'] ) : 'Faculty',
			'department'         => ! empty( $payload['department'] ) ? sanitize_text_field( $payload['department'] ) : '',
			'first_name'         => $first_name,
			'middle_name'        => ! empty( $payload['middle_name'] ) ? sanitize_text_field( $payload['middle_name'] ) : null,
			'last_name'          => $last_name,
			'preferred_name'     => ! empty( $payload['preferred_name'] ) ? sanitize_text_field( $payload['preferred_name'] ) : null,
			'date_of_birth'      => ! empty( $payload['date_of_birth'] ) ? sanitize_text_field( $payload['date_of_birth'] ) : null,
			'email'              => $email,
			'phone'              => ! empty( $payload['phone'] ) ? sanitize_text_field( $payload['phone'] ) : null,
			'address_json'       => wp_json_encode( $address_data ),
			'experience_json'    => wp_json_encode( $experience_data ),
			'custom_fields_json' => wp_json_encode( $custom_data ),
			'status'             => (string) ( get_option( 'codeclove_settings', [] )['staff_onboarding']['default_status'] ?? 'submitted' ),
			'submitted_at'       => $now,
			'created_at'         => $now,
			'updated_at'         => $now,
		];

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->insert( Schema::staff_apps(), $insert_data );
		// phpcs:enable

		if ( ! $result ) {
			Logger::error( 'Failed to submit public staff application', $wpdb->last_error );
			return new WP_Error( 'codeclove_db_error', __( 'Failed to save application to database.', 'codeclove-school-management' ), 500 );
		}

		$app_id = (int) $wpdb->insert_id;

		// Create initial status event
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->insert(
			Schema::staff_app_events(),
			[
				'staff_application_id' => $app_id,
				'from_status'          => null,
				'to_status'            => $insert_data['status'],
				'reason'               => 'Public Submission',
				'message'              => 'Application submitted via public website careers form.',
				'visibility'           => 'public',
				'changed_at'           => $now,
			]
		);
		// phpcs:enable

		do_action( 'codeclove_staff_application_received', $app_id, $ref_number, $insert_data );

		return [
			'id'               => $app_id,
			'reference_number' => $ref_number,
			'first_name'       => $first_name,
			'last_name'        => $last_name,
			'desired_role'     => $insert_data['desired_role'],
			'status'           => $insert_data['status'],
			'submitted_at'     => $now,
		];
	}

	/**
	 * Public-safe lookup for staff application status.
	 *
	 * @param string $reference_number
	 * @param string $email
	 * @param string $dob
	 * @return array|WP_Error
	 */
	public function lookup_public_status( string $reference_number, string $email = '', string $dob = '' ): array|WP_Error {
		global $wpdb;

		$ref_clean = sanitize_text_field( $reference_number );
		if ( empty( $ref_clean ) || ( empty( $email ) && empty( $dob ) ) ) {
			return new WP_Error( 'codeclove_validation_failed', __( 'Reference number and verification details (email or date of birth) are required.', 'codeclove-school-management' ), 400 );
		}

		$sql   = 'SELECT * FROM %i WHERE reference_number = %s AND deleted_at IS NULL';
		$binds = [ Schema::staff_apps(), $ref_clean ];

		if ( ! empty( $email ) ) {
			$sql    .= ' AND email = %s';
			$binds[] = sanitize_email( $email );
		} else {
			$sql    .= ' AND date_of_birth = %s';
			$binds[] = sanitize_text_field( $dob );
		}
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Public staff app status lookup with dynamic fields.
		$app = $wpdb->get_row(
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared -- Query built with %i/%s/%d placeholders; table names from Schema constants, never user input.
			$wpdb->prepare( $sql, ...$binds ),
			ARRAY_A
		);
		// phpcs:enable
		if ( ! $app ) {
			return new WP_Error( 'codeclove_not_found', __( 'No application found matching the reference number and verification details.', 'codeclove-school-management' ), 404 );
		}

		// Fetch public timeline events
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Public staff app events query.
		$events = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT to_status, reason, message, changed_at FROM %i WHERE staff_application_id = %d AND visibility = %s ORDER BY id ASC',
				Schema::staff_app_events(),
				(int) $app['id'],
				'public'
			),
			ARRAY_A
		);
		// phpcs:enable

		return [
			'reference_number' => $app['reference_number'],
			'first_name'       => $app['first_name'],
			'last_name'        => $app['last_name'],
			'desired_role'     => $app['desired_role'],
			'department'       => $app['department'],
			'status'           => $app['status'],
			'submitted_at'     => $app['submitted_at'],
			'events'           => $events ?: [],
		];
	}
}
