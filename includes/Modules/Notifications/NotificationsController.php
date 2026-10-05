<?php
/**
 * Notifications REST API controller.
 *
 * Exposes REST routes to send test emails and manual invoice reminders.
 *
 * @package CodeClove\Modules\Notifications
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Notifications;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Api\BaseController;
use CodeClove\Shared\AuditLogger;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Class NotificationsController
 */
final class NotificationsController extends BaseController {

	private NotificationsService $service;

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->service = new NotificationsService();
	}

	/**
	 * Registers REST routes.
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/settings/notifications/test',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'send_test_email' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'notifications.manage', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/settings/notifications/test-sms',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'send_test_sms' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'notifications.manage', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/finance/invoices/(?P<id>\d+)/remind',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'send_invoice_reminder' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'invoices.edit', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/notifications',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_notifications' ],
					'permission_callback' => $this->authenticated(),
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/notifications/(?P<id>\d+)/read',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'mark_as_read' ],
					'permission_callback' => $this->authenticated(),
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/notifications/read-all',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'mark_all_read' ],
					'permission_callback' => $this->authenticated(),
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/announcements',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_announcements' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'notifications.manage', $request ); },
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'create_announcement' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'notifications.manage', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/announcements/(?P<id>\d+)',
			[
				[
					'methods'             => 'PUT',
					'callback'            => [ $this, 'update_announcement' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'notifications.manage', $request ); },
				],
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'delete_announcement' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'notifications.manage', $request ); },
				],
			]
		);
	}

	/**
	 * Sends a test email.
	 */
	public function send_test_email( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$recipient = isset( $params['email'] ) ? sanitize_email( $params['email'] ) : '';
		if ( empty( $recipient ) || ! is_email( $recipient ) ) {
			return $this->error( 'invalid_email', __( 'Please provide a valid recipient email address.', 'codeclove-school-management' ), 400 );
		}

		$sent = $this->service->send_test_email( $recipient );

		if ( ! $sent ) {
			return $this->error( 'send_failed', __( 'Failed to send test email. Please check your configuration and server mail logs.', 'codeclove-school-management' ), 500 );
		}

		return $this->success( [ 'sent' => true ] );
	}

	/**
	 * Sends a test SMS.
	 */
	public function send_test_sms( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$phone = isset( $params['phone'] ) ? sanitize_text_field( $params['phone'] ) : '';
		if ( empty( $phone ) ) {
			return $this->error( 'invalid_phone', __( 'Please provide a valid recipient phone number.', 'codeclove-school-management' ), 400 );
		}

		$sent = $this->service->send_test_sms( $phone );

		if ( ! $sent ) {
			return $this->error( 'send_failed', __( 'Failed to send test SMS. Please check your SMS provider configuration and logs.', 'codeclove-school-management' ), 500 );
		}

		return $this->success( [ 'sent' => true ] );
	}

	/**
	 * Sends a manual invoice payment reminder.
	 */
	public function send_invoice_reminder( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id = (int) $request->get_param( 'id' );

		$sent = $this->service->send_fee_reminder( $id );
		if ( ! $sent ) {
			return $this->error( 'send_failed', __( 'Failed to send invoice reminder. Please verify the invoice exists and a valid guardian email is set.', 'codeclove-school-management' ), 400 );
		}

		AuditLogger::log(
			'finance.invoice.reminder_sent',
			[ 'invoice_id' => $id ]
		);

		return $this->success( [ 'sent' => true ] );
	}

	/**
	 * Retrieves notifications for the logged-in user.
	 */
	public function get_notifications( WP_REST_Request $request ): WP_REST_Response {
		$user_id = get_current_user_id();

		$params = [
			'page'     => (int) ( $request->get_param( 'page' ) ?: 1 ),
			'per_page' => (int) ( $request->get_param( 'per_page' ) ?: 20 ),
		];

		$result = $this->service->get_user_notifications( $user_id, $params );

		return $this->success( [
			'items'        => $result['items'],
			'unread_count' => $result['unread_count'],
			'pagination'   => [
				'total'        => $result['total'],
				'per_page'     => $params['per_page'],
				'current_page' => $params['page'],
				'total_pages'  => ceil( $result['total'] / $params['per_page'] ),
			],
		] );
	}

	/**
	 * Marks a single notification as read.
	 */
	public function mark_as_read( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$user_id = get_current_user_id();
		$id      = (int) $request->get_param( 'id' );

		$success = $this->service->mark_as_read( $user_id, $id );
		if ( ! $success ) {
			return $this->error( 'not_found', __( 'Notification not found or access denied.', 'codeclove-school-management' ), 404 );
		}

		return $this->success( [ 'success' => true ] );
	}

	/**
	 * Marks all user's notifications as read.
	 */
	public function mark_all_read( WP_REST_Request $request ): WP_REST_Response {
		$user_id = get_current_user_id();

		$this->service->mark_all_read( $user_id );

		return $this->success( [ 'success' => true ] );
	}

	/**
	 * Retrieves announcements for Noticeboard.
	 */
	public function get_announcements( WP_REST_Request $request ): WP_REST_Response {
		$pagination = $this->get_pagination( $request );
		$params     = [
			'page'       => $pagination['page'],
			'per_page'   => $pagination['per_page'],
			'search'     => sanitize_text_field( (string) ( $request->get_param( 'search' ) ?: '' ) ),
			'audience'   => sanitize_key( (string) ( $request->get_param( 'audience' ) ?: '' ) ),
			'event_type' => sanitize_key( (string) ( $request->get_param( 'event_type' ) ?: '' ) ),
		];

		return $this->success( $this->service->get_announcements( $params ) );
	}

	/**
	 * Creates an announcement.
	 */
	public function create_announcement( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$created_id = $this->service->create_announcement( $params );
		if ( is_wp_error( $created_id ) ) {
			return $created_id;
		}

		AuditLogger::log(
			'announcement.created',
			[
				'id'       => $created_id,
				'title'    => $params['title'] ?? '',
				'audience' => $params['audience'] ?? 'portal',
			]
		);

		return $this->success( [ 'id' => $created_id, 'created' => true ], 201 );
	}

	/**
	 * Updates an announcement.
	 */
	public function update_announcement( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$updated = $this->service->update_announcement( $id, $params );
		if ( is_wp_error( $updated ) ) {
			return $updated;
		}

		AuditLogger::log(
			'announcement.updated',
			[ 'id' => $id ]
		);

		return $this->success( [ 'updated' => true ] );
	}

	/**
	 * Deletes an announcement.
	 */
	public function delete_announcement( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id      = (int) $request->get_param( 'id' );
		$deleted = $this->service->delete_announcement( $id );

		if ( ! $deleted ) {
			return $this->error( 'not_found', __( 'Announcement not found or already deleted.', 'codeclove-school-management' ), 404 );
		}

		AuditLogger::log(
			'announcement.deleted',
			[ 'id' => $id ]
		);

		return $this->success( [ 'deleted' => true ] );
	}

}
