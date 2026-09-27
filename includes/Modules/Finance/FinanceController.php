<?php
/**
 * Finance REST API controller.
 *
 * Exposes REST routes to manage fee types, student invoices,
 * manual payments, and fetch dashboard metrics.
 *
 * @package Nexora\Modules\Finance
 */

declare( strict_types=1 );

namespace Nexora\Modules\Finance;

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
 * Class FinanceController
 */
final class FinanceController extends BaseController {

	private FinanceService $service;

	public function __construct() {
		$this->service = new FinanceService();
	}

	/**
	 * Registers REST routes.
	 */
	public function register_routes(): void {
		// ─── Finance Overview Metrics ──────────────────────────────────────────
		register_rest_route(
			$this->namespace,
			'/finance/summary',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_summary' ],
					'permission_callback' => $this->permission( 'finance.view' ),
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/finance/reports/defaulters',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_defaulters_report' ],
					'permission_callback' => $this->permission( 'finance.view' ),
				],
			]
		);

		// ─── Fee Types CRUD Routes ──────────────────────────────────────────────
		register_rest_route(
			$this->namespace,
			'/fee-types',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_fee_types' ],
					'permission_callback' => $this->permission( 'fee_types.view' ),
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'create_fee_type' ],
					'permission_callback' => $this->permission( 'fee_types.add' ),
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/fee-types/(?P<id>\d+)',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_fee_type' ],
					'permission_callback' => $this->permission( 'fee_types.view' ),
				],
				[
					'methods'             => 'PATCH',
					'callback'            => [ $this, 'update_fee_type' ],
					'permission_callback' => $this->permission( 'fee_types.edit' ),
				],
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'delete_fee_type' ],
					'permission_callback' => $this->permission( 'fee_types.delete' ),
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/fee-types/(?P<id>\d+)/class-rates',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_class_rates' ],
					'permission_callback' => $this->permission( 'fee_types.view' ),
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'upsert_class_rate' ],
					'permission_callback' => $this->permission( 'fee_types.edit' ),
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/fee-types/(?P<id>\d+)/class-rates/(?P<unit_id>\d+)',
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_class_rate' ],
				'permission_callback' => $this->permission( 'fee_types.edit' ),
			]
		);

		register_rest_route(
			$this->namespace,
			'/invoices/resolve-fee-amount',
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'resolve_fee_amount' ],
				'permission_callback' => $this->permission( 'invoices.view' ),
			]
		);


		register_rest_route(
			$this->namespace,
			'/invoices',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_invoices' ],
					'permission_callback' => $this->permission( 'invoices.view' ),
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'create_invoice' ],
					'permission_callback' => $this->permission( 'invoices.add' ),
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/invoices/bulk-action',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'bulk_invoices_action' ],
					'permission_callback' => $this->permission( 'invoices.edit' ),
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/invoices/(?P<id>\d+)',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_invoice' ],
					'permission_callback' => $this->permission( 'invoices.view' ),
				],
				[
					'methods'             => 'PATCH',
					'callback'            => [ $this, 'update_invoice' ],
					'permission_callback' => $this->permission( 'invoices.edit' ),
				],
			]
		);

		// CL1: explicit named action routes replace DELETE /invoices/{id}
		register_rest_route(
			$this->namespace,
			'/invoices/(?P<id>\d+)/cancel',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'cancel_invoice' ],
					'permission_callback' => $this->permission( 'invoices.delete' ),
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/invoices/(?P<id>\d+)/void',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'void_invoice' ],
					'permission_callback' => $this->permission( 'invoices.delete' ),
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/invoices/(?P<id>\d+)/issue',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'issue_invoice' ],
					'permission_callback' => $this->permission( 'invoices.edit' ),
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/invoices/(?P<id>\d+)/line-items',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'add_line_item' ],
					'permission_callback' => $this->permission( 'invoices.edit' ),
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/invoices/(?P<id>\d+)/line-items/(?P<lid>\d+)',
			[
				[
					'methods'             => 'PATCH',
					'callback'            => [ $this, 'update_line_item' ],
					'permission_callback' => $this->permission( 'invoices.edit' ),
				],
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'delete_line_item' ],
					'permission_callback' => $this->permission( 'invoices.edit' ),
				],
			]
		);

		// ─── Payments Journal Routes ────────────────────────────────────────────
		register_rest_route(
			$this->namespace,
			'/payments',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_payments' ],
					'permission_callback' => $this->permission( 'payments.view' ),
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'record_payment' ],
					'permission_callback' => $this->permission( 'payments.add' ),
				],
			]
		);

		// CL5: single payment fetch route
		register_rest_route(
			$this->namespace,
			'/payments/(?P<id>\d+)',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_payment' ],
					'permission_callback' => $this->permission( 'payments.view' ),
				],
			]
		);

		// CL1: explicit cancel route replaces DELETE /payments/{id}
		register_rest_route(
			$this->namespace,
			'/payments/(?P<id>\d+)/cancel',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'cancel_payment' ],
					'permission_callback' => $this->permission( 'payments.delete' ),
				],
			]
		);
	}

	// ─── Summary Callback ───────────────────────────────────────────────────

	/**
	 * Gets consolidated metrics summary for the selected or current active session.
	 */
	public function get_summary( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$session_id = $request->get_param( 'academic_session_id' );
		if ( ! empty( $session_id ) ) {
			$session_id = (int) $session_id;
		} else {
			$session_id = ( new \Nexora\Modules\Academics\Sessions\SessionsService() )->get_current_session_id();
		}

		if ( ! $session_id ) {
			return $this->error( 'missing_session', __( 'No academic session specified and no active session configured.', 'nexora-school-management' ), 400 );
		}

		$range = $request->get_param( 'range' ) ?: 'month';
		if ( ! in_array( $range, [ 'week', 'month', 'term', 'year' ], true ) ) {
			$range = 'month';
		}

		return $this->success( $this->service->get_summary( $session_id, $range ) );
	}

	/**
	 * GET /finance/reports/defaulters
	 */
	public function get_defaulters_report( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$session_id = $request->get_param( 'academic_session_id' );
		if ( ! empty( $session_id ) ) {
			$session_id = (int) $session_id;
		} else {
			$session_id = ( new \Nexora\Modules\Academics\Sessions\SessionsService() )->get_current_session_id();
		}

		if ( ! $session_id ) {
			return $this->success( [
				'data'  => [],
				'total' => 0,
			] );
		}

		$pagination = $this->get_pagination( $request );
		$args = [
			'academic_session_id' => $session_id,
			'academic_unit_id'    => $request->get_param( 'academic_unit_id' ) ? (int) $request->get_param( 'academic_unit_id' ) : 0,
			'days_overdue_min'    => $request->get_param( 'days_overdue_min' ) ? (int) $request->get_param( 'days_overdue_min' ) : 0,
			'search'              => $request->get_param( 'search' ) ? sanitize_text_field( $request->get_param( 'search' ) ) : '',
			'limit'               => $pagination['per_page'],
			'offset'              => $pagination['offset'],
		];

		$result = $this->service->get_defaulters_report( $args );
		return $this->paginated( $result['data'], $result['total'], $pagination['page'], $pagination['per_page'] );
	}

	// ─── Fee Types Callbacks ─────────────────────────────────────────────────

	/**
	 * Gets reusable fee type list.
	 */
	public function get_fee_types( WP_REST_Request $request ): WP_REST_Response {
		$pagination = $this->get_pagination( $request );
		$args       = [
			'status'        => $request->get_param( 'status' ) ? sanitize_text_field( $request->get_param( 'status' ) ) : '',
			'scope'         => $request->get_param( 'scope' ) ? sanitize_text_field( $request->get_param( 'scope' ) ) : '',
			'frequency'     => $request->get_param( 'frequency' ) ? sanitize_text_field( $request->get_param( 'frequency' ) ) : '',
			'has_overrides' => $request->get_param( 'has_overrides' ) ? sanitize_text_field( $request->get_param( 'has_overrides' ) ) : '',
			'search'        => $request->get_param( 'search' ) ? sanitize_text_field( $request->get_param( 'search' ) ) : '',
			'limit'         => $pagination['per_page'],
			'offset'        => $pagination['offset'],
		];

		$result = $this->service->get_fee_types( $args );

		return $this->paginated(
			$result['fee_types'],
			$result['total'],
			$pagination['page'],
			$pagination['per_page']
		);
	}

	/**
	 * Gets a single fee type by ID.
	 * Eliminates the per_page:999 antipattern on the edit page.
	 */
	public function get_fee_type( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$result = $this->service->get_fee_type_by_id( $id );

		if ( empty( $result ) ) {
			return $this->error( 'not_found', __( 'Fee type not found.', 'nexora-school-management' ), 404 );
		}

		return $this->success( $result );
	}

	/**
	 * Creates a new fee type.
	 */
	public function create_fee_type( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$body = $this->json_body( $request );
		if ( is_wp_error( $body ) ) {
			return $body;
		}

		$result = $this->service->create_fee_type( $body );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'fee_type.created',
			[
				'fee_type_id' => $result['id'],
				'name'        => $result['name'],
			]
		);

		return $this->success( $result, 201 );
	}

	/**
	 * Updates a fee type.
	 */
	public function update_fee_type( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id   = (int) $request->get_param( 'id' );
		$body = $this->json_body( $request );
		if ( is_wp_error( $body ) ) {
			return $body;
		}

		$result = $this->service->update_fee_type( $id, $body );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'fee_type.updated',
			[
				'fee_type_id' => $id,
				'name'        => $result['name'],
			]
		);

		return $this->success( $result );
	}

	/**
	 * Soft-deletes (archives) a fee type.
	 */
	public function delete_fee_type( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$result = $this->service->delete_fee_type( $id );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log( 'fee_type.deleted', [ 'fee_type_id' => $id ] );

		return $this->success( $result );
	}

	// ─── Invoices Callbacks ──────────────────────────────────────────────────

	/**
	 * Gets paginated student invoices.
	 */
	public function get_invoices( WP_REST_Request $request ): WP_REST_Response {
		$per_page_param = $request->get_param( 'per_page' );
		if ( 'all' === $per_page_param || -1 === (int) $per_page_param ) {
			// ponytail: ceiling is memory; use streaming CSV export for > 2,000 rows
			$limit    = 0;
			$offset   = 0;
			$page     = 1;
			$per_page = 99999;
		} else {
			$pagination = $this->get_pagination( $request );
			$limit      = $pagination['per_page'];
			$offset     = $pagination['offset'];
			$page       = $pagination['page'];
			$per_page   = $pagination['per_page'];
		}

		$args = [
			'student_id'          => $request->get_param( 'student_id' ) ? (int) $request->get_param( 'student_id' ) : 0,
			'academic_session_id' => $request->get_param( 'academic_session_id' ) ? (int) $request->get_param( 'academic_session_id' ) : 0,
			'academic_term_id'    => $request->get_param( 'academic_term_id' ) ? (int) $request->get_param( 'academic_term_id' ) : 0,
			'academic_unit_id'    => $request->get_param( 'academic_unit_id' ) ? (int) $request->get_param( 'academic_unit_id' ) : 0,
			'start_date'          => $request->get_param( 'start_date' ) ? sanitize_text_field( $request->get_param( 'start_date' ) ) : '',
			'end_date'            => $request->get_param( 'end_date' ) ? sanitize_text_field( $request->get_param( 'end_date' ) ) : '',
			'date_type'           => $request->get_param( 'date_type' ) ? sanitize_key( $request->get_param( 'date_type' ) ) : 'issue_date',
			'status'              => $request->get_param( 'status' ) ? sanitize_text_field( $request->get_param( 'status' ) ) : '',
			'search'              => $request->get_param( 'search' ) ? sanitize_text_field( $request->get_param( 'search' ) ) : '',
			'order_by'            => $request->get_param( 'order_by' ) ? sanitize_key( $request->get_param( 'order_by' ) ) : 'created_at',
			'order'               => $request->get_param( 'order' ) ? sanitize_key( $request->get_param( 'order' ) ) : 'DESC',
			'limit'               => $limit,
			'offset'              => $offset,
		];

		$invoices = $this->service->get_invoices( $args );
		$total    = $this->service->count_invoices( $args );

		return $this->paginated( $invoices, $total, $page, $per_page );
	}

	/**
	 * Gets a single student invoice detail.
	 */
	public function get_invoice( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id      = (int) $request->get_param( 'id' );
		$invoice = $this->service->get_invoice( $id );

		if ( ! $invoice ) {
			return $this->error( 'not_found', __( 'Invoice not found.', 'nexora-school-management' ), 404 );
		}

		return $this->success( $invoice );
	}

	/**
	 * Creates a new student invoice.
	 */
	public function create_invoice( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$body = $this->json_body( $request );
		if ( is_wp_error( $body ) ) {
			return $body;
		}

		$result = $this->service->create_invoice( $body );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'invoice.created',
			[
				'invoice_id'     => $result['id'],
				'invoice_number' => $result['invoice_number'],
				'student_id'     => $result['student_id'],
				'total_minor'    => $result['total_minor'],
			]
		);

		return $this->success( $result, 201 );
	}

	/**
	 * Updates student invoice metadata (due date, guardian snapshot, term, discount note).
	 * Status is intentionally not settable here — use /cancel or /void.
	 */
	public function update_invoice( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id   = (int) $request->get_param( 'id' );
		$body = $this->json_body( $request );
		if ( is_wp_error( $body ) ) {
			return $body;
		}

		$result = $this->service->update_invoice( $id, $body );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'invoice.updated',
			[
				'invoice_id'     => $id,
				'invoice_number' => $result['invoice_number'],
				'status'         => $result['status'],
			]
		);

		return $this->success( $result );
	}

	/**
	 * Cancels an invoice (POST /invoices/{id}/cancel).
	 */
	public function cancel_invoice( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$reason = $request->get_param( 'reason' );
		$result = $this->service->cancel_invoice( $id, $reason ? sanitize_text_field( $reason ) : null );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log( 'invoice.cancelled', [ 'invoice_id' => $id, 'reason' => $reason ] );

		return $this->success( [ 'cancelled' => true ] );
	}

	/**
	 * Voids an invoice (POST /invoices/{id}/void).
	 */
	public function void_invoice( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$reason = $request->get_param( 'reason' );
		$result = $this->service->void_invoice( $id, $reason ? sanitize_text_field( $reason ) : null );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log( 'invoice.voided', [ 'invoice_id' => $id, 'reason' => $reason ] );

		return $this->success( [ 'voided' => true ] );
	}

	// ─── Payments Callbacks ──────────────────────────────────────────────────

	/**
	 * Gets payment journal entries list.
	 */
	public function get_payments( WP_REST_Request $request ): WP_REST_Response {
		$pagination = $this->get_pagination( $request );
		$args       = [
			'student_id'          => $request->get_param( 'student_id' ) ? (int) $request->get_param( 'student_id' ) : 0,
			'invoice_id'          => $request->get_param( 'invoice_id' ) ? (int) $request->get_param( 'invoice_id' ) : 0,
			'academic_session_id' => $request->get_param( 'academic_session_id' ) ? (int) $request->get_param( 'academic_session_id' ) : 0,
			'method'              => $request->get_param( 'method' ) ? sanitize_text_field( $request->get_param( 'method' ) ) : '',
			'status'              => $request->get_param( 'status' ) ? sanitize_text_field( $request->get_param( 'status' ) ) : '',
			'start_date'          => $request->get_param( 'start_date' ) ? sanitize_text_field( $request->get_param( 'start_date' ) ) : '',
			'end_date'            => $request->get_param( 'end_date' ) ? sanitize_text_field( $request->get_param( 'end_date' ) ) : '',
			'search'              => $request->get_param( 'search' ) ? sanitize_text_field( $request->get_param( 'search' ) ) : '',
			'limit'               => $pagination['per_page'],
			'offset'              => $pagination['offset'],
		];

		$payments = $this->service->get_payments( $args );
		$total    = $this->service->count_payments( $args );

		return $this->paginated( $payments, $total, $pagination['page'], $pagination['per_page'] );
	}

	/**
	 * Gets a single payment by ID (CL5).
	 */
	public function get_payment( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id      = (int) $request->get_param( 'id' );
		$payment = $this->service->get_payment( $id );

		if ( ! $payment ) {
			return $this->error( 'not_found', __( 'Payment not found.', 'nexora-school-management' ), 404 );
		}

		return $this->success( $payment );
	}

	/**
	 * Records a manual payment transaction.
	 */
	public function record_payment( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$body = $this->json_body( $request );
		if ( is_wp_error( $body ) ) {
			return $body;
		}

		$result = $this->service->record_payment( $body );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'payment.recorded',
			[
				'payment_id'     => $result['id'],
				'payment_number' => $result['payment_number'],
				'invoice_id'     => $result['invoice_id'],
				'amount_minor'   => $result['amount_minor'],
			]
		);

		return $this->success( $result, 201 );
	}

	/**
	 * Cancels a payment (POST /payments/{id}/cancel).
	 */
	public function cancel_payment( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$reason = $request->get_param( 'reason' );
		$result = $this->service->cancel_payment( $id, $reason ? sanitize_text_field( $reason ) : null );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log( 'payment.cancelled', [ 'payment_id' => $id, 'reason' => $reason ] );

		return $this->success( [ 'cancelled' => true ] );
	}

	// ─── Class Rates ─────────────────────────────────────────────────────────

	/**
	 * GET /fee-types/:id/class-rates
	 */
	public function get_class_rates( WP_REST_Request $request ): WP_REST_Response {
		$id    = (int) $request->get_param( 'id' );
		$rates = $this->service->get_class_rates( $id );
		return $this->success( $rates );
	}

	/**
	 * POST /fee-types/:id/class-rates  { unit_id, amount }
	 */
	public function upsert_class_rate( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id           = (int) $request->get_param( 'id' );
		$body         = $request->get_json_params();
		$unit_id      = (int) ( $body['academic_unit_id'] ?? 0 );
		$amount_minor = (int) ( $body['amount_minor'] ?? round( (float) ( $body['amount'] ?? 0 ) * 100 ) );

		if ( ! $unit_id ) {
			return $this->error( 'missing_unit', __( 'academic_unit_id is required.', 'nexora-school-management' ), 400 );
		}

		$result = $this->service->upsert_class_rate( $id, $unit_id, $amount_minor );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return $this->success( $result );
	}

	/**
	 * DELETE /fee-types/:id/class-rates/:unit_id
	 */
	public function delete_class_rate( WP_REST_Request $request ): WP_REST_Response {
		$fee_type_id = (int) $request->get_param( 'id' );
		$unit_id     = (int) $request->get_param( 'unit_id' );
		$this->service->delete_class_rate( $fee_type_id, $unit_id );
		return $this->success( [ 'deleted' => true ] );
	}

	/**
	 * GET /invoices/resolve-fee-amount?fee_type_id=X&student_id=Y&session_id=Z
	 */
	public function resolve_fee_amount( WP_REST_Request $request ): WP_REST_Response {
		$fee_type_id = (int) $request->get_param( 'fee_type_id' );
		$student_id  = (int) $request->get_param( 'student_id' );
		$session_id  = (int) $request->get_param( 'session_id' );

		$amount_minor = $this->service->resolve_fee_amount( $fee_type_id, $student_id, $session_id );

		return $this->success( [ 'amount_minor' => $amount_minor ] );
	}

	/**
	 * POST /invoices/{id}/line-items
	 */
	public function add_line_item( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id      = (int) $request->get_param( 'id' );
		$payload = $request->get_json_params() ?? [];
		$result  = $this->service->add_line_item( $id, $payload );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log( 'invoice.line_item_added', [ 'invoice_id' => $id ] );
		return $this->success( $result );
	}

	/**
	 * PATCH /invoices/{id}/line-items/{lid}
	 */
	public function update_line_item( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id      = (int) $request->get_param( 'id' );
		$lid     = (int) $request->get_param( 'lid' );
		$payload = $request->get_json_params() ?? [];
		$result  = $this->service->update_line_item( $id, $lid, $payload );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log( 'invoice.line_item_updated', [ 'invoice_id' => $id, 'line_item_id' => $lid ] );
		return $this->success( $result );
	}

	/**
	 * DELETE /invoices/{id}/line-items/{lid}
	 */
	public function delete_line_item( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$lid    = (int) $request->get_param( 'lid' );
		$result = $this->service->delete_line_item( $id, $lid );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log( 'invoice.line_item_deleted', [ 'invoice_id' => $id, 'line_item_id' => $lid ] );
		return $this->success( $result );
	}

	/**
	 * Issues a draft invoice (POST /invoices/{id}/issue).
	 */
	public function issue_invoice( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$result = $this->service->issue_invoice( $id );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log( 'invoice.issued', [ 'invoice_id' => $id ] );

		return $this->success( $result );
	}

	/**
	 * POST /invoices/bulk-action
	 */
	public function bulk_invoices_action( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->service->bulk_action( $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'invoice.bulk_action',
			[
				'action' => $params['action'] ?? '',
				'count'  => count( $params['ids'] ?? [] ),
			]
		);

		return $this->success( $result );
	}
}
