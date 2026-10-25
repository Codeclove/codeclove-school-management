<?php
/**
 * Media REST API controller and protected document vault handler.
 *
 * Exposes REST routes to upload media files and stream protected documents.
 * Sensitive student and staff documents are isolated in a protected vault
 * managed by DocumentService.
 *
 * @package CodeClove\Modules\Media
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Media;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

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
	 * Initializes early WordPress hooks for document protection and URL filtering.
	 */
	public static function init(): void {
		add_action( 'init', [ DocumentService::class, 'intercept_document_requests' ], 1 );
		add_filter( 'wp_get_attachment_url', [ __CLASS__, 'filter_attachment_url' ], 10, 2 );
	}

	/**
	 * Registers REST routes for media uploads and protected document streaming.
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/media/upload',
			[
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'upload_file' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool {
						return $this->can( 'students.edit', $request )
							|| $this->can( 'students.add', $request )
							|| $this->can( 'admissions.edit', $request )
							|| $this->can( 'settings.edit', $request )
							|| $this->can( 'staff.edit', $request )
							|| $this->can( 'staff.add', $request );
					},
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/media/document/(?P<id>\d+)',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'view_document' ],
					'permission_callback' => [ $this, 'check_document_permission' ],
					'args'                => [
						'id' => [
							'required'          => true,
							'validate_callback' => static fn( $val ) => is_numeric( $val ) && (int) $val > 0,
						],
					],
				],
			]
		);

		add_filter( 'rest_authentication_errors', [ $this, 'authenticate_document_request' ], 9 );
	}

	/**
	 * Filters attachment URLs to return secure REST streaming URLs for protected documents.
	 *
	 * @param string $url           Default attachment URL.
	 * @param int    $attachment_id Attachment post ID.
	 * @return string Secure REST URL or original URL.
	 */
	public static function filter_attachment_url( string $url, int $attachment_id ): string {
		if ( DocumentService::is_protected_document( $attachment_id ) ) {
			return DocumentService::get_document_url( $attachment_id );
		}
		return $url;
	}

	/**
	 * Handles file uploads to the WordPress Media Library or protected documents vault.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function upload_file( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$user_id    = get_current_user_id();
		$can_upload = current_user_can( 'upload_files' )
			|| current_user_can( 'manage_options' )
			|| ( function_exists( 'codeclove_user_can' ) && (
				codeclove_user_can( $user_id, 'students.edit' )
				|| codeclove_user_can( $user_id, 'students.add' )
				|| codeclove_user_can( $user_id, 'staff.edit' )
				|| codeclove_user_can( $user_id, 'staff.add' )
				|| codeclove_user_can( $user_id, 'admissions.edit' )
				|| codeclove_user_can( $user_id, 'settings.edit' )
			) );

		if ( ! $can_upload ) {
			return $this->error( 'forbidden', __( 'You do not have permission to upload files.', 'codeclove-school-management' ), 403 );
		}

		$files = $request->get_file_params();
		// phpcs:ignore WordPress.Security.NonceVerification.Missing,WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$file = ! empty( $files['file'] ) && is_array( $files['file'] ) ? $files['file'] : ( ! empty( $_FILES['file'] ) && is_array( $_FILES['file'] ) ? $_FILES['file'] : [] );

		if ( empty( $file ) || empty( $file['name'] ) ) {
			return $this->error( 'missing_file', __( 'No file was uploaded. Please send the file in the "file" form-data parameter.', 'codeclove-school-management' ), 400 );
		}

		$raw_file_name  = sanitize_file_name( wp_unslash( (string) ( $file['name'] ?? '' ) ) );
		$requested_type = sanitize_text_field( (string) $request->get_param( 'type' ) );
		$is_document    = in_array( $requested_type, [ 'pdf', 'document' ], true );

		if ( $is_document ) {
			$file_info     = wp_check_filetype( $raw_file_name );
			$ext           = strtolower( (string) ( $file_info['ext'] ?? '' ) );
			$uploaded_type = sanitize_mime_type( (string) ( $file['type'] ?? '' ) );
			$allowed_exts  = DocumentService::ALLOWED_EXTENSIONS;
			$allowed_mimes = DocumentService::ALLOWED_MIMES;

			if ( ! in_array( $ext, $allowed_exts, true ) || ( ! empty( $uploaded_type ) && ! in_array( $uploaded_type, $allowed_mimes, true ) ) ) {
				return $this->error( 'invalid_file_type', __( 'Only PDF, JPG, and PNG documents are allowed.', 'codeclove-school-management' ), 400 );
			}
		}

		// Configure storage directory: vault for documents, /codeclove for general media.
		$subdir            = $is_document ? DocumentService::VAULT_SUBDIR : '/codeclove';
		$upload_dir_filter = static function ( array $uploads ) use ( $subdir ): array {
			$uploads['subdir'] = $subdir;
			$uploads['path']   = $uploads['basedir'] . $subdir;
			$uploads['url']    = $uploads['baseurl'] . $subdir;
			return $uploads;
		};

		$filename_filter = static function ( string $filename ) use ( $is_document ): string {
			if ( $is_document ) {
				return DocumentService::generate_secure_filename( $filename );
			}
			return $filename;
		};

		add_filter( 'upload_dir', $upload_dir_filter );
		add_filter( 'wp_unique_filename', $filename_filter );

		if ( $is_document ) {
			DocumentService::ensure_vault_protection();
		}

		try {
			$attachment_id = apply_filters( 'codeclove_media_upload', null, 'file' );

			if ( null === $attachment_id ) {
				require_once ABSPATH . 'wp-admin/includes/image.php';
				require_once ABSPATH . 'wp-admin/includes/file.php';
				require_once ABSPATH . 'wp-admin/includes/media.php';

				if ( empty( $_FILES['file'] ) && ! empty( $file ) ) {
					$_FILES['file'] = $file;
				}

				$overrides = [ 'test_form' => false ];
				if ( ! empty( $file['tmp_name'] ) && ! is_uploaded_file( $file['tmp_name'] ) && file_exists( $file['tmp_name'] ) ) {
					$overrides['action'] = 'wp_handle_sideload';
				}
				$attachment_id = media_handle_upload( 'file', 0, [], $overrides );
			}
		} finally {
			remove_filter( 'upload_dir', $upload_dir_filter );
			remove_filter( 'wp_unique_filename', $filename_filter );
		}

		if ( is_wp_error( $attachment_id ) ) {
			return $this->error(
				$attachment_id->get_error_code() ?: 'upload_failed',
				$attachment_id->get_error_message() ?: __( 'Failed to upload document.', 'codeclove-school-management' ),
				400
			);
		}

		// Post-upload verification for documents.
		if ( $is_document ) {
			$actual_mime = get_post_mime_type( (int) $attachment_id );
			if ( $actual_mime && ! in_array( $actual_mime, DocumentService::ALLOWED_MIMES, true ) ) {
				wp_delete_attachment( (int) $attachment_id, true );
				return $this->error( 'invalid_file_type', __( 'Only PDF, JPG, and PNG documents are allowed.', 'codeclove-school-management' ), 400 );
			}

			$attached_file = get_attached_file( (int) $attachment_id );

			// Restrict documents path: verify file is strictly inside the vault.
			if ( $attached_file && file_exists( $attached_file ) ) {
				if ( ! DocumentService::is_within_vault( $attached_file ) ) {
					wp_delete_attachment( (int) $attachment_id, true );
					return $this->error( 'invalid_path', __( 'Document path is restricted to the plugin documents folder in wp-content.', 'codeclove-school-management' ), 400 );
				}
			}

			update_post_meta( (int) $attachment_id, DocumentService::META_PROTECTED, 1 );
		}

		AuditLogger::log( 'media.uploaded', [ 'attachment_id' => (int) $attachment_id ] );

		$attached_file = get_attached_file( (int) $attachment_id );
		$file_size     = ( $attached_file && file_exists( $attached_file ) ) ? (int) filesize( $attached_file ) : null;
		$mime_type     = get_post_mime_type( (int) $attachment_id );
		$file_name     = $attached_file ? basename( $attached_file ) : $raw_file_name;

		$display_file_name = DocumentService::get_clean_display_filename( $file_name );

		$doc_url = $is_document
			? DocumentService::get_document_url( (int) $attachment_id )
			: ( wp_get_attachment_image_url( $attachment_id, 'medium' ) ?: ( wp_get_attachment_url( $attachment_id ) ?: '' ) );

		return $this->success( [
			'id'        => (int) $attachment_id,
			'url'       => $doc_url,
			'file_name' => $display_file_name,
			'file_size' => $file_size,
			'mime_type' => $mime_type ?: ( $is_document ? 'application/pdf' : 'image/jpeg' ),
		] );
	}

	/**
	 * Checks permission to view an uploaded document.
	 *
	 * @param WP_REST_Request $request
	 * @return bool|WP_Error
	 */
	public function check_document_permission( WP_REST_Request $request ): bool|WP_Error {
		$user_id       = get_current_user_id();
		$attachment_id = (int) $request->get_param( 'id' );

		if ( ! $user_id || $attachment_id <= 0 ) {
			return new WP_Error(
				'codeclove_unauthorized',
				__( 'You must be logged in to view school documents.', 'codeclove-school-management' ),
				[ 'status' => 401 ]
			);
		}

		if ( DocumentService::can_user_access( $user_id, $attachment_id ) ) {
			return true;
		}

		return new WP_Error(
			'codeclove_forbidden',
			__( 'You do not have permission to view this document.', 'codeclove-school-management' ),
			[ 'status' => 403 ]
		);
	}

	/**
	 * Securely streams an authenticated document to authorized users via REST API route.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error|void
	 */
	public function view_document( WP_REST_Request $request ) {
		$attachment_id = (int) $request->get_param( 'id' );
		return DocumentService::stream( $attachment_id );
	}

	/**
	 * Allows standard WordPress cookie authentication for document stream requests
	 * without requiring an X-WP-Nonce header when clicking links in browser tabs.
	 *
	 * @param mixed $result Authentication result.
	 * @return mixed
	 */
	public function authenticate_document_request( mixed $result ): mixed {
		if ( ! empty( $result ) ) {
			return $result;
		}

		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$uri = sanitize_text_field( wp_unslash( (string) ( $_SERVER['REQUEST_URI'] ?? '' ) ) );
		if ( str_contains( $uri, '/codeclove/v1/media/document/' ) ) {
			if ( is_user_logged_in() ) {
				return true;
			}
			$cookie_uid = function_exists( 'wp_validate_auth_cookie' ) ? (int) wp_validate_auth_cookie( '', 'logged_in' ) : 0;
			if ( $cookie_uid > 0 ) {
				wp_set_current_user( $cookie_uid );
				return true;
			}
		}

		return $result;
	}

}
