<?php
/**
 * Media REST API controller.
 *
 * Exposes a REST route to upload files/images directly to the WordPress Media Library
 * using standard multipart/form-data. Bypasses the need for wp.media scripts and styles.
 *
 * @package CodeClove\Modules\Media
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Media;

use CodeClove\Api\BaseController;
use CodeClove\Shared\AuditLogger;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class MediaController
 */
final class MediaController extends BaseController {

	/**
	 * Registers REST routes.
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/media/upload',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'upload_file' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'students.edit', $request ) || $this->can( 'students.add', $request ) || $this->can( 'admissions.edit', $request ) || $this->can( 'settings.edit', $request ); },
				],
			]
		);
	}

	/**
	 * Handles file upload to WP Media Library.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function upload_file( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		if ( ! current_user_can( 'upload_files' ) ) {
			return $this->error( 'forbidden', __( 'You do not have permission to upload files.', 'codeclove-school-management' ), 403 );
		}

		// Verify file is uploaded (nonce verified at REST API layer)
		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		if ( empty( $_FILES['file'] ) ) {
			return $this->error( 'missing_file', __( 'No file was uploaded. Please send the file in the "file" form-data parameter.', 'codeclove-school-management' ), 400 );
		}
		// Let WordPress upload and create the attachment, or use a filtered mock for testing
		$attachment_id = apply_filters( 'codeclove_media_upload', null, 'file' );

		if ( null === $attachment_id ) {
			// Ensure WordPress admin files are loaded for media handling
			require_once ABSPATH . 'wp-admin/includes/image.php';
			require_once ABSPATH . 'wp-admin/includes/file.php';
			require_once ABSPATH . 'wp-admin/includes/media.php';

			$attachment_id = media_handle_upload( 'file', 0 );
		}

		if ( is_wp_error( $attachment_id ) ) {
			return $attachment_id;
		}

		AuditLogger::log( 'media.uploaded', [ 'attachment_id' => (int) $attachment_id ] );

		$url = wp_get_attachment_image_url( $attachment_id, 'medium' );
		if ( ! $url ) {
			$url = wp_get_attachment_url( $attachment_id );
		}

		return $this->success( [
			'id'  => (int) $attachment_id,
			'url' => $url ?: '',
		] );
	}
}
