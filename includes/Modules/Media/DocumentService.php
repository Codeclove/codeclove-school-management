<?php
/**
 * Protected Document Vault Service.
 *
 * Provides a secure, isolated storage vault and reusable access control for sensitive
 * school documents (student records, staff files, admission documents, certificates).
 *
 * Follows WordPress.org guidelines:
 * - Safe filesystem storage with .htaccess and index.php guards.
 * - Path traversal mitigation with realpath & WP_CONTENT_DIR validation.
 * - Strict MIME type verification using WordPress core APIs.
 * - Role-based and ownership-based access control.
 * - Standardized, cache-safe binary streaming with security headers.
 *
 * @package CodeClove\Modules\Media
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Media;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Database\Schema;
use CodeClove\Shared\AuditLogger;
use WP_Error;
use WP_REST_Response;

/**
 * Class DocumentService
 */
final class DocumentService {

	/**
	 * Relative path inside wp-content/uploads for protected documents.
	 */
	public const VAULT_SUBDIR = '/codeclove/documents';

	/**
	 * Post meta key marking an attachment as a protected document.
	 */
	public const META_PROTECTED = '_codeclove_document';

	/**
	 * Allowed MIME types for documents (PDFs and scanned images).
	 */
	public const ALLOWED_MIMES = [
		'application/pdf',
		'image/jpeg',
		'image/png',
	];

	/**
	 * Allowed extensions for documents.
	 */
	public const ALLOWED_EXTENSIONS = [ 'pdf', 'jpg', 'jpeg', 'png' ];
	/**
	 * Returns the absolute physical directory path to the protected documents vault.
	 *
	 * @return string Normalized directory path without trailing slash.
	 */
	public static function get_vault_dir(): string {
		$upload_dir = wp_upload_dir();
		$base_dir   = $upload_dir['basedir'] ?? WP_CONTENT_DIR . '/uploads';
		return wp_normalize_path( untrailingslashit( $base_dir ) . self::VAULT_SUBDIR );
	}

	/**
	 * Ensures the protected documents vault directory exists and is secured
	 * with index.php (to disable directory indexing) and .htaccess (to block direct HTTP access on Apache/LiteSpeed).
	 *
	 * @param string|null $target_dir Optional custom directory path; defaults to vault directory.
	 */
	public static function ensure_vault_protection( ?string $target_dir = null ): void {
		$dir = $target_dir ? wp_normalize_path( untrailingslashit( $target_dir ) ) : self::get_vault_dir();

		if ( ! is_dir( $dir ) ) {
			wp_mkdir_p( $dir );
		}

		// 1. Prevent directory listing on any web server.
		$index_file = trailingslashit( $dir ) . 'index.php';
		if ( ! file_exists( $index_file ) ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			@file_put_contents( $index_file, "<?php\n// Silence is golden.\n" );
		}

		// 2. Deny direct HTTP access on Apache / LiteSpeed web servers.
		$htaccess_file = trailingslashit( $dir ) . '.htaccess';
		if ( ! file_exists( $htaccess_file ) ) {
			$htaccess_content = "# Deny direct access to sensitive school documents\n<IfModule mod_authz_core.c>\n    Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n    Deny from all\n</IfModule>\n";
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			@file_put_contents( $htaccess_file, $htaccess_content );
		}
	}

	/**
	 * Validates that a file path is safe and strictly located within WP_CONTENT_DIR.
	 * Mitigates path traversal attacks (e.g., ../../../../etc/passwd).
	 *
	 * @param string $file_path Path to test.
	 * @return bool True if safe and within WP_CONTENT_DIR, false otherwise.
	 */
	public static function is_safe_content_path( string $file_path ): bool {
		if ( empty( $file_path ) ) {
			return false;
		}

		$real = realpath( $file_path );
		if ( ! $real ) {
			return false;
		}

		$norm_file    = wp_normalize_path( $real );
		$content_root = defined( 'WP_CONTENT_DIR' )
			? trailingslashit( wp_normalize_path( (string) realpath( WP_CONTENT_DIR ) ) )
			: false;

		return $content_root ? str_starts_with( $norm_file, $content_root ) : false;
	}

	/**
	 * Checks whether a file path is strictly inside the protected documents vault.
	 *
	 * @param string $file_path Path to test.
	 * @return bool
	 */
	public static function is_within_vault( string $file_path ): bool {
		if ( empty( $file_path ) || ! self::is_safe_content_path( $file_path ) ) {
			return false;
		}

		$vault_dir  = trailingslashit( wp_normalize_path( self::get_vault_dir() ) );
		$real_vault = realpath( self::get_vault_dir() );
		$vault_root = trailingslashit( wp_normalize_path( $real_vault ?: $vault_dir ) );
		$real_file  = realpath( $file_path );
		$norm_file  = wp_normalize_path( $real_file ?: $file_path );

		return str_starts_with( $norm_file, $vault_root );
	}
	/**
	 * Generates a collision-resistant, unguessable filename for vault storage.
	 *
	 * @param string $filename Original filename.
	 * @return string Prefixed secure filename.
	 */
	public static function generate_secure_filename( string $filename ): string {
		$sanitized = sanitize_file_name( $filename );
		if ( str_starts_with( $sanitized, 'cc_' ) ) {
			return $sanitized;
		}

		$token = strtolower( wp_generate_password( 12, false, false ) );
		return 'cc_' . $token . '_' . $sanitized;
	}

	/**
	 * Cleans internal obfuscation hashes and legacy extensions from a filename for clean display.
	 *
	 * @param string $filename Internal filename or path.
	 * @return string User-friendly display filename.
	 */
	public static function get_clean_display_filename( string $filename ): string {
		$base = basename( $filename );
		return (string) preg_replace( '/^(?:cc|doc)_[a-zA-Z0-9]+_/', '', $base );
	}

	/**
	 * Returns the secure REST URL for streaming an authenticated document.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return string Secure REST route URL.
	 */
	public static function get_document_url( int $attachment_id ): string {
		return rest_url( 'codeclove/v1/media/document/' . $attachment_id );
	}

	/**
	 * Checks whether an attachment is a protected CodeClove document.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return bool
	 */
	public static function is_protected_document( int $attachment_id ): bool {
		if ( $attachment_id <= 0 ) {
			return false;
		}

		// 1. Check postmeta flag.
		if ( get_post_meta( $attachment_id, self::META_PROTECTED, true ) ) {
			return true;
		}

		// 2. Check attached file location or extension.
		$attached_file = (string) get_attached_file( $attachment_id );
		if ( str_contains( $attached_file, 'codeclove/documents' ) ) {
			return true;
		}

		global $wpdb;

		// 3. Check students table with exact JSON key pattern.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$in_students = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE (documents_json LIKE %s OR documents_json LIKE %s OR documents_json LIKE %s) LIMIT 1',
				Schema::students(),
				'%"attachment_id":' . $attachment_id . '%',
				'%"attachment_id": ' . $attachment_id . '%',
				'%"attachment_id":"' . $attachment_id . '"%'
			)
		);
		if ( $in_students > 0 ) {
			return true;
		}

		// 4. Check admission documents table.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$in_app_docs = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE attachment_id = %d LIMIT 1',
				Schema::app_documents(),
				$attachment_id
			)
		);
		if ( $in_app_docs > 0 ) {
			return true;
		}

		// 5. Check staff members table with exact JSON key pattern.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$in_staff = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE (documents_json LIKE %s OR documents_json LIKE %s OR documents_json LIKE %s) LIMIT 1',
				Schema::staff_members(),
				'%"attachment_id":' . $attachment_id . '%',
				'%"attachment_id": ' . $attachment_id . '%',
				'%"attachment_id":"' . $attachment_id . '"%'
			)
		);
		if ( $in_staff > 0 ) {
			return true;
		}

		// 6. Check staff application documents table.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$in_staff_docs = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE attachment_id = %d LIMIT 1',
				Schema::staff_app_docs(),
				$attachment_id
			)
		);

		return $in_staff_docs > 0;
	}

	/**
	 * Determines whether a given WordPress user is authorized to access a specific document attachment.
	 *
	 * Strict Access Rules:
	 * - Administrators (`manage_options`) bypass all checks.
	 * - Extensible via `codeclove_can_access_document` filter hook.
	 * - Student Documents: Accessible ONLY by the owning student, their linked guardians,
	 *   or staff with explicit student/admission permissions.
	 * - Staff Documents: Accessible ONLY by the owning staff member,
	 *   or staff with explicit staff permissions.
	 * - In-flight / Unassigned documents: Accessible by the uploader (post_author)
	 *   or staff with add/edit management capabilities.
	 *
	 * @param int $user_id       WordPress User ID.
	 * @param int $attachment_id Attachment ID.
	 * @return bool True if authorized, false otherwise.
	 */
	public static function can_user_access( int $user_id, int $attachment_id ): bool {
		if ( $user_id <= 0 || $attachment_id <= 0 ) {
			return false;
		}

		// 1. WP Administrators have full access.
		if ( user_can( $user_id, 'manage_options' ) ) {
			return true;
		}

		// 2. Allow third-party modules / add-ons to hook in access checks.
		$filtered = apply_filters( 'codeclove_can_access_document', null, $user_id, $attachment_id );
		if ( null !== $filtered ) {
			return (bool) $filtered;
		}

		global $wpdb;

		// 3. Check if attachment belongs to a Student or Admission Application.
		$is_student_doc        = false;
		$student_id            = 0;
		$student_owner_user_id = 0;
		$is_applicant_owner    = false;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$student_rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT id, user_id, documents_json FROM %i 
				 WHERE (documents_json LIKE %s OR documents_json LIKE %s OR documents_json LIKE %s) 
				   AND deleted_at IS NULL',
				Schema::students(),
				'%"attachment_id":' . $attachment_id . '%',
				'%"attachment_id": ' . $attachment_id . '%',
				'%"attachment_id":"' . $attachment_id . '"%'
			),
			ARRAY_A
		);

		if ( ! empty( $student_rows ) ) {
			foreach ( $student_rows as $row ) {
				if ( self::has_attachment_in_docs_payload( $row['documents_json'] ?? '', $attachment_id ) ) {
					$is_student_doc        = true;
					$student_id            = (int) $row['id'];
					$student_owner_user_id = (int) ( $row['user_id'] ?? 0 );
					break;
				}
			}
		}

		if ( ! $is_student_doc ) {
			// Check admission application documents
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$adm_row = $wpdb->get_row(
				$wpdb->prepare(
					'SELECT d.id, a.converted_student_id, a.created_by, a.guardian_email, s.user_id as student_user_id
					 FROM %i d
					 INNER JOIN %i a ON a.id = d.application_id
					 LEFT JOIN %i s ON s.id = a.converted_student_id
					 WHERE d.attachment_id = %d AND a.deleted_at IS NULL LIMIT 1',
					Schema::app_documents(),
					Schema::applications(),
					Schema::students(),
					$attachment_id
				),
				ARRAY_A
			);

			if ( $adm_row ) {
				$is_student_doc        = true;
				$student_id            = (int) ( $adm_row['converted_student_id'] ?? 0 );
				$student_owner_user_id = (int) ( $adm_row['student_user_id'] ?? 0 );

				// Check if the current user is the submitting applicant or guardian
				$created_by = (int) ( $adm_row['created_by'] ?? 0 );
				if ( $created_by > 0 && $user_id === $created_by ) {
					$is_applicant_owner = true;
				} elseif ( ! empty( $adm_row['guardian_email'] ) ) {
					$user = get_userdata( $user_id );
					if ( $user && strcasecmp( (string) $user->user_email, (string) $adm_row['guardian_email'] ) === 0 ) {
						$is_applicant_owner = true;
					}
				}
			}
		}

		if ( $is_student_doc ) {
			// A. Owning student themselves or submitting applicant.
			if ( $is_applicant_owner ) {
				return true;
			}

			if ( $student_owner_user_id > 0 && $user_id === $student_owner_user_id ) {
				return true;
			}

			// B. Linked guardian of this student.
			if ( $student_id > 0 ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$is_guardian = (int) $wpdb->get_var(
					$wpdb->prepare(
						'SELECT COUNT(*) FROM %i sg
						 INNER JOIN %i g ON g.id = sg.guardian_id
						 WHERE sg.student_id = %d AND g.user_id = %d AND g.deleted_at IS NULL',
						Schema::student_guardians(),
						Schema::guardians(),
						$student_id,
						$user_id
					)
				);
				if ( $is_guardian > 0 ) {
					return true;
				}
			}

			// C. Staff with explicit student / admission view permissions.
			if ( function_exists( 'codeclove_user_can' ) ) {
				if (
					codeclove_user_can( $user_id, 'students.view' )
					|| codeclove_user_can( $user_id, 'students.edit' )
					|| codeclove_user_can( $user_id, 'admissions.view' )
					|| codeclove_user_can( $user_id, 'admissions.edit' )
					|| codeclove_user_can( $user_id, 'admission_documents.view' )
					|| codeclove_user_can( $user_id, 'admission_documents.edit' )
				) {
					return true;
				}
			}

			return false;
		}

		// 4. Check if attachment belongs to a Staff Member.
		$is_staff_doc             = false;
		$staff_owner_user_id      = 0;
		$is_staff_applicant_owner = false;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		// Check staff members table including soft-deleted records to preserve protection
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$staff_rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT id, user_id, documents_json, deleted_at FROM %i 
				 WHERE (documents_json LIKE %s OR documents_json LIKE %s OR documents_json LIKE %s)',
				Schema::staff_members(),
				'%"attachment_id":' . $attachment_id . '%',
				'%"attachment_id": ' . $attachment_id . '%',
				'%"attachment_id":"' . $attachment_id . '"%'
			),
			ARRAY_A
		);

		if ( ! empty( $staff_rows ) ) {
			foreach ( $staff_rows as $row ) {
				if ( self::has_attachment_in_docs_payload( $row['documents_json'] ?? '', $attachment_id ) ) {
					$is_staff_doc        = true;
					$staff_owner_user_id = (int) ( $row['user_id'] ?? 0 );
					break;
				}
			}
		}

		if ( ! $is_staff_doc ) {
			// Check staff application documents
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$staff_app_row = $wpdb->get_row(
				$wpdb->prepare(
					'SELECT d.id, sa.created_by, sa.email, COALESCE(sa.converted_user_id, sm.user_id) as staff_user_id
					 FROM %i d
					 INNER JOIN %i sa ON sa.id = d.staff_application_id
					 LEFT JOIN %i sm ON sm.id = sa.converted_staff_member_id
					 WHERE d.attachment_id = %d LIMIT 1',
					Schema::staff_app_docs(),
					Schema::staff_apps(),
					Schema::staff_members(),
					$attachment_id
				),
				ARRAY_A
			);
			if ( $staff_app_row ) {
				$is_staff_doc        = true;
				$staff_owner_user_id = (int) ( $staff_app_row['staff_user_id'] ?? 0 );

				// Check if the current user is the applicant who submitted the application
				$created_by = (int) ( $staff_app_row['created_by'] ?? 0 );
				if ( $created_by > 0 && $user_id === $created_by ) {
					$is_staff_applicant_owner = true;
				} elseif ( ! empty( $staff_app_row['email'] ) ) {
					$user = get_userdata( $user_id );
					if ( $user && strcasecmp( (string) $user->user_email, (string) $staff_app_row['email'] ) === 0 ) {
						$is_staff_applicant_owner = true;
					}
				}
			}
		}

		if ( $is_staff_doc ) {
			// A. Owning staff member or submitting staff applicant themselves.
			if ( $is_staff_applicant_owner ) {
				return true;
			}

			if ( $staff_owner_user_id > 0 && $user_id === $staff_owner_user_id ) {
				return true;
			}

			// B. Staff with staff management permissions.
			if ( function_exists( 'codeclove_user_can' ) ) {
				if (
					codeclove_user_can( $user_id, 'staff.view' )
					|| codeclove_user_can( $user_id, 'staff.edit' )
					|| codeclove_user_can( $user_id, 'staff_applications.view' )
					|| codeclove_user_can( $user_id, 'staff_applications.edit' )
				) {
					return true;
				}
			}

			return false;
		}

		// 5. In-flight unlinked attachment (e.g. freshly uploaded during form editing).
		$post = get_post( $attachment_id );
		if ( $post && (int) $post->post_author === $user_id ) {
			return true;
		}

		if ( function_exists( 'codeclove_user_can' ) ) {
			if (
				codeclove_user_can( $user_id, 'students.view' )
				|| codeclove_user_can( $user_id, 'students.edit' )
				|| codeclove_user_can( $user_id, 'students.add' )
				|| codeclove_user_can( $user_id, 'staff.view' )
				|| codeclove_user_can( $user_id, 'staff.edit' )
				|| codeclove_user_can( $user_id, 'staff.add' )
				|| codeclove_user_can( $user_id, 'admissions.view' )
				|| codeclove_user_can( $user_id, 'admissions.edit' )
				|| codeclove_user_can( $user_id, 'admission_documents.view' )
				|| codeclove_user_can( $user_id, 'admission_documents.edit' )
				|| codeclove_user_can( $user_id, 'staff_applications.view' )
				|| codeclove_user_can( $user_id, 'staff_applications.edit' )
			) {
				return true;
			}
		}

		// Verified active staff educator or advisor fallback
		if ( self::is_active_staff_user( $user_id ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Checks if an attachment ID exists within a JSON documents payload.
	 *
	 * @param mixed $documents_json Documents JSON string or array.
	 * @param int   $attachment_id  Attachment ID.
	 * @return bool
	 */
	public static function has_attachment_in_docs_payload( mixed $documents_json, int $attachment_id ): bool {
		if ( empty( $documents_json ) ) {
			return false;
		}

		$docs = is_string( $documents_json ) ? json_decode( $documents_json, true ) : $documents_json;
		if ( ! is_array( $docs ) ) {
			return false;
		}

		foreach ( $docs as $doc ) {
			if ( isset( $doc['attachment_id'] ) && (int) $doc['attachment_id'] === $attachment_id ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Checks if a user is an active school staff member.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return bool
	 */
	public static function is_active_staff_user( int $user_id ): bool {
		if ( $user_id <= 0 ) {
			return false;
		}

		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$staff_id = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM %i WHERE user_id = %d AND status = "active" AND deleted_at IS NULL LIMIT 1',
				Schema::staff_members(),
				$user_id
			)
		);

		return $staff_id > 0;
	}

	/**
	 * Migrates an attachment file located outside the vault into the protected vault.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return string|null Path to protected file or null if file does not exist.
	 */
	public static function migrate_legacy_file( int $attachment_id ): ?string {
		$attached_file = get_attached_file( $attachment_id );
		if ( ! $attached_file ) {
			return null;
		}

		$vault_dir = self::get_vault_dir();
		self::ensure_vault_protection( $vault_dir );

		if ( ! file_exists( $attached_file ) ) {
			$base = basename( $attached_file );
			if ( file_exists( $vault_dir . '/' . $base ) ) {
				$attached_file = $vault_dir . '/' . $base;
				update_attached_file( $attachment_id, $attached_file );
				return $attached_file;
			}
			return null;
		}

		$norm_attached = wp_normalize_path( $attached_file );
		$norm_vault    = trailingslashit( wp_normalize_path( $vault_dir ) );
		$needs_move    = ! str_starts_with( $norm_attached, $norm_vault );

		if ( $needs_move ) {
			$raw_filename = basename( $attached_file );
			$secure_name  = self::generate_secure_filename( $raw_filename );
			$target_file  = $vault_dir . '/' . $secure_name;

			// phpcs:ignore WordPress.WP.AlternativeFunctions.rename_rename, WordPress.WP.AlternativeFunctions.unlink_unlink
			if ( @rename( $attached_file, $target_file ) || ( @copy( $attached_file, $target_file ) && @unlink( $attached_file ) ) ) {
				update_attached_file( $attachment_id, $target_file );
				update_post_meta( $attachment_id, self::META_PROTECTED, 1 );
				$attached_file = $target_file;
			}
		} else {
			update_post_meta( $attachment_id, self::META_PROTECTED, 1 );
		}

		return $attached_file;
	}

	/**
	 * Securely streams an authenticated document attachment to the client.
	 *
	 * Sets strict cache-control and security headers. Clears output buffers
	 * to prevent output corruption. In automated test environments (Pest/PHPUnit),
	 * returns a WP_REST_Response instead of terminating script execution.
	 *
	 * @param int  $attachment_id Attachment ID.
	 * @param bool $download      Whether to force file download as attachment.
	 * @return WP_REST_Response|WP_Error|void
	 */
	public static function stream( int $attachment_id, bool $download = false ) {
		$attached_file = self::migrate_legacy_file( $attachment_id );
		if ( ! $attached_file || ! file_exists( $attached_file ) ) {
			if ( defined( 'WP_RUNNING_TESTS' ) && WP_RUNNING_TESTS ) {
				return new WP_Error( 'not_found', __( 'Document file not found.', 'codeclove-school-management' ), [ 'status' => 404 ] );
			}
			status_header( 404 );
			wp_die( esc_html__( 'Document file not found.', 'codeclove-school-management' ), 404 );
		}

		// Security: verify file is strictly inside WP_CONTENT_DIR.
		if ( ! self::is_safe_content_path( $attached_file ) ) {
			if ( defined( 'WP_RUNNING_TESTS' ) && WP_RUNNING_TESTS ) {
				return new WP_Error( 'forbidden', __( 'Access denied to this file path.', 'codeclove-school-management' ), [ 'status' => 403 ] );
			}
			status_header( 403 );
			wp_die( esc_html__( 'Access denied to this file path.', 'codeclove-school-management' ), 403 );
		}

		$mime_type    = get_post_mime_type( $attachment_id ) ?: 'application/pdf';
		$display_name = self::get_clean_display_filename( basename( $attached_file ) );

		AuditLogger::log( 'media.document_viewed', [ 'attachment_id' => $attachment_id ] );

		// When running automated tests, return response object instead of terminating.
		if ( defined( 'WP_RUNNING_TESTS' ) && WP_RUNNING_TESTS ) {
			return new WP_REST_Response( [
				'streamed'     => true,
				'content_type' => $mime_type,
				'filename'     => $display_name,
				'file_size'    => filesize( $attached_file ),
				'disposition'  => $download ? 'attachment' : 'inline',
			] );
		}
		// Clear any existing output buffers for clean binary streaming.
		while ( ob_get_level() > 0 ) {
			ob_end_clean();
		}

		nocache_headers();
		header( 'Content-Type: ' . $mime_type );
		$safe_filename = str_replace( [ '"', "\r", "\n" ], '', $display_name );
		$disposition   = $download ? 'attachment' : 'inline';
		header( 'Content-Disposition: ' . $disposition . '; filename="' . $safe_filename . '"' );
		header( 'Content-Length: ' . filesize( $attached_file ) );
		header( 'X-Content-Type-Options: nosniff' );

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile
		readfile( $attached_file );
		exit;
	}
	/**
	 * Deletes a protected attachment and its physical file on disk if it is
	 * no longer referenced by any student, staff member, or application.
	 *
	 * Prevents orphaned documents from consuming disk storage when documents
	 * are removed from profiles or unsubmitted forms.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return bool True if deleted, false if retained or not found.
	 */
	public static function delete_attachment_if_unreferenced( int $attachment_id ): bool {
		if ( $attachment_id <= 0 ) {
			return false;
		}

		// SAFETY GUARD: NEVER delete arbitrary WordPress media attachments!
		// Only delete attachments created as CodeClove protected documents or stored in the vault.
		$is_protected = (bool) get_post_meta( $attachment_id, self::META_PROTECTED, true );
		if ( ! $is_protected ) {
			$attached_file = (string) get_attached_file( $attachment_id );
			if ( empty( $attached_file ) || ! str_contains( wp_normalize_path( $attached_file ), 'codeclove/documents' ) ) {
				return false;
			}
		}

		global $wpdb;

		// 1. Check admission documents and staff application documents tables.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$app_doc_count = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE attachment_id = %d',
				Schema::app_documents(),
				$attachment_id
			)
		);
		if ( $app_doc_count > 0 ) {
			return false;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$staff_app_doc_count = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM %i WHERE attachment_id = %d',
				Schema::staff_app_docs(),
				$attachment_id
			)
		);
		if ( $staff_app_doc_count > 0 ) {
			return false;
		}

		// 2. Check students table with exact JSON key pattern.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$students_json_list = $wpdb->get_col(
			$wpdb->prepare(
				'SELECT documents_json FROM %i 
				 WHERE (documents_json LIKE %s OR documents_json LIKE %s OR documents_json LIKE %s) 
				   AND deleted_at IS NULL',
				Schema::students(),
				'%"attachment_id":' . $attachment_id . '%',
				'%"attachment_id": ' . $attachment_id . '%',
				'%"attachment_id":"' . $attachment_id . '"%'
			)
		);
		foreach ( $students_json_list as $json ) {
			if ( self::has_attachment_in_docs_payload( $json, $attachment_id ) ) {
				return false;
			}
		}

		// 3. Check staff members table with exact JSON key pattern.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$staff_json_list = $wpdb->get_col(
			$wpdb->prepare(
				'SELECT documents_json FROM %i 
				 WHERE (documents_json LIKE %s OR documents_json LIKE %s OR documents_json LIKE %s) 
				   AND deleted_at IS NULL',
				Schema::staff_members(),
				'%"attachment_id":' . $attachment_id . '%',
				'%"attachment_id": ' . $attachment_id . '%',
				'%"attachment_id":"' . $attachment_id . '"%'
			)
		);
		foreach ( $staff_json_list as $json ) {
			if ( self::has_attachment_in_docs_payload( $json, $attachment_id ) ) {
				return false;
			}
		}

		// Attachment is unreferenced: delete post and physical file from disk.
		wp_delete_attachment( $attachment_id, true );
		AuditLogger::log( 'media.document_unreferenced_deleted', [ 'attachment_id' => $attachment_id ] );
		return true;
	}

	/**
	 * Sanitizes documents payload for storage in JSON columns.
	 *
	 * Reusable across all modules (Students, Staff, Admissions).
	 * Validates each attachment:
	 * - Exists as a valid WordPress attachment.
	 * - Has an allowed document MIME type (PDF).
	 * - Points to a file strictly within WP_CONTENT_DIR.
	 *
	 * @param mixed  $docs    Raw documents array or JSON string.
	 * @param string $context Target schema: 'student' (id, name, title, url, file_size) or 'staff' (label, attachment_id, url).
	 * @return string JSON-encoded array of sanitized document items.
	 */
	public static function sanitize_documents_payload( mixed $docs, string $context = 'student' ): string {
		if ( is_string( $docs ) ) {
			$docs = json_decode( $docs, true );
		}

		if ( ! is_array( $docs ) ) {
			return '[]';
		}

		$clean = [];
		foreach ( $docs as $doc ) {
			if ( ! is_array( $doc ) || empty( $doc['attachment_id'] ) ) {
				continue;
			}

			$att_id = (int) $doc['attachment_id'];
			if ( $att_id <= 0 ) {
				continue;
			}

			// MUST be a valid, existing attachment post in WordPress.
			$attachment = get_post( $att_id );
			if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
				continue;
			}

			// Verify allowed document MIME type (PDF, JPEG, PNG).
			$mime_type = get_post_mime_type( $att_id );
			if ( ! $mime_type || ! in_array( $mime_type, self::ALLOWED_MIMES, true ) ) {
				continue;
			}

			// Restrict documents path: verify file exists on disk and is strictly within WP_CONTENT_DIR.
			$att_file = get_attached_file( $att_id );
			if ( ! $att_file || ! file_exists( $att_file ) || ! self::is_safe_content_path( $att_file ) ) {
				continue;
			}

			// Always enforce the secure REST streaming URL — NEVER allow arbitrary public/external URLs.
			$url = self::get_document_url( $att_id );

			if ( 'staff' === $context ) {
				$label     = sanitize_text_field( (string) ( ( $doc['label'] ?? '' ) ?: ( ( $doc['name'] ?? '' ) ?: 'Document' ) ) );
				$clean[]   = [
					'label'         => $label,
					'attachment_id' => $att_id,
					'url'           => $url,
				];
				continue;
			}

			// Student schema: accurately preserve custom titles and extensions
			$raw_name  = trim( (string) ( $doc['name'] ?? '' ) );
			$raw_title = trim( (string) ( ( $doc['title'] ?? '' ) ?: ( $doc['label'] ?? '' ) ) );
			$fallback  = $att_file ? basename( $att_file ) : 'document.pdf';

			$base_name = ! empty( $raw_name ) ? $raw_name : ( ! empty( $raw_title ) ? $raw_title : $fallback );

			$has_ext = (bool) preg_match( '/\.(pdf|jpg|jpeg|png)$/i', $base_name, $ext_match );
			if ( $has_ext ) {
				$filename = $base_name;
				$ext      = strtolower( $ext_match[1] );
			} else {
				$ext        = ( 'image/jpeg' === $mime_type ) ? 'jpg' : ( ( 'image/png' === $mime_type ) ? 'png' : 'pdf' );
				$clean_root = rtrim( $base_name, '.' );
				$filename   = $clean_root . '.' . $ext;
			}

			// Title: prefer explicit user title if provided, otherwise filename without extension
			if ( ! empty( $raw_title ) ) {
				$title = preg_replace( '/\.(pdf|jpg|jpeg|png)$/i', '', $raw_title );
			} else {
				$title = preg_replace( '/\.(pdf|jpg|jpeg|png)$/i', '', $filename );
			}

			$file_size = isset( $doc['file_size'] )
				? (int) $doc['file_size']
				: ( ( $att_file && file_exists( $att_file ) ) ? (int) filesize( $att_file ) : null );

			$id = ! empty( $doc['id'] ) ? sanitize_key( (string) $doc['id'] ) : ( 'doc_' . wp_generate_uuid4() );

			$uploaded_at = ! empty( $doc['uploaded_at'] )
				? sanitize_text_field( (string) $doc['uploaded_at'] )
				: current_time( 'mysql', true );

			$resolved_mime = $mime_type ?: ( in_array( $ext, [ 'jpg', 'jpeg' ], true ) ? 'image/jpeg' : ( 'png' === $ext ? 'image/png' : 'application/pdf' ) );

			$clean[] = [
				'id'            => $id,
				'name'          => sanitize_text_field( $filename ),
				'title'         => sanitize_text_field( $title ),
				'attachment_id' => $att_id,
				'url'           => $url,
				'file_size'     => $file_size,
				'mime_type'     => $resolved_mime,
				'uploaded_at'   => $uploaded_at,
			];
		}

		return wp_json_encode( $clean );
	}

	/**
	 * Resolves an attachment ID from a URL or relative path.
	 *
	 * @param string $path Requested URL or path.
	 * @return int Attachment ID or 0 if unresolved.
	 */
	public static function resolve_attachment_id( string $path ): int {
		global $wpdb;

		$upload_dir  = wp_upload_dir();
		$basedir_rel = (string) wp_parse_url( $upload_dir['baseurl'] ?? '', PHP_URL_PATH );
		$rel_path    = $path;

		if ( ! empty( $basedir_rel ) && str_starts_with( $path, $basedir_rel ) ) {
			$rel_path = ltrim( substr( $path, strlen( $basedir_rel ) ), '/' );
		} elseif ( str_contains( $path, '/uploads/' ) ) {
			$parts    = explode( '/uploads/', $path, 2 );
			$rel_path = $parts[1] ?? '';
		}

		if ( empty( $rel_path ) ) {
			return 0;
		}

		$clean_basename = basename( $rel_path );

		// 1. Direct query on _wp_attached_file.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$id = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT post_id FROM {$wpdb->postmeta}
				 WHERE meta_key = '_wp_attached_file' AND meta_value = %s
				 ORDER BY post_id DESC LIMIT 1",
				$rel_path
			)
		);
		if ( $id > 0 ) {
			return $id;
		}

		// 2. Match by filename in _wp_attached_file.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$id = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT post_id FROM {$wpdb->postmeta}
				 WHERE meta_key = '_wp_attached_file' AND meta_value LIKE %s
				 ORDER BY post_id DESC LIMIT 1",
				'%' . $wpdb->esc_like( $clean_basename )
			)
		);
		if ( $id > 0 ) {
			return $id;
		}

		// 3. Match by guid in wp_posts.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$id = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts}
				 WHERE post_type = 'attachment' AND guid LIKE %s
				 ORDER BY ID DESC LIMIT 1",
				'%' . $wpdb->esc_like( $clean_basename )
			)
		);

		return $id > 0 ? $id : 0;
	}

	/**
	 * Intercepts incoming requests to protected document paths on 'init'.
	 *
	 * When a direct link is requested (e.g. /wp-content/uploads/codeclove/documents/...),
	 * verifies authorization and blocks unauthenticated or unauthorized access.
	 */
	public static function intercept_document_requests(): void {
		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$uri = (string) wp_unslash( $_SERVER['REQUEST_URI'] ?? '' );
		if ( empty( $uri ) ) {
			return;
		}

		$path = (string) wp_parse_url( $uri, PHP_URL_PATH );
		if ( empty( $path ) || ! str_contains( $path, '/codeclove/documents/' ) ) {
			return;
		}

		$attachment_id = self::resolve_attachment_id( $path );
		if ( ! $attachment_id || ! self::is_protected_document( $attachment_id ) ) {
			return;
		}

		// Cookie authenticate user if not set yet on early init.
		$user_id = get_current_user_id();
		if ( ! $user_id && function_exists( 'wp_validate_auth_cookie' ) ) {
			$cookie_uid = (int) wp_validate_auth_cookie( '', 'logged_in' );
			if ( $cookie_uid > 0 ) {
				wp_set_current_user( $cookie_uid );
				$user_id = $cookie_uid;
			}
		}

		// Enforce authorization.
		if ( ! self::can_user_access( $user_id, $attachment_id ) ) {
			status_header( $user_id > 0 ? 403 : 401 );
			nocache_headers();
			wp_die(
				esc_html__( 'You do not have permission to view this document.', 'codeclove-school-management' ),
				esc_html__( 'Access Denied', 'codeclove-school-management' ),
				[ 'response' => $user_id > 0 ? 403 : 401 ]
			);
		}

		$download = isset( $_GET['download'] ) && filter_var( wp_unslash( $_GET['download'] ), FILTER_VALIDATE_BOOLEAN );
		// User is authorized! Stream the file.
		self::stream( $attachment_id, $download );
		exit;
	}
}
