<?php
/**
 * Activity log service.
 *
 * Handles fetching, filtering, and pagination of audit logs.
 *
 * @package Nexora\Modules\Activity
 */

declare( strict_types=1 );

namespace Nexora\Modules\Activity;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Nexora\Database\Schema;

/**
 * Class ActivityService
 */
final class ActivityService {

	/**
	 * Returns a paginated list of audit logs based on filters.
	 *
	 * @param array<string, mixed> $params Query parameters.
	 * @return array{items: array<int, array<string, mixed>>, total: int}
	 */
	public function get_log( array $params ): array {
		global $wpdb;

		$page     = isset( $params['page'] ) ? max( 1, (int) $params['page'] ) : 1;
		$per_page = isset( $params['per_page'] ) ? max( 1, min( 1000, (int) $params['per_page'] ) ) : 25;
		$offset   = ( $page - 1 ) * $per_page;

		$where  = [ '1=1' ];
		$values = [];

		// Filter by category (which is mapped to event_type prefixes)
		if ( ! empty( $params['category'] ) ) {
			$category = sanitize_text_field( $params['category'] );
			switch ( $category ) {
				case 'admissions':
					$where[] = "event_type LIKE 'admission_%'";
					break;
				case 'students':
					$where[] = "event_type LIKE 'student_%'";
					break;
				case 'staff':
					$where[] = "event_type LIKE 'staff_%'";
					break;
				case 'finance':
					$where[] = "(event_type LIKE 'invoice_%' OR event_type LIKE 'payment_%' OR event_type LIKE 'fee_%')";
					break;
				case 'attendance':
					$where[] = "event_type LIKE 'attendance_%'";
					break;
				case 'settings':
					$where[] = "event_type LIKE 'settings_%'";
					break;
				case 'system':
					$where[] = "event_type NOT LIKE 'admission_%' AND event_type NOT LIKE 'student_%' AND event_type NOT LIKE 'staff_%' AND event_type NOT LIKE 'invoice_%' AND event_type NOT LIKE 'payment_%' AND event_type NOT LIKE 'fee_%' AND event_type NOT LIKE 'attendance_%' AND event_type NOT LIKE 'settings_%'";
					break;
			}
		}

		// Filter by date range
		if ( ! empty( $params['date_from'] ) ) {
			$where[]  = 'created_at >= %s';
			$values[] = sanitize_text_field( $params['date_from'] ) . ' 00:00:00';
		}
		if ( ! empty( $params['date_to'] ) ) {
			$where[]  = 'created_at <= %s';
			$values[] = sanitize_text_field( $params['date_to'] ) . ' 23:59:59';
		}

		// Filter by search keyword (actor label or event_type or metadata JSON label)
		if ( ! empty( $params['search'] ) ) {
			$search   = '%' . $wpdb->esc_like( sanitize_text_field( $params['search'] ) ) . '%';
			$where[]  = '(actor_label LIKE %s OR event_type LIKE %s OR metadata_json LIKE %s)';
			$values[] = $search;
			$values[] = $search;
			$values[] = $search;
		}

		$where_clause = implode( ' AND ', $where );

		// Query total count
		$count_query = "SELECT COUNT(*) FROM " . Schema::app_logs() . " WHERE {$where_clause}";
		if ( ! empty( $values ) ) {
		$count_query = $wpdb->prepare( $count_query, ...$values ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
		$total = (int) $wpdb->get_var( $count_query ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		// Query records
		$query = "SELECT id, event_type, actor_type, actor_id, actor_label, created_at, metadata_json
				  FROM " . Schema::app_logs() . "
				  WHERE {$where_clause}
				  ORDER BY created_at DESC
				  LIMIT %d OFFSET %d";
		$query_values   = array_merge( $values, [ $per_page, $offset ] );
		$prepared_query = $wpdb->prepare( $query, ...$query_values ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		$rows = $wpdb->get_results( $prepared_query, ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		$items = array_map(
			function ( $r ) {
				$meta       = json_decode( $r['metadata_json'] ?? '{}', true );
				$actor_name = $r['actor_label'] ?: 'System';
				if ( strtolower( $actor_name ) === 'system' ) {
					$actor_name = 'System';
				}

				return [
					'id'             => (int) $r['id'],
					'event_type'     => $r['event_type'],
					'event_category' => $this->get_event_category( $r['event_type'] ),
					'actor_type'     => $r['actor_type'],
					'actor_id'       => (int) $r['actor_id'],
					'actor_name'     => $actor_name,
					'created_at'     => $r['created_at'],
					'label'          => $meta['label'] ?? null,
					'url'            => $meta['url'] ?? null,
				];
			},
			(array) $rows
		);

		return [
			'items' => $items,
			'total' => $total,
		];
	}

	/**
	 * Maps an event type to a category.
	 */
	private function get_event_category( string $event_type ): string {
		if ( str_starts_with( $event_type, 'admission_' ) ) {
			return 'admissions';
		}
		if ( str_starts_with( $event_type, 'student_' ) ) {
			return 'students';
		}
		if ( str_starts_with( $event_type, 'staff_' ) ) {
			return 'staff';
		}
		if ( str_starts_with( $event_type, 'invoice_' ) || str_starts_with( $event_type, 'payment_' ) || str_starts_with( $event_type, 'fee_' ) ) {
			return 'finance';
		}
		if ( str_starts_with( $event_type, 'attendance_' ) ) {
			return 'attendance';
		}
		if ( str_starts_with( $event_type, 'settings_' ) ) {
			return 'settings';
		}
		return 'system';
	}
}
