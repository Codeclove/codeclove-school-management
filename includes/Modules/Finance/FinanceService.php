<?php
/**
 * Finance service.
 *
 * Implements business logic, raw SQL queries, and transaction management
 * for fee types, invoices, line items, and manual payments.
 *
 * @package CodeClove\Modules\Finance
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Finance;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Core\Logger;
use CodeClove\Database\Schema;
use CodeClove\Database\Transaction;
use CodeClove\Modules\Settings\SettingsRepository;
use CodeClove\Shared\IdentifierService;
use WP_Error;

/**
 * Class FinanceService
 */
final class FinanceService {

	/**
	 * School currency resolved once at construction. Avoids repeated SettingsRepository calls.
	 */
	private string $currency;

	/**
	 * Valid frequency values for fee types.
	 */
	private const VALID_FREQUENCIES = [ 'one_time', 'monthly', 'quarterly', 'term_wise', 'annual', 'custom' ];

	/**
	 * Valid fee type status values.
	 */
	private const VALID_FEE_STATUSES = [ 'active', 'inactive', 'archived' ];

	/**
	 * Valid fee type scope values.
	 */
	private const VALID_SCOPES = [ 'global', 'unit_specific' ];

	/**
	 * Valid payment method values.
	 */
	private const VALID_METHODS = [ 'cash', 'bank_transfer', 'cheque', 'upi', 'card', 'other' ];

	/**
	 * Valid payment source values (manual vs future gateway).
	 */
	private const VALID_SOURCES = [ 'manual', 'razorpay', 'stripe' ];

	public function __construct() {
		// ponytail: resolve once here; SettingsRepository is cheap but repeating it per-method is noise
		$settings       = ( new SettingsRepository() )->get_settings();
		$this->currency = $settings['localization']['currency'] ?? 'USD';
	}

	// ─── Fee Types CRUD ──────────────────────────────────────────────────────

	/**
	 * Gets fee types with search and pagination.
	 *
	 * @param array $args Filter and pagination parameters.
	 * @return array{fee_types: array, total: int}
	 */
	public function get_fee_types( array $args = [] ): array {
		global $wpdb;

		$defaults = [
			'status'        => '',
			'scope'         => '',
			'frequency'     => '',
			'has_overrides' => '',
			'search'        => '',
			'limit'         => 25,
			'offset'        => 0,
		];
		$params = array_merge( $defaults, $args );

		$table = Schema::fee_types();
		$class_rates_table = Schema::fee_type_class_rates();
		$where = 'deleted_at IS NULL';
		$binds = [];

		if ( ! empty( $params['status'] ) ) {
			$where   .= ' AND status = %s';
			$binds[] = sanitize_text_field( $params['status'] );
		}

		if ( ! empty( $params['scope'] ) ) {
			$where   .= ' AND scope = %s';
			$binds[] = sanitize_text_field( $params['scope'] );
		}

		if ( ! empty( $params['frequency'] ) ) {
			$where   .= ' AND frequency = %s';
			$binds[] = sanitize_text_field( $params['frequency'] );
		}

		if ( ! empty( $params['has_overrides'] ) ) {
			$op       = 'yes' === $params['has_overrides'] ? '>' : '=';
			$where   .= " AND (SELECT COUNT(*) FROM {$class_rates_table} r WHERE r.fee_type_id = f.id) {$op} 0";
		}

		if ( ! empty( $params['search'] ) ) {
			$where   .= ' AND (name LIKE %s OR code LIKE %s)';
			$like    = '%' . $wpdb->esc_like( $params['search'] ) . '%';
			$binds[] = $like;
			$binds[] = $like;
		}

		$query = "SELECT f.*, (SELECT COUNT(*) FROM {$class_rates_table} r WHERE r.fee_type_id = f.id) AS overrides_count FROM {$table} f WHERE {$where} ORDER BY f.name ASC";
		if ( $params['limit'] > 0 ) {
			$query   .= ' LIMIT %d OFFSET %d';
			$binds[] = (int) $params['limit'];
			$binds[] = (int) $params['offset'];
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$results = [] !== $binds ? $wpdb->get_results( $wpdb->prepare( $query, ...$binds ), ARRAY_A ) : $wpdb->get_results( $query, ARRAY_A );

		$count_query = "SELECT COUNT(*) FROM {$table} f WHERE {$where}";
		$count_binds = array_slice( $binds, 0, count( $binds ) - ( $params['limit'] > 0 ? 2 : 0 ) );
		$total       = (int) ( [] !== $count_binds ? $wpdb->get_var( $wpdb->prepare( $count_query, ...$count_binds ) ) : $wpdb->get_var( $count_query ) );
		// phpcs:enable

		foreach ( $results as &$row ) {
			$row['id']                   = (int) $row['id'];
			$row['default_amount_minor'] = (int) $row['default_amount_minor'];
			$row['overrides_count']      = isset( $row['overrides_count'] ) ? (int) $row['overrides_count'] : 0;
		}

		return [
			'fee_types' => $results,
			'total'     => $total,
		];
	}

	/**
	 * Creates a fee type template.
	 */
	public function create_fee_type( array $data ): array|WP_Error {
		global $wpdb;

		if ( empty( $data['name'] ) ) {
			return new WP_Error( 'missing_field', __( 'Fee type name is required.', 'codeclove-school-management' ), 400 );
		}

		$frequency = ! empty( $data['frequency'] ) ? sanitize_text_field( $data['frequency'] ) : 'one_time';
		if ( ! in_array( $frequency, self::VALID_FREQUENCIES, true ) ) {
			/* translators: %s: allowed frequency values */
			return new WP_Error( 'invalid_field', sprintf( __( 'Invalid frequency. Allowed: %s.', 'codeclove-school-management' ), implode( ', ', self::VALID_FREQUENCIES ) ), 400 );
		}

		$status = ! empty( $data['status'] ) ? sanitize_text_field( $data['status'] ) : 'active';
		if ( ! in_array( $status, self::VALID_FEE_STATUSES, true ) ) {
			/* translators: %s: allowed status values */
			return new WP_Error( 'invalid_field', sprintf( __( 'Invalid status. Allowed: %s.', 'codeclove-school-management' ), implode( ', ', self::VALID_FEE_STATUSES ) ), 400 );
		}

		$scope = ! empty( $data['scope'] ) ? sanitize_text_field( $data['scope'] ) : 'global';
		if ( ! in_array( $scope, self::VALID_SCOPES, true ) ) {
			/* translators: %s: allowed scope values */
			return new WP_Error( 'invalid_field', sprintf( __( 'Invalid scope. Allowed: %s.', 'codeclove-school-management' ), implode( ', ', self::VALID_SCOPES ) ), 400 );
		}

		$insert = [
			'name'                 => sanitize_text_field( $data['name'] ),
			'code'                 => ! empty( $data['code'] ) ? sanitize_title( $data['code'] ) : null,
			'description'          => ! empty( $data['description'] ) ? sanitize_textarea_field( $data['description'] ) : null,
			'default_amount_minor' => isset( $data['default_amount_minor'] ) ? (int) $data['default_amount_minor'] : 0,
			'currency'             => ! empty( $data['currency'] ) ? strtoupper( sanitize_text_field( $data['currency'] ) ) : $this->currency,
			'frequency'            => $frequency,
			'scope'                => $scope,
			'status'               => $status,
			'created_at'           => current_time( 'mysql', true ),
			'updated_at'           => current_time( 'mysql', true ),
		];

		// Check code uniqueness.
		if ( null !== $insert['code'] ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$existing_id = $wpdb->get_var(
				$wpdb->prepare( 'SELECT id FROM %i WHERE code = %s AND deleted_at IS NULL LIMIT 1', Schema::fee_types(), $insert['code'] )
			);
			// phpcs:enable
			if ( $existing_id ) {
				return new WP_Error( 'duplicate_code', __( 'A fee type with this code already exists.', 'codeclove-school-management' ), 400 );
			}
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->insert( Schema::fee_types(), $insert );
		// phpcs:enable

		if ( ! $result ) {
			return new WP_Error( 'db_error', __( 'Failed to create fee type.', 'codeclove-school-management' ), 500 );
		}

		return $this->get_fee_type_by_id( (int) $wpdb->insert_id );
	}

	/**
	 * Gets a single fee type by ID. Public so the controller can use it for GET /fee-types/:id.
	 */
	public function get_fee_type_by_id( int $id ): array {
		global $wpdb;
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$row = $wpdb->get_row(
			$wpdb->prepare( 'SELECT f.*, (SELECT COUNT(*) FROM %i r WHERE r.fee_type_id = f.id) AS overrides_count FROM %i f WHERE f.id = %d LIMIT 1', Schema::fee_type_class_rates(), Schema::fee_types(), $id ),
			ARRAY_A
		);
		// phpcs:enable
		if ( $row ) {
			$row['id']                   = (int) $row['id'];
			$row['default_amount_minor'] = (int) $row['default_amount_minor'];
			$row['overrides_count']      = (int) $row['overrides_count'];
		}
		return $row ?: [];
	}

	/**
	 * Updates a fee type template.
	 */
	public function update_fee_type( int $id, array $data ): array|WP_Error {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$existing = $wpdb->get_row(
			$wpdb->prepare( 'SELECT id FROM %i WHERE id = %d AND deleted_at IS NULL LIMIT 1', Schema::fee_types(), $id )
		);
		// phpcs:enable
		if ( ! $existing ) {
			return new WP_Error( 'not_found', __( 'Fee type not found.', 'codeclove-school-management' ), 404 );
		}

		$update = [ 'updated_at' => current_time( 'mysql', true ) ];

		if ( isset( $data['name'] ) ) {
			$update['name'] = sanitize_text_field( $data['name'] );
		}
		if ( isset( $data['code'] ) ) {
			$code = ! empty( $data['code'] ) ? sanitize_title( $data['code'] ) : null;
			if ( null !== $code ) {
				// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
				$dup = $wpdb->get_var(
					$wpdb->prepare( 'SELECT id FROM %i WHERE code = %s AND id != %d AND deleted_at IS NULL LIMIT 1', Schema::fee_types(), $code, $id )
				);
				// phpcs:enable
				if ( $dup ) {
					return new WP_Error( 'duplicate_code', __( 'A fee type with this code already exists.', 'codeclove-school-management' ), 400 );
				}
			}
			$update['code'] = $code;
		}
		if ( isset( $data['description'] ) ) {
			$update['description'] = sanitize_textarea_field( $data['description'] );
		}
		if ( isset( $data['default_amount_minor'] ) ) {
			$update['default_amount_minor'] = (int) $data['default_amount_minor'];
		}
		if ( isset( $data['currency'] ) ) {
			$update['currency'] = strtoupper( sanitize_text_field( $data['currency'] ) );
		}
		if ( isset( $data['frequency'] ) ) {
			$frequency = sanitize_text_field( $data['frequency'] );
			if ( ! in_array( $frequency, self::VALID_FREQUENCIES, true ) ) {
				/* translators: %s: allowed frequency values */
				return new WP_Error( 'invalid_field', sprintf( __( 'Invalid frequency. Allowed: %s.', 'codeclove-school-management' ), implode( ', ', self::VALID_FREQUENCIES ) ), 400 );
			}
			$update['frequency'] = $frequency;
		}
		if ( isset( $data['scope'] ) ) {
			$scope = sanitize_text_field( $data['scope'] );
			if ( ! in_array( $scope, self::VALID_SCOPES, true ) ) {
				/* translators: %s: allowed scope values */
				return new WP_Error( 'invalid_field', sprintf( __( 'Invalid scope. Allowed: %s.', 'codeclove-school-management' ), implode( ', ', self::VALID_SCOPES ) ), 400 );
			}
			$update['scope'] = $scope;
		}
		if ( isset( $data['status'] ) ) {
			$status = sanitize_text_field( $data['status'] );
			if ( ! in_array( $status, self::VALID_FEE_STATUSES, true ) ) {
				/* translators: %s: allowed status values */
				return new WP_Error( 'invalid_field', sprintf( __( 'Invalid status. Allowed: %s.', 'codeclove-school-management' ), implode( ', ', self::VALID_FEE_STATUSES ) ), 400 );
			}
			$update['status'] = $status;
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->update( Schema::fee_types(), $update, [ 'id' => $id ] );
		// phpcs:enable
		return $this->get_fee_type_by_id( $id );
	}

	/**
	 * Soft deletes a fee type template.
	 * Returns active_invoice_count so the frontend can warn the user if needed.
	 */
	public function delete_fee_type( int $id ): array|WP_Error {
		global $wpdb;

		$table = Schema::fee_types();
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$exists = $wpdb->get_var(
			$wpdb->prepare( 'SELECT id FROM %i WHERE id = %d AND deleted_at IS NULL LIMIT 1', Schema::fee_types(), $id )
		);
		// phpcs:enable
		if ( ! $exists ) {
			return new WP_Error( 'not_found', __( 'Fee type not found.', 'codeclove-school-management' ), 404 );
		}

		// Count active invoices referencing this fee type (for UI warning).
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$active_invoice_count = (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT COUNT(DISTINCT li.invoice_id)
				FROM %i li
				INNER JOIN %i i ON i.id = li.invoice_id
				WHERE li.fee_type_id = %d AND i.deleted_at IS NULL AND i.status NOT IN (\'cancelled\', \'void\')', Schema::line_items(), Schema::invoices(), $id )
		);
		// phpcs:enable
		// Fetch current code and append deleted timestamp to release MySQL UNIQUE KEY uq_code for future re-use
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$current_code = $wpdb->get_var(
			$wpdb->prepare( 'SELECT code FROM %i WHERE id = %d', Schema::fee_types(), $id )
		);
		$new_code     = $current_code ? $current_code . '__deleted_' . time() : null;

		$wpdb->update(
			Schema::fee_types(),
			[
				'code'       => $new_code,
				'deleted_at' => current_time( 'mysql', true ),
				'updated_at' => current_time( 'mysql', true ),
			],
			[ 'id' => $id ]
		);
		// phpcs:enable
		return [
			'deleted'              => true,
			'active_invoice_count' => $active_invoice_count,
		];
	}


	// ─── Fee Type Class Rates ─────────────────────────────────────────────────

	/**
	 * Returns all class rates for a given fee type.
	 */
	public function get_class_rates( int $fee_type_id ): array {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$rows = $wpdb->get_results(
			$wpdb->prepare( 'SELECT r.*, u.name AS unit_name
				FROM %i r
				LEFT JOIN %i u ON u.id = r.academic_unit_id
				WHERE r.fee_type_id = %d
				ORDER BY u.name ASC', Schema::fee_type_class_rates(), Schema::units(), $fee_type_id ),
			ARRAY_A
		);
		// phpcs:enable

		return array_map( function( $r ) {
			$r['amount_minor']         = (int) $r['amount_minor'];
			$r['academic_unit_id']     = (int) $r['academic_unit_id'];
			$r['fee_type_id']          = (int) $r['fee_type_id'];
			return $r;
		}, $rows ?: [] );
	}

	/**
	 * Upserts a class rate for a fee type + unit pair.
	 * ponytail: INSERT … ON DUPLICATE KEY UPDATE — one query, no race condition.
	 */
	public function upsert_class_rate( int $fee_type_id, int $unit_id, int $amount_minor ): array|WP_Error {
		global $wpdb;

		if ( $amount_minor < 0 ) {
			return new WP_Error( 'invalid_amount', __( 'Amount cannot be negative.', 'codeclove-school-management' ), 400 );
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->query(
			$wpdb->prepare( 'INSERT INTO %i (fee_type_id, academic_unit_id, amount_minor, created_at, updated_at)
				VALUES (%d, %d, %d, %s, %s)
				ON DUPLICATE KEY UPDATE amount_minor = VALUES(amount_minor), updated_at = VALUES(updated_at)', Schema::fee_type_class_rates(), $fee_type_id, $unit_id, $amount_minor, current_time( 'mysql', true ), current_time( 'mysql', true ) )
		);
		// phpcs:enable

		return [
			'fee_type_id'      => $fee_type_id,
			'academic_unit_id' => $unit_id,
			'amount_minor'     => $amount_minor,
		];
	}

	/**
	 * Removes a class rate entry.
	 */
	public function delete_class_rate( int $fee_type_id, int $unit_id ): bool {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->delete(
			Schema::fee_type_class_rates(),
			[ 'fee_type_id' => $fee_type_id, 'academic_unit_id' => $unit_id ]
		);
		// phpcs:enable

		return true;
	}

	/**
	 * Looks up the best amount_minor for a given fee type + student.
	 * Checks the student's enrolled unit; falls back to fee_type.default_amount_minor.
	 */
	public function resolve_fee_amount( int $fee_type_id, int $student_id, int $session_id ): int {
		global $wpdb;

		// ponytail: single JOIN query — avoids two round trips
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$result = $wpdb->get_row(
			$wpdb->prepare( 'SELECT COALESCE(r.amount_minor, ft.default_amount_minor) AS amount_minor
				FROM %i ft
				LEFT JOIN %i e
					ON e.student_id = %d AND e.academic_session_id = %d AND e.status != \'withdrawn\'
				LEFT JOIN %i r
					ON r.fee_type_id = ft.id AND r.academic_unit_id = e.academic_unit_id
				WHERE ft.id = %d AND ft.deleted_at IS NULL
				LIMIT 1', Schema::fee_types(), Schema::enrollments(), Schema::fee_type_class_rates(), $student_id, $session_id, $fee_type_id ),
			ARRAY_A
		);
		// phpcs:enable
		return $result ? (int) $result['amount_minor'] : 0;
	}


	// ─── Invoices CRUD ───────────────────────────────────────────────────────

	/**
	 * Builds the WHERE clause and binds for invoice queries.
	 * Extracted to eliminate duplication between get_invoices() and count_invoices().
	 *
	 * @param array $params Normalised query parameters.
	 * @return array{0: string, 1: array} [$where_sql, $binds]
	 */
	private function build_invoice_where( array $params ): array {
		global $wpdb;

		$where = 'i.deleted_at IS NULL';
		$binds = [];

		if ( ! empty( $params['student_id'] ) ) {
			$where   .= ' AND i.student_id = %d';
			$binds[] = (int) $params['student_id'];
		}

		if ( ! empty( $params['academic_session_id'] ) ) {
			$where   .= ' AND i.academic_session_id = %d';
			$binds[] = (int) $params['academic_session_id'];
		}

		if ( ! empty( $params['academic_term_id'] ) ) {
			$where   .= ' AND i.academic_term_id = %d';
			$binds[] = (int) $params['academic_term_id'];
		}

		if ( ! empty( $params['academic_unit_id'] ) ) {
			$where   .= ' AND e.academic_unit_id = %d';
			$binds[] = (int) $params['academic_unit_id'];
		}

		$date_col = 'due_date' === $params['date_type'] ? 'due_date' : 'issue_date';

		if ( ! empty( $params['start_date'] ) ) {
			$where   .= " AND i.{$date_col} >= %s";
			$binds[] = sanitize_text_field( $params['start_date'] );
		}

		if ( ! empty( $params['end_date'] ) ) {
			$where   .= " AND i.{$date_col} <= %s";
			$binds[] = sanitize_text_field( $params['end_date'] );
		}

		if ( ! empty( $params['status'] ) ) {
			if ( 'unpaid' === $params['status'] ) {
				// ponytail: unpaid is a UI concept mapped to three DB statuses
				$where .= " AND i.status IN ('issued', 'partially_paid', 'overdue')";
			} else {
				$where   .= ' AND i.status = %s';
				$binds[] = sanitize_text_field( $params['status'] );
			}
		}

		if ( ! empty( $params['search'] ) ) {
			$where   .= ' AND (i.invoice_number LIKE %s OR i.guardian_name LIKE %s OR s.first_name LIKE %s OR s.last_name LIKE %s)';
			$like    = '%' . $wpdb->esc_like( $params['search'] ) . '%';
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
		}

		return [ $where, $binds ];
	}

	/**
	 * Gets student invoices list.
	 */
	public function get_invoices( array $args = [] ): array {
		global $wpdb;

		$params = array_merge(
			[
				'student_id'          => 0,
				'academic_session_id' => 0,
				'academic_term_id'    => 0,
				'academic_unit_id'    => 0,
				'start_date'          => '',
				'end_date'            => '',
				'date_type'           => 'issue_date',
				'status'              => '',
				'search'              => '',
				'order_by'            => 'created_at',
				'order'               => 'DESC',
				'limit'               => 25,
				'offset'              => 0,
			],
			$args
		);

		$invoices_table    = Schema::invoices();
		$students_table    = Schema::students();
		$enrollments_table = Schema::enrollments();
		$terms_table       = Schema::terms();
		$sessions_table    = Schema::sessions();
		$line_items_table  = Schema::line_items();
		$units_table       = Schema::units();
		$groups_table      = Schema::groups();
		[ $where, $binds ] = $this->build_invoice_where( $params );

		$allowed_sort = [
			'invoice_number' => 'i.invoice_number',
			'student_name'   => 's.first_name',
			'issue_date'     => 'i.issue_date',
			'due_date'       => 'i.due_date',
			'total'          => 'i.total_minor',
			'balance'        => 'i.balance_minor',
			'created_at'     => 'i.created_at',
		];

		$order_by = $allowed_sort[ $params['order_by'] ] ?? 'i.created_at';
		$order    = in_array( strtoupper( $params['order'] ), [ 'ASC', 'DESC' ], true ) ? strtoupper( $params['order'] ) : 'DESC';

		$order_clause = 's.first_name' === $order_by
			? "ORDER BY s.first_name {$order}, s.last_name {$order}"
			: "ORDER BY {$order_by} {$order}";

		$query = "SELECT i.*, 
				s.first_name as student_first_name, s.last_name as student_last_name, s.student_number,
				t.name as academic_term_name,
				sess.name as academic_session_name,
				u.name as academic_unit_name,
				g.name as academic_group_name,
				(SELECT description FROM {$line_items_table} WHERE invoice_id = i.id ORDER BY sort_order ASC, id ASC LIMIT 1) as first_item_description
			FROM {$invoices_table} i
			LEFT JOIN {$students_table} s ON s.id = i.student_id
			LEFT JOIN {$enrollments_table} e ON e.student_id = i.student_id AND e.academic_session_id = i.academic_session_id
			LEFT JOIN {$terms_table} t ON t.id = i.academic_term_id
			LEFT JOIN {$sessions_table} sess ON sess.id = i.academic_session_id
			LEFT JOIN {$units_table} u ON u.id = i.academic_unit_id
			LEFT JOIN {$groups_table} g ON g.id = i.academic_group_id
			WHERE {$where}
			{$order_clause}";

		if ( $params['limit'] > 0 ) {
			$query   .= ' LIMIT %d OFFSET %d';
			$binds[] = (int) $params['limit'];
			$binds[] = (int) $params['offset'];
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$results = [] !== $binds ? $wpdb->get_results( $wpdb->prepare( $query, ...$binds ), ARRAY_A ) : $wpdb->get_results( $query, ARRAY_A );
		// phpcs:enable

		foreach ( $results as &$row ) {
			$this->cast_invoice_row( $row );
		}

		return $results;
	}

	/**
	 * Counts student invoices matching query.
	 */
	public function count_invoices( array $args = [] ): int {
		global $wpdb;

		$params = array_merge(
			[
				'student_id'          => 0,
				'academic_session_id' => 0,
				'academic_term_id'    => 0,
				'academic_unit_id'    => 0,
				'start_date'          => '',
				'end_date'            => '',
				'date_type'           => 'issue_date',
				'status'              => '',
				'search'              => '',
			],
			$args
		);

		$invoices_table    = Schema::invoices();
		$students_table    = Schema::students();
		$enrollments_table = Schema::enrollments();

		[ $where, $binds ] = $this->build_invoice_where( $params );

		$query = "SELECT COUNT(*)
			FROM {$invoices_table} i
			LEFT JOIN {$students_table} s ON s.id = i.student_id
			LEFT JOIN {$enrollments_table} e ON e.student_id = i.student_id AND e.academic_session_id = i.academic_session_id
			WHERE {$where}";

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		return (int) ( [] !== $binds ? $wpdb->get_var( $wpdb->prepare( $query, ...$binds ) ) : $wpdb->get_var( $query ) );
		// phpcs:enable
	}

	/**
	 * Gets a single invoice with line items and manual payments.
	 */
	public function get_invoice( int $id ): ?array {
		global $wpdb;

		$invoices_table   = Schema::invoices();
		$students_table   = Schema::students();
		$line_items_table = Schema::line_items();
		$payments_table   = Schema::payments();
		$terms_table      = Schema::terms();
		$sessions_table   = Schema::sessions();
		$units_table      = Schema::units();
		$groups_table     = Schema::groups();
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$invoice = $wpdb->get_row(
			$wpdb->prepare( 'SELECT i.*, 
					s.first_name as student_first_name, s.last_name as student_last_name, s.student_number,
					t.name as academic_term_name,
					sess.name as academic_session_name,
					u.name as academic_unit_name,
					g.name as academic_group_name
				FROM %i i
				LEFT JOIN %i s ON s.id = i.student_id
				LEFT JOIN %i t ON t.id = i.academic_term_id
				LEFT JOIN %i sess ON sess.id = i.academic_session_id
				LEFT JOIN %i u ON u.id = i.academic_unit_id
				LEFT JOIN %i g ON g.id = i.academic_group_id
				WHERE i.id = %d AND i.deleted_at IS NULL LIMIT 1', Schema::invoices(), Schema::students(), Schema::terms(), Schema::sessions(), Schema::units(), Schema::groups(), $id ),
			ARRAY_A
		);
		// phpcs:enable

		if ( ! $invoice ) {
			return null;
		}

		$this->cast_invoice_row( $invoice );

		// Get line items.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$line_items = $wpdb->get_results(
			$wpdb->prepare( 'SELECT * FROM %i WHERE invoice_id = %d ORDER BY sort_order ASC, id ASC', Schema::line_items(), $id ),
			ARRAY_A
		);
		// phpcs:enable

		foreach ( $line_items as &$li ) {
			$li['id']                = (int) $li['id'];
			$li['invoice_id']        = (int) $li['invoice_id'];
			$li['fee_type_id']       = $li['fee_type_id'] ? (int) $li['fee_type_id'] : null;
			$li['quantity']          = (float) $li['quantity'];
			$li['unit_amount_minor'] = (int) $li['unit_amount_minor'];
			$li['discount_minor']    = (int) $li['discount_minor'];
			$li['total_minor']       = (int) $li['total_minor'];
			$li['sort_order']        = (int) $li['sort_order'];
		}
		$invoice['line_items'] = $line_items;

		// Get payments.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$payments = $wpdb->get_results(
			$wpdb->prepare( 'SELECT * FROM %i WHERE invoice_id = %d AND deleted_at IS NULL ORDER BY paid_on DESC, id DESC', Schema::payments(), $id ),
			ARRAY_A
		);
		// phpcs:enable

		foreach ( $payments as &$pay ) {
			$this->cast_payment_row( $pay );
		}
		$invoice['payments'] = $payments;

		return $invoice;
	}

	/**
	 * Creates a student invoice along with line items inside a transaction.
	 */
	public function create_invoice( array $payload ): array|WP_Error {
		global $wpdb;

		if ( empty( $payload['student_id'] ) ) {
			return new WP_Error( 'missing_field', __( 'Student ID is required.', 'codeclove-school-management' ), 400 );
		}
		if ( empty( $payload['academic_session_id'] ) ) {
			return new WP_Error( 'missing_field', __( 'Academic Session ID is required.', 'codeclove-school-management' ), 400 );
		}
		if ( empty( $payload['line_items'] ) || ! is_array( $payload['line_items'] ) ) {
			return new WP_Error( 'missing_field', __( 'Invoice must contain at least one line item.', 'codeclove-school-management' ), 400 );
		}

		// Check for duplicates.
		$student_id = (int) $payload['student_id'];
		$session_id = (int) $payload['academic_session_id'];
		$term_id    = ! empty( $payload['academic_term_id'] ) ? (int) $payload['academic_term_id'] : null;

		$fee_type_ids = [];
		foreach ( $payload['line_items'] as $li ) {
			if ( ! empty( $li['fee_type_id'] ) ) {
				$fee_type_ids[] = (int) $li['fee_type_id'];
			}
		}

		if ( ! empty( $fee_type_ids ) && empty( $payload['force'] ) ) {
			$invoices_table   = Schema::invoices();
			$line_items_table = Schema::line_items();
			$term_condition   = $term_id ? "AND i.academic_term_id = %d" : "AND i.academic_term_id IS NULL";
			$prepare_args     = [ $student_id, $session_id ];
			if ( $term_id ) {
				$prepare_args[] = $term_id;
			}
			$placeholders = implode( ',', array_fill( 0, count( $fee_type_ids ), '%d' ) );
			foreach ( $fee_type_ids as $ftid ) {
				$prepare_args[] = $ftid;
			}

			$query = 'SELECT i.id FROM ' . Schema::invoices() . ' i
				INNER JOIN ' . Schema::line_items() . " li ON li.invoice_id = i.id
				WHERE i.student_id = %d
					AND i.academic_session_id = %d
					{$term_condition}
					AND li.fee_type_id IN ({$placeholders})
					AND i.status NOT IN ('cancelled', 'void')
					AND i.deleted_at IS NULL
				LIMIT 1";

			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$duplicate_id = $wpdb->get_var( $wpdb->prepare( $query, ...$prepare_args ) );
			// phpcs:enable
			if ( $duplicate_id ) {
				return [
					'warning'             => 'duplicate_invoice',
					'existing_invoice_id' => (int) $duplicate_id,
				];
			}
		}

		$invoice_number = IdentifierService::generate( 'invoice_number' );
		if ( is_wp_error( $invoice_number ) ) {
			return $invoice_number;
		}

		$result = Transaction::run( function( $wpdb ) use ( $payload, $invoice_number ) {
			$subtotal_minor = 0;
			$tax_minor      = 0;
			$line_inserts   = [];
			$sort_order     = 0;

			foreach ( $payload['line_items'] as $li ) {
				if ( empty( $li['description'] ) ) {
					throw new \Exception( esc_html__( 'Line item description is required.', 'codeclove-school-management' ) );
				}
				$quantity      = isset( $li['quantity'] ) ? (float) $li['quantity'] : 1.0;
				$unit_amount   = isset( $li['unit_amount_minor'] ) ? (int) $li['unit_amount_minor'] : 0;
				$line_discount = isset( $li['discount_minor'] ) ? (int) $li['discount_minor'] : 0;
				$line_tax      = isset( $li['tax_minor'] ) ? (int) $li['tax_minor'] : 0;

				$line_total = max( 0, (int) round( $quantity * $unit_amount ) - $line_discount );
				$subtotal_minor += $line_total;
				$tax_minor      += $line_tax;

				$line_inserts[] = [
					'fee_type_id'       => ! empty( $li['fee_type_id'] ) ? (int) $li['fee_type_id'] : null,
					'description'       => sanitize_text_field( $li['description'] ),
					'quantity'          => $quantity,
					'unit_amount_minor' => $unit_amount,
					'discount_minor'    => $line_discount,
					'discount_type'     => ! empty( $li['discount_type'] ) ? sanitize_text_field( $li['discount_type'] ) : null,
					'total_minor'       => $line_total,
					'tax_minor'         => $line_tax,
					'sort_order'        => $sort_order++,
					'created_at'        => current_time( 'mysql', true ),
					'updated_at'        => current_time( 'mysql', true ),
				];
			}

			$discount_minor = isset( $payload['discount_minor'] ) ? (int) $payload['discount_minor'] : 0;
			$total_minor    = max( 0, $subtotal_minor - $discount_minor + $tax_minor );

			$due_date = ! empty( $payload['due_date'] ) ? sanitize_text_field( $payload['due_date'] ) : null;
			$status   = 'issued';

			// Auto-set overdue if due date already past.
			if ( null !== $due_date && $due_date < current_time( 'Y-m-d' ) ) {
				$status = 'overdue';
			}

			// Snapshot guardian from primary contact if not supplied.
			$guardian_name  = $payload['guardian_name'] ?? '';
			$guardian_email = $payload['guardian_email'] ?? '';
			if ( empty( $guardian_name ) ) {
				// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
				$primary_g = $wpdb->get_row(
					$wpdb->prepare( 'SELECT g.first_name, g.last_name, g.email
						FROM %i g
						INNER JOIN %i sg ON sg.guardian_id = g.id
						WHERE sg.student_id = %d AND g.deleted_at IS NULL
						ORDER BY sg.is_billing_contact DESC, sg.is_primary DESC
						LIMIT 1', Schema::guardians(), Schema::student_guardians(), (int) $payload['student_id'] ),
					ARRAY_A
				);
				// phpcs:enable
				if ( $primary_g ) {
					$guardian_name  = trim( $primary_g['first_name'] . ' ' . $primary_g['last_name'] );
					$guardian_email = $primary_g['email'];
				}
			}

			// Pull enrollment context for class/section snapshot.
			$academic_unit_id  = null;
			$academic_group_id = null;
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$enrollment = $wpdb->get_row(
				$wpdb->prepare( 'SELECT academic_unit_id, academic_group_id
					FROM %i
					WHERE student_id = %d AND academic_session_id = %d AND status != \'withdrawn\' LIMIT 1', Schema::enrollments(), (int) $payload['student_id'], (int) $payload['academic_session_id'] ),
				ARRAY_A
			);
			// phpcs:enable
			if ( $enrollment ) {
				$academic_unit_id  = (int) $enrollment['academic_unit_id'];
				$academic_group_id = $enrollment['academic_group_id'] ? (int) $enrollment['academic_group_id'] : null;
			}

			$invoice_insert = [
				'invoice_number'      => $invoice_number,
				'student_id'          => (int) $payload['student_id'],
				'academic_session_id' => (int) $payload['academic_session_id'],
				'academic_term_id'    => ! empty( $payload['academic_term_id'] ) ? (int) $payload['academic_term_id'] : null,
				'academic_unit_id'    => $academic_unit_id,
				'academic_group_id'   => $academic_group_id,
				'guardian_name'       => sanitize_text_field( $guardian_name ),
				'guardian_email'      => sanitize_email( $guardian_email ),
				'currency'            => ! empty( $payload['currency'] ) ? strtoupper( sanitize_text_field( $payload['currency'] ) ) : $this->currency,
				'issue_date'          => ! empty( $payload['issue_date'] ) ? sanitize_text_field( $payload['issue_date'] ) : current_time( 'Y-m-d' ),
				'due_date'            => $due_date,
				'subtotal_minor'      => $subtotal_minor,
				'discount_minor'      => $discount_minor,
				'tax_minor'           => $tax_minor,
				'total_minor'         => $total_minor,
				'paid_minor'          => 0,
				'balance_minor'       => $total_minor,
				'discount_note'       => ! empty( $payload['discount_note'] ) ? sanitize_text_field( $payload['discount_note'] ) : null,
				'status'              => $status,
				'created_by'          => get_current_user_id(),
				'updated_by'          => get_current_user_id(),
				'created_at'          => current_time( 'mysql', true ),
				'updated_at'          => current_time( 'mysql', true ),
			];

			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$inserted = $wpdb->insert( Schema::invoices(), $invoice_insert );
			// phpcs:enable
			if ( ! $inserted ) {
				Logger::error( 'Failed to insert invoice record', $wpdb->last_error );
				throw new \Exception( esc_html__( 'Failed to save student invoice record.', 'codeclove-school-management' ) );
			}

			$invoice_id = (int) $wpdb->insert_id;

			foreach ( $line_inserts as $li ) {
				$li['invoice_id'] = $invoice_id;
				// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
				if ( ! $wpdb->insert( Schema::line_items(), $li ) ) {
					Logger::error( sprintf( 'Failed to insert line item for invoice [ID %d]', $invoice_id ), $wpdb->last_error );
					throw new \Exception( esc_html__( 'Failed to save invoice line items.', 'codeclove-school-management' ) );
				}
				// phpcs:enable
			}

			return $this->get_invoice( $invoice_id ) ?: [];
		} );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		do_action( 'codeclove_invoice_issued', $result );

		return $result;
	}

	/**
	 * Updates student invoice metadata.
	 *
	 * Status is intentionally excluded — it is computed by recalculate_invoice_balance().
	 * Use cancel_invoice() or void_invoice() for explicit status transitions.
	 */
	public function update_invoice( int $id, array $data ): array|WP_Error {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$invoice = $wpdb->get_row(
			$wpdb->prepare( 'SELECT * FROM %i WHERE id = %d AND deleted_at IS NULL LIMIT 1', Schema::invoices(), $id ),
			ARRAY_A
		);
		// phpcs:enable

		// Lock structural fields once payments exist.
		$has_payments = (int) $invoice['paid_minor'] > 0;

		$update = [
			'updated_by' => get_current_user_id(),
			'updated_at' => current_time( 'mysql', true ),
		];

		// due_date is allowed to change even after payments (e.g. extension granted).
		if ( isset( $data['due_date'] ) ) {
			$update['due_date'] = ! empty( $data['due_date'] ) ? sanitize_text_field( $data['due_date'] ) : null;
		}
		// Guardian snapshot fields — locked once invoice has payments.
		if ( ! $has_payments ) {
			if ( isset( $data['guardian_name'] ) ) {
				$update['guardian_name'] = sanitize_text_field( $data['guardian_name'] );
			}
			if ( isset( $data['guardian_email'] ) ) {
				$update['guardian_email'] = sanitize_email( $data['guardian_email'] );
			}
		}
		if ( isset( $data['discount_note'] ) ) {
			$update['discount_note'] = sanitize_text_field( $data['discount_note'] );
		}
		if ( isset( $data['academic_term_id'] ) ) {
			$update['academic_term_id'] = ! empty( $data['academic_term_id'] ) ? (int) $data['academic_term_id'] : null;
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->update( Schema::invoices(), $update, [ 'id' => $id ] );
		// phpcs:enable

		// Recompute status and balance (due_date change can flip overdue state).
		$this->recalculate_invoice_balance( $id );

		return $this->get_invoice( $id ) ?: [];
	}

	/**
	 * Cancels an invoice (sets status = cancelled, soft-deletes).
	 */
	public function cancel_invoice( int $id, ?string $reason = null ): bool|WP_Error {
		return $this->transition_invoice_status( $id, 'cancelled', $reason );
	}

	/**
	 * Voids an invoice (sets status = void, soft-deletes).
	 */
	public function void_invoice( int $id, ?string $reason = null ): bool|WP_Error {
		return $this->transition_invoice_status( $id, 'void', $reason );
	}

	/**
	 * Applies a terminal status to an invoice and soft-deletes it.
	 */
	private function transition_invoice_status( int $id, string $new_status, ?string $reason = null ): bool|WP_Error {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$exists = $wpdb->get_var(
			$wpdb->prepare( 'SELECT id FROM %i WHERE id = %d AND deleted_at IS NULL LIMIT 1', Schema::invoices(), $id )
		);
		if ( ! $exists ) {
			return new WP_Error( 'not_found', __( 'Invoice not found.', 'codeclove-school-management' ), 404 );
		}

		$paid = (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT paid_minor FROM %i WHERE id = %d LIMIT 1', Schema::invoices(), $id )
		);
		if ( $paid > 0 ) {
			return new WP_Error(
				'invoice_has_payments',
				__( 'Cancel all payments before voiding or cancelling this invoice.', 'codeclove-school-management' ),
				422
			);
		}

		$wpdb->update(
			Schema::invoices(),
			[
				'status'              => $new_status,
				'cancellation_reason' => $reason ? sanitize_text_field( $reason ) : null,
				'deleted_at'          => current_time( 'mysql', true ),
				'updated_at'          => current_time( 'mysql', true ),
			],
			[ 'id' => $id ]
		);
		// phpcs:enable

		return true;
	}


	// ─── Payments Journal ───────────────────────────────────────────────────

	/**
	 * Builds the WHERE clause and binds for payment queries.
	 * Extracted to eliminate duplication between get_payments() and count_payments().
	 *
	 * @param array $params Normalised query parameters.
	 * @return array{0: string, 1: array} [$where_sql, $binds]
	 */
	private function build_payment_where( array $params ): array {
		global $wpdb;

		$where = 'p.deleted_at IS NULL';
		$binds = [];

		if ( ! empty( $params['student_id'] ) ) {
			$where   .= ' AND p.student_id = %d';
			$binds[] = (int) $params['student_id'];
		}

		if ( ! empty( $params['invoice_id'] ) ) {
			$where   .= ' AND p.invoice_id = %d';
			$binds[] = (int) $params['invoice_id'];
		}

		if ( ! empty( $params['academic_session_id'] ) ) {
			$where   .= ' AND p.academic_session_id = %d';
			$binds[] = (int) $params['academic_session_id'];
		}

		if ( ! empty( $params['method'] ) ) {
			$where   .= ' AND p.method = %s';
			$binds[] = sanitize_text_field( $params['method'] );
		}

		if ( ! empty( $params['status'] ) ) {
			$where   .= ' AND p.status = %s';
			$binds[] = sanitize_text_field( $params['status'] );
		}

		if ( ! empty( $params['start_date'] ) ) {
			$where   .= ' AND p.paid_on >= %s';
			$binds[] = sanitize_text_field( $params['start_date'] );
		}

		if ( ! empty( $params['end_date'] ) ) {
			$where   .= ' AND p.paid_on <= %s';
			$binds[] = sanitize_text_field( $params['end_date'] );
		}

		if ( ! empty( $params['search'] ) ) {
			$where   .= ' AND (p.payment_number LIKE %s OR p.reference LIKE %s OR i.invoice_number LIKE %s OR s.first_name LIKE %s OR s.last_name LIKE %s)';
			$like    = '%' . $wpdb->esc_like( $params['search'] ) . '%';
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
		}

		return [ $where, $binds ];
	}

	/**
	 * Gets payment journal entries.
	 */
	public function get_payments( array $args = [] ): array {
		global $wpdb;

		$params = array_merge(
			[
				'student_id'          => 0,
				'invoice_id'          => 0,
				'academic_session_id' => 0,
				'method'              => '',
				'status'              => '',
				'start_date'          => '',
				'end_date'            => '',
				'search'              => '',
				'limit'               => 25,
				'offset'              => 0,
			],
			$args
		);

		$payments_table = Schema::payments();
		$students_table = Schema::students();
		$invoices_table = Schema::invoices();

		[ $where, $binds ] = $this->build_payment_where( $params );

		$query = "SELECT p.*, s.first_name as student_first_name, s.last_name as student_last_name, s.student_number, i.invoice_number
			FROM {$payments_table} p
			LEFT JOIN {$students_table} s ON s.id = p.student_id
			LEFT JOIN {$invoices_table} i ON i.id = p.invoice_id
			WHERE {$where}
			ORDER BY p.paid_on DESC, p.created_at DESC";

		if ( $params['limit'] > 0 ) {
			$query   .= ' LIMIT %d OFFSET %d';
			$binds[] = (int) $params['limit'];
			$binds[] = (int) $params['offset'];
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$results = [] !== $binds ? $wpdb->get_results( $wpdb->prepare( $query, ...$binds ), ARRAY_A ) : $wpdb->get_results( $query, ARRAY_A );
		// phpcs:enable

		foreach ( $results as &$row ) {
			$this->cast_payment_row( $row );
		}

		return $results;
	}

	/**
	 * Counts payments matching query.
	 */
	public function count_payments( array $args = [] ): int {
		global $wpdb;

		$params = array_merge(
			[
				'student_id'          => 0,
				'invoice_id'          => 0,
				'academic_session_id' => 0,
				'method'              => '',
				'status'              => '',
				'start_date'          => '',
				'end_date'            => '',
				'search'              => '',
			],
			$args
		);

		$payments_table = Schema::payments();
		$students_table = Schema::students();
		$invoices_table = Schema::invoices();

		[ $where, $binds ] = $this->build_payment_where( $params );

		$query = "SELECT COUNT(*)
			FROM {$payments_table} p
			LEFT JOIN {$students_table} s ON s.id = p.student_id
			LEFT JOIN {$invoices_table} i ON i.id = p.invoice_id
			WHERE {$where}";

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		return (int) ( [] !== $binds ? $wpdb->get_var( $wpdb->prepare( $query, ...$binds ) ) : $wpdb->get_var( $query ) );
		// phpcs:enable
	}

	/**
	 * Gets a single payment by ID.
	 */
	public function get_payment( int $id ): ?array {
		global $wpdb;

		$payments_table = Schema::payments();
		$students_table = Schema::students();
		$invoices_table = Schema::invoices();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$row = $wpdb->get_row(
			$wpdb->prepare( 'SELECT p.*, s.first_name as student_first_name, s.last_name as student_last_name, s.student_number, i.invoice_number
				FROM %i p
				LEFT JOIN %i s ON s.id = p.student_id
				LEFT JOIN %i i ON i.id = p.invoice_id
				WHERE p.id = %d AND p.deleted_at IS NULL LIMIT 1', Schema::payments(), Schema::students(), Schema::invoices(), $id ),
			ARRAY_A
		);
		// phpcs:enable

		if ( ! $row ) {
			return null;
		}

		$this->cast_payment_row( $row );
		return $row;
	}

	/**
	 * Records a manual payment against a student invoice inside a transaction.
	 */
	public function record_payment( array $payload ): array|WP_Error {
		global $wpdb;

		if ( empty( $payload['invoice_id'] ) ) {
			return new WP_Error( 'missing_field', __( 'Invoice ID is required.', 'codeclove-school-management' ), 400 );
		}
		if ( empty( $payload['amount_minor'] ) || (int) $payload['amount_minor'] <= 0 ) {
			return new WP_Error( 'invalid_amount', __( 'Payment amount must be greater than zero.', 'codeclove-school-management' ), 400 );
		}

		// Validate paid_on date format.
		if ( ! empty( $payload['paid_on'] ) ) {
			$parsed = \DateTime::createFromFormat( 'Y-m-d', $payload['paid_on'] );
			if ( ! $parsed || $parsed->format( 'Y-m-d' ) !== $payload['paid_on'] ) {
				return new WP_Error( 'invalid_date', __( 'paid_on must be a valid date in YYYY-MM-DD format.', 'codeclove-school-management' ), 400 );
			}
		}

		// Validate payment method.
		$method = ! empty( $payload['method'] ) ? sanitize_text_field( $payload['method'] ) : 'cash';
		if ( ! in_array( $method, self::VALID_METHODS, true ) ) {
			/* translators: %s: allowed payment methods */
			return new WP_Error( 'invalid_field', sprintf( __( 'Invalid method. Allowed: %s.', 'codeclove-school-management' ), implode( ', ', self::VALID_METHODS ) ), 400 );
		}

		$invoices_table = Schema::invoices();
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$invoice = $wpdb->get_row(
			$wpdb->prepare( 'SELECT * FROM %i WHERE id = %d AND deleted_at IS NULL LIMIT 1', Schema::invoices(), (int) $payload['invoice_id'] ),
			ARRAY_A
		);
		// phpcs:enable

		$payable_statuses = [ 'issued', 'partially_paid', 'overdue' ];
		if ( ! in_array( $invoice['status'], $payable_statuses, true ) ) {
			return new WP_Error(
				'invoice_not_payable',
				/* translators: %s: invoice status */
				sprintf( __( 'Payments cannot be recorded against a %s invoice.', 'codeclove-school-management' ), $invoice['status'] ),
				422
			);
		}

		$amount_minor = (int) $payload['amount_minor'];

		$payment_number = IdentifierService::generate( 'payment_number' );
		if ( is_wp_error( $payment_number ) ) {
			return $payment_number;
		}

		$result = Transaction::run( function( $wpdb ) use ( $invoice, $payload, $method, $amount_minor, $payment_number ) {
			// C1 fix: compute remaining balance inside the transaction using a fresh SUM
			// to prevent race condition on cached balance_minor column.
			$payments_table = Schema::payments();
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$total_paid_so_far = (int) $wpdb->get_var(
				$wpdb->prepare( 'SELECT COALESCE(SUM(amount_minor), 0) FROM %i
					WHERE invoice_id = %d AND status = \'completed\' AND deleted_at IS NULL', Schema::payments(), (int) $invoice['id'] )
			);
			// phpcs:enable
			$remaining_balance = (int) $invoice['total_minor'] - $total_paid_so_far;

			// ponytail: restrict overpayments strictly in V1
			if ( $amount_minor > $remaining_balance ) {
				// CL2 fix: format as decimal amount, not raw minor units.
				$divisor   = 100; // ponytail: standard 2-decimal currencies; extend when supporting JPY etc.
				$formatted_amount    = number_format( $amount_minor / $divisor, 2 );
				$formatted_balance   = number_format( $remaining_balance / $divisor, 2 );
				$currency_code       = $invoice['currency'] ?? $this->currency;
				return new WP_Error(
					'payment_failed',
					sprintf(
						/* translators: 1: currency code, 2: payment amount, 3: currency code, 4: remaining balance */
						__( 'Payment amount (%1$s %2$s) exceeds remaining invoice balance (%3$s %4$s).', 'codeclove-school-management' ),
						$currency_code,
						$formatted_amount,
						$currency_code,
						$formatted_balance
					),
					[ 'status' => 400 ]
				);
			}

			$insert = [
				'payment_number'      => $payment_number,
				'invoice_id'          => (int) $invoice['id'],
				'student_id'          => (int) $invoice['student_id'],
				'academic_session_id' => (int) $invoice['academic_session_id'],
				'amount_minor'        => $amount_minor,
				'currency'            => $invoice['currency'],
				'method'              => $method, // validated above
				'payment_source'      => 'manual', // ponytail: gateway sources written by gateway adapters in V2
				'status'              => 'completed',
				'paid_on'             => ! empty( $payload['paid_on'] ) ? sanitize_text_field( $payload['paid_on'] ) : current_time( 'Y-m-d' ),
				'reference'           => ! empty( $payload['reference'] ) ? sanitize_text_field( $payload['reference'] ) : null,
				'note'                => ! empty( $payload['note'] ) ? sanitize_textarea_field( $payload['note'] ) : null,
				'created_by'          => get_current_user_id(),
				'updated_by'          => get_current_user_id(),
				'created_at'          => current_time( 'mysql', true ),
				'updated_at'          => current_time( 'mysql', true ),
			];

			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$inserted = $wpdb->insert( Schema::payments(), $insert );
			// phpcs:enable
			if ( ! $inserted ) {
				throw new \Exception( esc_html__( 'Failed to record payment.', 'codeclove-school-management' ) );
			}

			$payment_id = (int) $wpdb->insert_id;

			// C2 fix: recalculate BEFORE commit so invoice balance is consistent atomically.
			$this->recalculate_invoice_balance( (int) $invoice['id'] );

			return $this->get_payment_by_id( $payment_id );
		} );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		// W2: fire action so email/PDF listeners can hook in (V2).
		do_action( 'codeclove_payment_recorded', $result );

		return $result;
	}

	/**
	 * Gets a single payment receipt by ID (internal, no joins).
	 */
	private function get_payment_by_id( int $id ): array {
		global $wpdb;
		$table = Schema::payments();
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$row = $wpdb->get_row(
			$wpdb->prepare( 'SELECT * FROM %i WHERE id = %d LIMIT 1', Schema::payments(), $id ),
			ARRAY_A
		);
		// phpcs:enable
		if ( $row ) {
			$this->cast_payment_row( $row );
		}
		return $row ?: [];
	}

	/**
	 * Cancels a payment (sets status = cancelled, soft-deletes, recalculates invoice).
	 */
	public function cancel_payment( int $id, ?string $reason = null ): bool|WP_Error {
		global $wpdb;

		$payments_table = Schema::payments();
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$payment = $wpdb->get_row(
			$wpdb->prepare( 'SELECT id, invoice_id, status, payment_source FROM %i WHERE id = %d AND deleted_at IS NULL LIMIT 1', Schema::payments(), $id ),
			ARRAY_A
		);
		// phpcs:enable
		if ( ! $payment ) {
			return new WP_Error( 'not_found', __( 'Payment record not found.', 'codeclove-school-management' ), 404 );
		}

		// Only manual payments can be cancelled from the UI.
		// Gateway payments (Razorpay, Stripe) must be refunded through the gateway.
		if ( ( $payment['payment_source'] ?? 'manual' ) !== 'manual' ) {
			return new WP_Error(
				'gateway_payment',
				__( 'Gateway payments cannot be manually cancelled. Process a refund through the payment gateway.', 'codeclove-school-management' ),
				403
			);
		}

		$result = Transaction::run( function( $wpdb ) use ( $payments_table, $id, $reason, $payment ) {
			// ponytail: cancel status instead of physical delete to preserve receipt audit trail
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$wpdb->update(
				Schema::payments(),
				[
					'status'              => 'cancelled',
					'cancellation_reason' => $reason ? sanitize_text_field( $reason ) : null,
					'deleted_at'          => current_time( 'mysql', true ),
					'updated_at'          => current_time( 'mysql', true ),
				],
				[ 'id' => $id ]
			);
			// phpcs:enable

			// Recalculate BEFORE commit so invoice balance stays consistent.
			$this->recalculate_invoice_balance( (int) $payment['invoice_id'] );

			return true;
		} );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		do_action( 'codeclove_payment_cancelled', $id );

		return true;
	}


	// ─── Finance Overview Summary ───────────────────────────────────────────

	/**
	 * Gets consolidated dashboard metrics for the selected academic session with time-range grouping.
	 *
	 * @param int    $session_id Selected academic session ID.
	 * @param string $range      Time range filter ('week', 'month', 'term', 'year').
	 */
	public function get_summary( int $session_id, string $range = 'month' ): array {
		global $wpdb;

		$invoices_table = Schema::invoices();
		$payments_table = Schema::payments();
		$today          = current_time( 'Y-m-d' );
		$month_start    = current_time( 'Y-m-01' );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		// 1. Fetch Session-Wide Metrics
		$sums = $wpdb->get_row(
			$wpdb->prepare( 'SELECT
					COALESCE(SUM(total_minor), 0) as total_billed,
					COALESCE(SUM(paid_minor), 0) as total_collected,
					COALESCE(SUM(balance_minor), 0) as total_outstanding
				FROM %i
				WHERE academic_session_id = %d AND deleted_at IS NULL AND status NOT IN (\'cancelled\', \'void\')', Schema::invoices(), $session_id ),
			ARRAY_A
		);

		$today_collected = (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT COALESCE(SUM(amount_minor), 0)
				FROM %i
				WHERE academic_session_id = %d AND paid_on = %s AND status = \'completed\' AND deleted_at IS NULL', Schema::payments(), $session_id, $today )
		);

		$month_collected = (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT COALESCE(SUM(amount_minor), 0)
				FROM %i
				WHERE academic_session_id = %d AND paid_on >= %s AND status = \'completed\' AND deleted_at IS NULL', Schema::payments(), $session_id, $month_start )
		);

		$overdue_count = (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT COUNT(*)
				FROM %i
				WHERE academic_session_id = %d
				AND deleted_at IS NULL
				AND balance_minor > 0
				AND due_date < %s
				AND status IN (\'issued\', \'partially_paid\', \'overdue\')', Schema::invoices(), $session_id, $today )
		);

		// 2. Resolve the active Date Range for the filter
		$start_date  = $today;
		$end_date    = $today;
		$period_name = '';

		if ( $range === 'week' ) {
			// Current week: Monday to Sunday
			$start_date  = gmdate( 'Y-m-d', strtotime( 'monday this week' ) );
			$end_date    = gmdate( 'Y-m-d', strtotime( 'sunday this week' ) );
			$period_name = __( 'This Week', 'codeclove-school-management' );
		} elseif ( $range === 'month' ) {
			// Current calendar month: 1st to last day
			$start_date  = gmdate( 'Y-m-01' );
			$end_date    = gmdate( 'Y-m-t' );
			$period_name = gmdate( 'F Y' );
		} elseif ( $range === 'term' ) {
			// Current active term
			$terms_table = Schema::terms();
			$current_term = $wpdb->get_row(
				$wpdb->prepare( 'SELECT name, starts_on, ends_on FROM %i
					WHERE academic_session_id = %d AND status = \'active\' AND starts_on <= %s AND ends_on >= %s
					LIMIT 1', Schema::terms(), $session_id, $today, $today ),
				ARRAY_A
			);
			if ( ! $current_term ) {
				$current_term = $wpdb->get_row(
					$wpdb->prepare( 'SELECT name, starts_on, ends_on FROM %i
						WHERE academic_session_id = %d AND status = \'active\'
						ORDER BY starts_on ASC LIMIT 1', Schema::terms(), $session_id ),
					ARRAY_A
				);
			}
			if ( ! $current_term ) {
				$current_term = $wpdb->get_row(
					$wpdb->prepare( 'SELECT name, starts_on, ends_on FROM %i
						WHERE academic_session_id = %d
						ORDER BY starts_on ASC LIMIT 1', Schema::terms(), $session_id ),
					ARRAY_A
				);
			}

			if ( $current_term ) {
				$start_date  = $current_term['starts_on'];
				$end_date    = $current_term['ends_on'];
				$period_name = $current_term['name'];
			} else {
				$start_date  = gmdate( 'Y-m-01' );
				$end_date    = gmdate( 'Y-m-t' );
				$period_name = __( 'No Active Term Found', 'codeclove-school-management' );
			}
		} elseif ( $range === 'year' ) {
			// Current academic session (Year)
			$sessions_table = Schema::sessions();
			$session = $wpdb->get_row(
				$wpdb->prepare( 'SELECT name, starts_on, ends_on FROM %i
					WHERE id = %d LIMIT 1', Schema::sessions(), $session_id ),
				ARRAY_A
			);
			if ( $session ) {
				$start_date  = $session['starts_on'];
				$end_date    = $session['ends_on'];
				/* translators: %s: academic session name */
				$period_name = sprintf( __( 'Academic Year %s', 'codeclove-school-management' ), $session['name'] );
			} else {
				$start_date  = gmdate( 'Y-01-01' );
				$end_date    = gmdate( 'Y-12-31' );
				$period_name = __( 'Current Session', 'codeclove-school-management' );
			}
		}

		// 3. Fetch Daily Billings & Payments in this Date Range
		$billed_raw = $wpdb->get_results(
			$wpdb->prepare( 'SELECT issue_date as date_val, COALESCE(SUM(total_minor), 0) as total
				FROM %i
				WHERE academic_session_id = %d AND deleted_at IS NULL AND status NOT IN (\'cancelled\', \'void\')
				  AND issue_date BETWEEN %s AND %s
				GROUP BY issue_date', Schema::invoices(), $session_id, $start_date, $end_date ),
			ARRAY_A
		);

		$collected_raw = $wpdb->get_results(
			$wpdb->prepare( 'SELECT paid_on as date_val, COALESCE(SUM(amount_minor), 0) as total
				FROM %i
				WHERE academic_session_id = %d AND status = \'completed\' AND deleted_at IS NULL
				  AND paid_on BETWEEN %s AND %s
				GROUP BY paid_on', Schema::payments(), $session_id, $start_date, $end_date ),
			ARRAY_A
		);
		// phpcs:enable

		// Key raw query arrays by date
		$daily_billed = [];
		foreach ( $billed_raw as $row ) {
			$daily_billed[ $row['date_val'] ] = (int) $row['total'];
		}

		$daily_collected = [];
		foreach ( $collected_raw as $row ) {
			$daily_collected[ $row['date_val'] ] = (int) $row['total'];
		}

		// 4. Construct Trend Chart Data and Sparkline points based on Range
		$chart_data          = [];
		$sparkline_billed    = [];
		$sparkline_collected = [];

		if ( $range === 'week' ) {
			// Daily Monday through Sunday
			$curr   = new \DateTime( $start_date );
			$end_dt = new \DateTime( $end_date );
			while ( $curr <= $end_dt ) {
				$date_str  = $curr->format( 'Y-m-d' );
				$billed    = $daily_billed[ $date_str ] ?? 0;
				$collected = $daily_collected[ $date_str ] ?? 0;

				$chart_data[] = [
					'label'     => $curr->format( 'D' ), // Mon, Tue...
					'date'      => $date_str,
					'fullLabel' => $curr->format( 'd M Y' ),
					'billed'    => $billed,
					'collected' => $collected,
				];
				$sparkline_billed[]    = $billed;
				$sparkline_collected[] = $collected;

				$curr->modify( '+1 day' );
			}
		} elseif ( $range === 'month' ) {
			// Daily 1st to last day
			$curr   = new \DateTime( $start_date );
			$end_dt = new \DateTime( $end_date );
			while ( $curr <= $end_dt ) {
				$date_str  = $curr->format( 'Y-m-d' );
				$billed    = $daily_billed[ $date_str ] ?? 0;
				$collected = $daily_collected[ $date_str ] ?? 0;

				$chart_data[] = [
					'label'     => $curr->format( 'j M' ), // 1 Jun, 2 Jun...
					'date'      => $date_str,
					'fullLabel' => $curr->format( 'd M Y' ),
					'billed'    => $billed,
					'collected' => $collected,
				];
				$sparkline_billed[]    = $billed;
				$sparkline_collected[] = $collected;

				$curr->modify( '+1 day' );
			}
		} elseif ( $range === 'term' ) {
			// Weekly intervals
			$term_start_dt = new \DateTime( $start_date );
			$term_end_dt   = new \DateTime( $end_date );

			$week_idx = 1;
			$curr     = clone $term_start_dt;
			while ( $curr <= $term_end_dt ) {
				$next_week = clone $curr;
				$next_week->modify( '+6 days' );
				if ( $next_week > $term_end_dt ) {
					$next_week = clone $term_end_dt;
				}

				$billed_sum    = 0;
				$collected_sum = 0;

				$loop_dt = clone $curr;
				while ( $loop_dt <= $next_week ) {
					$date_str       = $loop_dt->format( 'Y-m-d' );
					$billed_sum    += $daily_billed[ $date_str ] ?? 0;
					$collected_sum += $daily_collected[ $date_str ] ?? 0;
					$loop_dt->modify( '+1 day' );
				}

				$chart_data[] = [
					/* translators: %d: week number */
					'label'     => sprintf( __( 'W%d', 'codeclove-school-management' ), $week_idx ),
					'startDate' => $curr->format( 'Y-m-d' ),
					'endDate'   => $next_week->format( 'Y-m-d' ),
					/* translators: 1: week number, 2: start date formatted, 3: end date formatted */
					'fullLabel' => sprintf( __( 'Week %1$d (%2$s - %3$s)', 'codeclove-school-management' ), $week_idx, $curr->format( 'd M' ), $next_week->format( 'd M' ) ),
					'billed'    => $billed_sum,
					'collected' => $collected_sum,
				];
				$sparkline_billed[]    = $billed_sum;
				$sparkline_collected[] = $collected_sum;

				$week_idx++;
				$curr = clone $next_week;
				$curr->modify( '+1 day' );
			}
		} else {
			// Year: Monthly intervals
			$year_start_dt = new \DateTime( $start_date );
			$year_end_dt   = new \DateTime( $end_date );

			$year_start_dt->modify( 'first day of this month' );
			$year_end_dt->modify( 'last day of this month' );

			$curr = clone $year_start_dt;
			while ( $curr <= $year_end_dt ) {
				$month_start_str = $curr->format( 'Y-m-01' );
				$month_end_str   = $curr->format( 'Y-m-t' );

				$billed_sum    = 0;
				$collected_sum = 0;

				$loop_dt = new \DateTime( $month_start_str );
				$m_end   = new \DateTime( $month_end_str );
				while ( $loop_dt <= $m_end ) {
					$date_str       = $loop_dt->format( 'Y-m-d' );
					$billed_sum    += $daily_billed[ $date_str ] ?? 0;
					$collected_sum += $daily_collected[ $date_str ] ?? 0;
					$loop_dt->modify( '+1 day' );
				}

				$chart_data[] = [
					'label'     => $curr->format( 'M' ), // Jan, Feb...
					'date'      => $curr->format( 'Y-m-01' ),
					'fullLabel' => $curr->format( 'F Y' ),
					'billed'    => $billed_sum,
					'collected' => $collected_sum,
				];
				$sparkline_billed[]    = $billed_sum;
				$sparkline_collected[] = $collected_sum;

				$curr->modify( '+1 month' );
			}
		}

		$period_billed      = array_sum( array_column( $chart_data, 'billed' ) );
		$period_collected   = array_sum( array_column( $chart_data, 'collected' ) );
		$period_outstanding = max( 0, $period_billed - $period_collected );

		$recent_invoices = $this->get_invoices(
			[
				'academic_session_id' => $session_id,
				'limit'               => 5,
				'offset'              => 0,
			]
		);

		$recent_payments = $this->get_payments(
			[
				'academic_session_id' => $session_id,
				'limit'               => 5,
				'offset'              => 0,
			]
		);

		return [
			'total_billed'        => (int) $sums['total_billed'],
			'total_collected'     => (int) $sums['total_collected'],
			'total_outstanding'   => (int) $sums['total_outstanding'],
			'today_collected'     => $today_collected,
			'month_collected'     => $month_collected,
			'overdue_count'       => $overdue_count,
			'period_billed'       => $period_billed,
			'period_collected'    => $period_collected,
			'period_outstanding'  => $period_outstanding,
			'period_label'        => $period_name,
			'chart_data'          => $chart_data,
			'sparkline_billed'    => $sparkline_billed,
			'sparkline_collected' => $sparkline_collected,
			'recent_invoices'     => $recent_invoices,
			'recent_payments'     => $recent_payments,
		];
	}


	// ─── Internal Helpers ────────────────────────────────────────────────────

	/**
	 * Recalculates total paid, balance, and resolves final status of an invoice.
	 * Must be called inside an active transaction when used from record_payment / cancel_payment.
	 */
	private function recalculate_invoice_balance( int $invoice_id ): void {
		global $wpdb;

		$invoices_table = Schema::invoices();
		$payments_table = Schema::payments();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$total_paid = (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT COALESCE(SUM(amount_minor), 0)
				FROM %i
				WHERE invoice_id = %d AND status = \'completed\' AND deleted_at IS NULL', Schema::payments(), $invoice_id )
		);

		$invoice = $wpdb->get_row(
			$wpdb->prepare( 'SELECT total_minor, due_date, status FROM %i WHERE id = %d LIMIT 1', Schema::invoices(), $invoice_id ),
			ARRAY_A
		);
		// phpcs:enable

		if ( ! $invoice ) {
			return;
		}

		$total_minor   = (int) $invoice['total_minor'];
		$balance_minor = max( 0, $total_minor - $total_paid );
		$old_status    = $invoice['status'];
		$status        = $invoice['status'];

		if ( ! in_array( $status, [ 'cancelled', 'void', 'draft' ], true ) ) {
			if ( 0 === $total_paid ) {
				$status = 'issued';
			} elseif ( 0 === $balance_minor ) {
				$status = 'paid';
			} else {
				$status = 'partially_paid';
			}

			if ( 'paid' !== $status && ! empty( $invoice['due_date'] ) && $invoice['due_date'] < current_time( 'Y-m-d' ) ) {
				$status = 'overdue';
			}
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->update(
			Schema::invoices(),
			[
				'paid_minor'    => $total_paid,
				'balance_minor' => $balance_minor,
				'status'        => $status,
				'updated_at'    => current_time( 'mysql', true ),
			],
			[ 'id' => $invoice_id ]
		);
		// phpcs:enable

		if ( $status === 'overdue' && $old_status !== 'overdue' ) {
			do_action( 'codeclove_invoice_overdue', $invoice_id );
		}
	}

	/**
	 * Casts invoice row integer/null fields in-place.
	 */
	private function cast_invoice_row( array &$row ): void {
		$row['id']                  = (int) $row['id'];
		$row['student_id']          = (int) $row['student_id'];
		$row['academic_session_id'] = (int) $row['academic_session_id'];
		$row['academic_term_id']    = isset( $row['academic_term_id'] ) && $row['academic_term_id'] ? (int) $row['academic_term_id'] : null;
		$row['academic_unit_id']    = $row['academic_unit_id'] ? (int) $row['academic_unit_id'] : null;
		$row['academic_group_id']   = $row['academic_group_id'] ? (int) $row['academic_group_id'] : null;
		$row['subtotal_minor']      = (int) $row['subtotal_minor'];
		$row['discount_minor']      = (int) $row['discount_minor'];
		$row['tax_minor']           = (int) $row['tax_minor'];
		$row['total_minor']         = (int) $row['total_minor'];
		$row['paid_minor']          = (int) $row['paid_minor'];
		$row['balance_minor']       = (int) $row['balance_minor'];
	}

	/**
	 * Casts payment row integer/null fields in-place.
	 */
	private function cast_payment_row( array &$row ): void {
		$row['id']                  = (int) $row['id'];
		$row['invoice_id']          = (int) $row['invoice_id'];
		$row['student_id']          = (int) $row['student_id'];
		$row['academic_session_id'] = (int) $row['academic_session_id'];
		$row['amount_minor']        = (int) $row['amount_minor'];
	}

	/**
	 * Recalculates subtotal_minor, tax_minor, and total_minor from line items,
	 * then calls recalculate_invoice_balance() to update balance and status.
	 */
	private function recalculate_invoice_totals( int $invoice_id ): void {
		global $wpdb;
		$invoices_table = Schema::invoices();
		$line_items_table = Schema::line_items();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$totals = $wpdb->get_row(
			$wpdb->prepare( 'SELECT COALESCE(SUM(total_minor), 0) as subtotal, COALESCE(SUM(tax_minor), 0) as tax
				FROM %i
				WHERE invoice_id = %d', Schema::line_items(), $invoice_id ),
			ARRAY_A
		);

		$subtotal_minor = (int) $totals['subtotal'];
		$tax_minor      = (int) $totals['tax'];

		// Retrieve invoice discount
		$discount_minor = (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT discount_minor FROM %i WHERE id = %d LIMIT 1', Schema::invoices(), $invoice_id )
		);

		$total_minor = max( 0, $subtotal_minor - $discount_minor + $tax_minor );

		$wpdb->update(
			Schema::invoices(),
			[
				'subtotal_minor' => $subtotal_minor,
				'tax_minor'      => $tax_minor,
				'total_minor'    => $total_minor,
			],
			[ 'id' => $invoice_id ]
		);
		// phpcs:enable

		$this->recalculate_invoice_balance( $invoice_id );
	}

	/**
	 * Adds a line item to an invoice and updates totals/balance.
	 */
	public function add_line_item( int $invoice_id, array $payload ): array|WP_Error {
		global $wpdb;

		$invoices_table = Schema::invoices();
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$invoice = $wpdb->get_row(
			$wpdb->prepare( 'SELECT status, paid_minor FROM %i WHERE id = %d AND deleted_at IS NULL LIMIT 1', Schema::invoices(), $invoice_id ),
			ARRAY_A
		);
		// phpcs:enable

		if ( (int) $invoice['paid_minor'] > 0 ) {
			return new WP_Error( 'invoice_has_payments', __( 'Cannot modify line items on an invoice with existing payments.', 'codeclove-school-management' ), 422 );
		}

		if ( empty( $payload['description'] ) ) {
			return new WP_Error( 'missing_field', __( 'Description is required.', 'codeclove-school-management' ), 400 );
		}

		$quantity      = isset( $payload['quantity'] ) ? (float) $payload['quantity'] : 1.0;
		$unit_amount   = isset( $payload['unit_amount_minor'] ) ? (int) $payload['unit_amount_minor'] : 0;
		$line_discount = isset( $payload['discount_minor'] ) ? (int) $payload['discount_minor'] : 0;
		$line_tax      = isset( $payload['tax_minor'] ) ? (int) $payload['tax_minor'] : 0;

		$line_total = max( 0, (int) round( $quantity * $unit_amount ) - $line_discount );

		return Transaction::run( function( $wpdb ) use ( $invoice_id, $payload, $quantity, $unit_amount, $line_discount, $line_tax, $line_total ) {
			$line_items_table = Schema::line_items();
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$max_sort = (int) $wpdb->get_var(
				$wpdb->prepare( 'SELECT MAX(sort_order) FROM %i WHERE invoice_id = %d', Schema::line_items(), $invoice_id )
			);
			// phpcs:enable
			$insert = [
				'invoice_id'        => $invoice_id,
				'fee_type_id'       => ! empty( $payload['fee_type_id'] ) ? (int) $payload['fee_type_id'] : null,
				'description'       => sanitize_text_field( $payload['description'] ),
				'quantity'          => $quantity,
				'unit_amount_minor' => $unit_amount,
				'discount_minor'    => $line_discount,
				'discount_type'     => ! empty( $payload['discount_type'] ) ? sanitize_text_field( $payload['discount_type'] ) : null,
				'total_minor'       => $line_total,
				'tax_minor'         => $line_tax,
				'sort_order'        => $max_sort + 1,
				'created_at'        => current_time( 'mysql', true ),
				'updated_at'        => current_time( 'mysql', true ),
			];

			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$inserted = $wpdb->insert( $line_items_table, $insert );
			// phpcs:enable
			if ( ! $inserted ) {
				throw new \Exception( esc_html__( 'Failed to insert line item.', 'codeclove-school-management' ) );
			}

			$this->recalculate_invoice_totals( $invoice_id );

			return $this->get_invoice( $invoice_id ) ?: [];
		} );
	}

	/**
	 * Updates a line item in an invoice and updates totals/balance.
	 */
	public function update_line_item( int $invoice_id, int $line_id, array $payload ): array|WP_Error {
		global $wpdb;

		$invoices_table = Schema::invoices();
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$invoice = $wpdb->get_row(
			$wpdb->prepare( 'SELECT status, paid_minor FROM %i WHERE id = %d AND deleted_at IS NULL LIMIT 1', Schema::invoices(), $invoice_id ),
			ARRAY_A
		);
		// phpcs:enable

		if ( (int) $invoice['paid_minor'] > 0 ) {
			return new WP_Error( 'invoice_has_payments', __( 'Cannot modify line items on an invoice with existing payments.', 'codeclove-school-management' ), 422 );
		}

		$line_items_table = Schema::line_items();
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$line = $wpdb->get_row(
			$wpdb->prepare( 'SELECT id FROM %i WHERE id = %d AND invoice_id = %d LIMIT 1', Schema::line_items(), $line_id, $invoice_id ),
			ARRAY_A
		);
		// phpcs:enable

		return Transaction::run( function( $wpdb ) use ( $invoice_id, $line_id, $payload, $line_items_table ) {
			$update = [];
			if ( isset( $payload['description'] ) ) {
				$update['description'] = sanitize_text_field( $payload['description'] );
			}
			if ( isset( $payload['quantity'] ) ) {
				$update['quantity'] = (float) $payload['quantity'];
			}
			if ( isset( $payload['unit_amount_minor'] ) ) {
				$update['unit_amount_minor'] = (int) $payload['unit_amount_minor'];
			}
			if ( isset( $payload['discount_minor'] ) ) {
				$update['discount_minor'] = (int) $payload['discount_minor'];
			}
			if ( isset( $payload['discount_type'] ) ) {
				$update['discount_type'] = sanitize_text_field( $payload['discount_type'] );
			}
			if ( isset( $payload['tax_minor'] ) ) {
				$update['tax_minor'] = (int) $payload['tax_minor'];
			}
			if ( isset( $payload['fee_type_id'] ) ) {
				$update['fee_type_id'] = $payload['fee_type_id'] ? (int) $payload['fee_type_id'] : null;
			}

			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$current_line = $wpdb->get_row(
				$wpdb->prepare( 'SELECT * FROM %i WHERE id = %d', Schema::line_items(), $line_id ),
				ARRAY_A
			);
			$q = isset( $update['quantity'] ) ? $update['quantity'] : (float) $current_line['quantity'];
			$u = isset( $update['unit_amount_minor'] ) ? $update['unit_amount_minor'] : (int) $current_line['unit_amount_minor'];
			$d = isset( $update['discount_minor'] ) ? $update['discount_minor'] : (int) $current_line['discount_minor'];

			$update['total_minor'] = max( 0, (int) round( $q * $u ) - $d );
			$update['updated_at']  = current_time( 'mysql', true );

			$wpdb->update( Schema::line_items(), $update, [ 'id' => $line_id ] );
			// phpcs:enable
			$this->recalculate_invoice_totals( $invoice_id );

			return $this->get_invoice( $invoice_id ) ?: [];
		} );
	}

	/**
	 * Deletes a line item from an invoice and updates totals/balance.
	 */
	public function delete_line_item( int $invoice_id, int $line_id ): array|WP_Error {
		global $wpdb;

		$invoices_table = Schema::invoices();
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$invoice = $wpdb->get_row(
			$wpdb->prepare( 'SELECT status, paid_minor FROM %i WHERE id = %d AND deleted_at IS NULL LIMIT 1', Schema::invoices(), $invoice_id ),
			ARRAY_A
		);
		// phpcs:enable

		if ( (int) $invoice['paid_minor'] > 0 ) {
			return new WP_Error( 'invoice_has_payments', __( 'Cannot modify line items on an invoice with existing payments.', 'codeclove-school-management' ), 422 );
		}

		$line_items_table = Schema::line_items();
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$line = $wpdb->get_row(
			$wpdb->prepare( 'SELECT id FROM %i WHERE id = %d AND invoice_id = %d LIMIT 1', Schema::line_items(), $line_id, $invoice_id ),
			ARRAY_A
		);
		// phpcs:enable

		return Transaction::run( function( $wpdb ) use ( $invoice_id, $line_id, $line_items_table ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$wpdb->delete( Schema::line_items(), [ 'id' => $line_id ] );
			// phpcs:enable
			$this->recalculate_invoice_totals( $invoice_id );

			return $this->get_invoice( $invoice_id ) ?: [];
		} );
	}

	/**
	 * Transitions an invoice status from draft to issued.
	 */
	public function issue_invoice( int $id ): array|WP_Error {
		global $wpdb;

		$invoices_table = Schema::invoices();
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$invoice = $wpdb->get_row(
			$wpdb->prepare( 'SELECT * FROM %i WHERE id = %d AND deleted_at IS NULL LIMIT 1', Schema::invoices(), $id ),
			ARRAY_A
		);
		// phpcs:enable

		if ( $invoice['status'] !== 'draft' ) {
			return new WP_Error(
				'invalid_status',
				/* translators: %s: invoice status */
				sprintf( __( 'Only draft invoices can be issued. Current status: %s.', 'codeclove-school-management' ), $invoice['status'] ),
				422
			);
		}

		$status   = 'issued';
		$due_date = $invoice['due_date'];
		if ( null !== $due_date && $due_date < current_time( 'Y-m-d' ) ) {
			$status = 'overdue';
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->update(
			Schema::invoices(),
			[
				'status'     => $status,
				'updated_at' => current_time( 'mysql', true ),
			],
			[ 'id' => $id ]
		);
		// phpcs:enable
		$updated_invoice = $this->get_invoice( $id ) ?: [];

		do_action( 'codeclove_invoice_issued', $updated_invoice );

		return $updated_invoice;
	}

	/**
	 * Gets the fee defaulters report data.
	 */
	public function get_defaulters_report( array $args = [] ): array {
		global $wpdb;

		$invoices_table = Schema::invoices();
		$students_table = Schema::students();
		$units_table    = Schema::units();

		$current_date = current_time( 'Y-m-d' );
		$where        = "i.status IN ('issued', 'partially_paid', 'overdue')
						AND i.balance_minor > 0
						AND i.due_date IS NOT NULL
						AND i.due_date < %s
						AND i.deleted_at IS NULL";
		$binds        = [ $current_date ];

		if ( ! empty( $args['academic_session_id'] ) ) {
			$where   .= " AND i.academic_session_id = %d";
			$binds[] = (int) $args['academic_session_id'];
		}

		if ( ! empty( $args['academic_unit_id'] ) ) {
			$where   .= " AND i.academic_unit_id = %d";
			$binds[] = (int) $args['academic_unit_id'];
		}

		if ( ! empty( $args['days_overdue_min'] ) ) {
			$where   .= " AND DATEDIFF(%s, i.due_date) >= %d";
			$binds[] = $current_date;
			$binds[] = (int) $args['days_overdue_min'];
		}

		if ( ! empty( $args['search'] ) ) {
			$where   .= ' AND (s.first_name LIKE %s OR s.last_name LIKE %s OR s.student_number LIKE %s OR i.invoice_number LIKE %s)';
			$like    = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
			$binds[] = $like;
		}

		// Count query
		$count_query = 'SELECT COUNT(i.id) FROM ' . Schema::invoices() . ' i INNER JOIN ' . Schema::students() . " s ON s.id = i.student_id WHERE {$where}";
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$total = (int) $wpdb->get_var(
			$wpdb->prepare( $count_query, ...$binds )
		);
		// phpcs:enable

		// Order & Pagination
		$limit  = isset( $args['limit'] ) ? (int) $args['limit'] : 20;
		$offset = isset( $args['offset'] ) ? (int) $args['offset'] : 0;

		$query = "SELECT
					i.id as invoice_id,
					i.invoice_number,
					i.due_date,
					i.balance_minor,
					i.total_minor,
					s.id as student_id,
					s.first_name as student_first_name,
					s.last_name as student_last_name,
					s.student_number,
					i.academic_unit_id,
					i.academic_group_id,
					u.name as academic_unit_name,
					DATEDIFF(%s, i.due_date) as days_overdue
				FROM {$invoices_table} i
				INNER JOIN {$students_table} s ON s.id = i.student_id
				LEFT JOIN {$units_table} u ON u.id = i.academic_unit_id
				WHERE {$where}
				ORDER BY days_overdue DESC, i.balance_minor DESC
				LIMIT %d OFFSET %d";

		$select_binds = array_merge( [ $current_date ], $binds, [ $limit, $offset ] );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$results = $wpdb->get_results(
			$wpdb->prepare( $query, ...$select_binds ),
			ARRAY_A
		);
		// phpcs:enable
		foreach ( $results as &$row ) {
			$row['invoice_id']        = (int) $row['invoice_id'];
			$row['balance_minor']     = (int) $row['balance_minor'];
			$row['total_minor']       = (int) $row['total_minor'];
			$row['student_id']        = (int) $row['student_id'];
			$row['academic_unit_id']  = $row['academic_unit_id'] ? (int) $row['academic_unit_id'] : null;
			$row['academic_group_id'] = $row['academic_group_id'] ? (int) $row['academic_group_id'] : null;
			$row['days_overdue']      = (int) $row['days_overdue'];
		}

		return [
			'data'  => $results,
			'total' => $total,
		];
	}

	/**
	 * Bulk updates overdue status for invoices that are past their due dates.
	 */
	public function update_overdue_invoices(): void {
		global $wpdb;
		$table = Schema::invoices();
		
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		// Fetch IDs of all invoices that are past due date
		$ids = $wpdb->get_col(
			$wpdb->prepare( 'SELECT id FROM %i
				WHERE status IN (\'issued\', \'partially_paid\')
					AND due_date IS NOT NULL
					AND due_date < %s
					AND balance_minor > 0
					AND deleted_at IS NULL', Schema::invoices(), current_time( 'Y-m-d' ) )
		);

		if ( ! empty( $ids ) ) {
			foreach ( $ids as $id ) {
				$id = (int) $id;
				$wpdb->update(
					Schema::invoices(),
					[
						'status'     => 'overdue',
						'updated_at' => current_time( 'mysql', true ),
					],
					[ 'id' => $id ]
				);
				do_action( 'codeclove_invoice_overdue', $id );
			}
		}
		// phpcs:enable
	}

	/**
	 * Performs bulk actions on invoices.
	 */
	public function bulk_action( array $payload ): array|WP_Error {
		global $wpdb;
		$action = $payload['action'] ?? '';
		$ids    = $payload['ids'] ?? [];

		if ( empty( $ids ) || ! is_array( $ids ) ) {
			return new WP_Error( 'codeclove_invalid_ids', __( 'No IDs provided.', 'codeclove-school-management' ), 400 );
		}

		$ids = array_map( 'intval', $ids );

		if ( 'send_reminders' === $action ) {
			if ( ! class_exists( '\\CodeClove\\Modules\\Notifications\\NotificationsService' ) ) {
				return new WP_Error( 'codeclove_pro_required', __( 'SMS reminders require the Pro version.', 'codeclove-school-management' ), [ 'status' => 403 ] );
			}
			$notif_service = new \CodeClove\Modules\Notifications\NotificationsService();
			$sent_count = 0;
			$errors = [];
			foreach ( $ids as $id ) {
				$sent = $notif_service->send_fee_reminder( $id );
				if ( $sent ) {
					$sent_count++;
				} else {
					$errors[] = "ID {$id}: Failed to send reminder.";
				}
			}
			return [ 'success' => true, 'updated_count' => $sent_count, 'errors' => $errors ];
		}

		if ( 'cancel' === $action ) {
			$success_count = 0;
			$errors = [];
			foreach ( $ids as $id ) {
				$res = $this->cancel_invoice( $id );
				if ( is_wp_error( $res ) ) {
					$errors[] = "ID {$id}: " . $res->get_error_message();
				} else {
					$success_count++;
				}
			}
			return [ 'success' => true, 'updated_count' => $success_count, 'errors' => $errors ];
		}

		if ( 'void' === $action ) {
			$success_count = 0;
			$errors = [];
			foreach ( $ids as $id ) {
				$res = $this->void_invoice( $id );
				if ( is_wp_error( $res ) ) {
					$errors[] = "ID {$id}: " . $res->get_error_message();
				} else {
					$success_count++;
				}
			}
			return [ 'success' => true, 'updated_count' => $success_count, 'errors' => $errors ];
		}

		if ( 'discount' === $action ) {
			$discount_minor = isset( $payload['discount_minor'] ) ? (int) $payload['discount_minor'] : 0;
			$discount_note  = isset( $payload['discount_note'] ) ? sanitize_text_field( $payload['discount_note'] ) : '';
			
			$invoices_table = Schema::invoices();
			$success_count = 0;
			$errors = [];
			
			foreach ( $ids as $id ) {
				// Lock check: once paid, do not allow modifying discounts.
				// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
				$invoice = $wpdb->get_row(
					$wpdb->prepare( 'SELECT * FROM %i WHERE id = %d AND deleted_at IS NULL LIMIT 1', Schema::invoices(), $id ),
					ARRAY_A
				);
				// phpcs:enable
				if ( ! $invoice ) {
					$errors[] = "ID {$id}: Invoice not found.";
					continue;
				}
				if ( (int) $invoice['paid_minor'] > 0 ) {
					$errors[] = "ID {$id}: Invoice has already received payments.";
					continue;
				}
				
				// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
				$updated = $wpdb->update(
					Schema::invoices(),
					[
						'discount_minor' => $discount_minor,
						'discount_note'  => $discount_note,
						'updated_by'     => get_current_user_id(),
						'updated_at'     => current_time( 'mysql', true ),
					],
					[ 'id' => $id ]
				);
				// phpcs:enable
				if ( false !== $updated ) {
					$this->recalculate_invoice_totals( $id );
					$success_count++;
				} else {
					$errors[] = "ID {$id}: Failed to apply discount.";
				}
			}
			return [ 'success' => true, 'updated_count' => $success_count, 'errors' => $errors ];
		}

		return new WP_Error( 'codeclove_invalid_action', __( 'Invalid bulk action.', 'codeclove-school-management' ), 400 );
	}
}
