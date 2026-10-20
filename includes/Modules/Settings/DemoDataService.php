<?php
/**
 * Demo Data Service.
 *
 * Populates realistic sample school records (academic sessions, terms, classes,
 * sections, subjects, staff members with photos, students with photos, fee types,
 * invoices, payments, attendance history, admissions applications,
 * noticeboard announcements, and school branding) so that new installations
 * present an engaging, fully operational school out of the box.
 *
 * @package CodeClove\Modules\Settings
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Settings;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Database\Schema;
use CodeClove\Database\Transaction;
use Throwable;

/**
 * Class DemoDataService
 */
final class DemoDataService {

	/**
	 * Lock transient name to prevent concurrent seeding.
	 */
	public const LOCK_TRANSIENT = 'codeclove_demo_seeding_lock';

	/**
	 * WordPress option storing whether demo data has been imported.
	 */
	public const OPTION_IMPORTED = 'codeclove_demo_data_imported';

	/**
	 * WordPress option storing IDs of created demo records for clean removal.
	 */
	public const OPTION_RECORD_IDS = 'codeclove_demo_data_ids';

	/**
	 * WordPress option storing whether demo data prompt was dismissed.
	 */
	public const OPTION_PROMPT_DISMISSED = 'codeclove_demo_prompt_dismissed';

	/**
	 * WordPress option backup of previous settings before demo data import.
	 */
	public const OPTION_PREV_SETTINGS = 'codeclove_demo_prev_settings';

	/**
	 * WordPress post meta key used to identify demo media attachments.
	 */
	public const DEMO_META_KEY = '_codeclove_demo_asset';

	/**
	 * Dismisses the demo data onboarding prompt.
	 *
	 * @return bool
	 */
	public function dismiss_prompt(): bool {
		update_option( self::OPTION_PROMPT_DISMISSED, 1, false );

		return true;
	}

	/**
	 * Imports realistic demo data into the school database.
	 *
	 * @param string $country Preset country code ('IN', 'US', 'GB').
	 * @return array{success: bool, message: string}
	 */
	public function import( string $country = 'IN' ): array {
		// 1. Prevent concurrent runs via transient lock.
		if ( get_transient( self::LOCK_TRANSIENT ) ) {
			return [
				'success' => false,
				'message' => __( 'Demo data import is already in progress.', 'codeclove-school-management' ),
			];
		}

		set_transient( self::LOCK_TRANSIENT, 1, 120 );

		try {
			// Clear any previous demo data first to ensure an idempotent run.
			$this->clear();

			// Pre-resolve or upload demo media attachments.
			$media_data = $this->prepare_demo_media();

			// Execute database population inside a transaction.
			Transaction::run(
				function () use ( $country, $media_data ): array {
					return $this->seed_demo_records( $country, $media_data );
				}
			);

			update_option( self::OPTION_IMPORTED, 1, false );

			return [
				'success' => true,
				'message' => __( 'Demo data imported successfully.', 'codeclove-school-management' ),
			];
		} catch ( Throwable $e ) {
			return [
				'success' => false,
				'message' => sprintf(
					/* translators: %s: Error message */
					__( 'Failed to import demo data: %s', 'codeclove-school-management' ),
					$e->getMessage()
				),
			];
		} finally {
			delete_transient( self::LOCK_TRANSIENT );
		}
	}

	/**
	 * Clears demo records from the database, removes media attachments, and cleans options.
	 *
	 * @return array{success: bool, message: string}
	 */
	public function clear(): array {
		global $wpdb;

		try {
			$ids = get_option( self::OPTION_RECORD_IDS, [] );
			if ( ! is_array( $ids ) ) {
				$ids = [];
			}

			// Delete child records before parent records.
			$this->delete_by_ids( Schema::payments(), $ids['payment_ids'] ?? [] );
			$this->delete_by_ids( Schema::line_items(), $ids['line_item_ids'] ?? [] );
			$this->delete_by_ids( Schema::invoices(), $ids['invoice_ids'] ?? [] );
			$this->delete_by_ids( Schema::fee_type_class_rates(), $ids['fee_type_class_rate_ids'] ?? [] );
			$this->delete_by_ids( Schema::attendance(), $ids['attendance_ids'] ?? [] );
			$this->delete_by_ids( Schema::staff_attendance(), $ids['staff_attendance_ids'] ?? [] );
			$this->delete_by_ids( Schema::staff_app_notes(), $ids['staff_app_note_ids'] ?? [] );
			$this->delete_by_ids( Schema::staff_app_docs(), $ids['staff_app_doc_ids'] ?? [] );
			$this->delete_by_ids( Schema::staff_app_events(), $ids['staff_app_event_ids'] ?? [] );
			$this->delete_by_ids( Schema::staff_apps(), $ids['staff_app_ids'] ?? [] );
			$this->delete_by_ids( Schema::app_notes(), $ids['app_note_ids'] ?? [] );
			$this->delete_by_ids( Schema::app_documents(), $ids['app_doc_ids'] ?? [] );
			$this->delete_by_ids( Schema::app_events(), $ids['app_event_ids'] ?? [] );
			$this->delete_by_ids( Schema::applications(), $ids['application_ids'] ?? [] );
			$this->delete_by_ids( Schema::activity_logs(), $ids['audit_log_ids'] ?? [] );
			$this->delete_by_ids( Schema::student_guardians(), $ids['student_guardian_ids'] ?? [] );
			$this->delete_by_ids( Schema::student_subjects(), $ids['student_subject_ids'] ?? [] );
			$this->delete_by_ids( Schema::enrollments(), $ids['enrollment_ids'] ?? [] );
			$this->delete_by_ids( Schema::guardians(), $ids['guardian_ids'] ?? [] );
			$this->delete_by_ids( Schema::students(), $ids['student_ids'] ?? [] );
			$this->delete_by_ids( Schema::staff_members(), $ids['staff_ids'] ?? [] );
			$this->delete_by_ids( Schema::unit_subjects(), $ids['unit_subject_ids'] ?? [] );
			$this->delete_by_ids( Schema::groups(), $ids['group_ids'] ?? [] );
			$this->delete_by_ids( Schema::units(), $ids['unit_ids'] ?? [] );
			$this->delete_by_ids( Schema::terms(), $ids['term_ids'] ?? [] );
			$this->delete_by_ids( Schema::sessions(), $ids['session_ids'] ?? [] );
			$this->delete_by_ids( Schema::fee_types(), $ids['fee_type_ids'] ?? [] );
			$this->delete_by_ids( Schema::notifications(), $ids['notification_ids'] ?? [] );
			// Clean demo media attachments.
			$attachment_ids = array_filter( array_map( 'intval', $ids['attachment_ids'] ?? [] ) );
			// Also find any lingering demo attachments via meta.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$lingering_meta_ids = $wpdb->get_col(
				$wpdb->prepare( "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s", self::DEMO_META_KEY )
			);
			if ( ! empty( $lingering_meta_ids ) ) {
				$attachment_ids = array_merge( $attachment_ids, array_map( 'intval', $lingering_meta_ids ) );
			}
			$attachment_ids = array_unique( $attachment_ids );

			if ( ! empty( $attachment_ids ) ) {
				if ( ! function_exists( 'wp_delete_attachment' ) ) {
					require_once ABSPATH . 'wp-admin/includes/image.php';
					require_once ABSPATH . 'wp-admin/includes/file.php';
					require_once ABSPATH . 'wp-admin/includes/media.php';
				}
				foreach ( $attachment_ids as $att_id ) {
					wp_delete_attachment( $att_id, true );
				}
			}

			// Clean fallback prefix queries in case records were created outside tracked IDs or via test suites.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE code LIKE %s', Schema::sessions(), 'DEMO-%' ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE code LIKE %s', Schema::units(), 'DEMO-%' ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE code LIKE %s', Schema::subjects(), 'DEMO-%' ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE code LIKE %s', Schema::fee_types(), 'DEMO-%' ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE staff_number LIKE %s', Schema::staff_members(), 'DEMO-%' ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE admission_number LIKE %s', Schema::students(), 'DEMO-%' ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE invoice_number LIKE %s', Schema::invoices(), 'DEMO-%' ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE payment_number LIKE %s', Schema::payments(), 'DEMO-%' ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE reference_number LIKE %s', Schema::applications(), 'DEMO-%' ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE reference_number LIKE %s', Schema::staff_apps(), 'DEMO-%' ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE title LIKE %s OR content LIKE %s', Schema::notifications(), '%CodeClove (Demo)%', '%(Demo)%' ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE actor_label LIKE %s', Schema::activity_logs(), '%(Demo)%' ) );
			// Restore previous settings if backed up.
			$prev_settings = get_option( self::OPTION_PREV_SETTINGS, null );
			if ( is_array( $prev_settings ) ) {
				( new SettingsRepository() )->update_settings( $prev_settings );
			}

			delete_option( self::OPTION_IMPORTED );
			delete_option( self::OPTION_RECORD_IDS );
			delete_option( self::OPTION_PROMPT_DISMISSED );
			delete_option( self::OPTION_PREV_SETTINGS );

			return [
				'success' => true,
				'message' => __( 'Demo data cleared successfully.', 'codeclove-school-management' ),
			];
		} catch ( Throwable $e ) {
			return [
				'success' => false,
				'message' => sprintf(
					/* translators: %s: Error message */
					__( 'Failed to clear demo data: %s', 'codeclove-school-management' ),
					$e->getMessage()
				),
			];
		}
	}

	/**
	 * Returns current status of demo data.
	 *
	 * @return array{
	 *     imported: bool,
	 *     prompt_dismissed: bool,
	 *     student_count: int,
	 *     session_count: int,
	 *     should_show_prompt: bool,
	 *     has_demo_data: bool
	 * }
	 */
	public function status(): array {
		global $wpdb;

		$imported         = (bool) get_option( self::OPTION_IMPORTED, false );
		$prompt_dismissed = (bool) get_option( self::OPTION_PROMPT_DISMISSED, false );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$student_count = (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT COUNT(*) FROM %i WHERE deleted_at IS NULL', Schema::students() )
		);

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$session_count = (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT COUNT(*) FROM %i', Schema::sessions() )
		);

		$should_show_prompt = ( ! $imported && ! $prompt_dismissed && 0 === $student_count && 0 === $session_count );

		return [
			'imported'           => $imported,
			'prompt_dismissed'   => $prompt_dismissed,
			'student_count'      => $student_count,
			'session_count'      => $session_count,
			'should_show_prompt' => $should_show_prompt,
			'has_demo_data'      => $imported,
		];
	}

	/**
	 * Pre-resolves or registers demo media files as WordPress attachments.
	 *
	 * @return array{
	 *     student_photo_ids: int[],
	 *     staff_photo_ids: int[],
	 *     logo_id: int|null,
	 *     logo_url: string,
	 *     attachment_ids: int[]
	 * }
	 */
	private function prepare_demo_media(): array {
		$plugin_dir = defined( 'CODECLOVE_DIR' ) ? CODECLOVE_DIR : plugin_dir_path( dirname( __DIR__, 2 ) . '/codeclove-school-management.php' );
		$plugin_url = defined( 'CODECLOVE_URL' ) ? CODECLOVE_URL : plugin_dir_url( dirname( __DIR__, 2 ) . '/codeclove-school-management.php' );

		$created_ids       = [];
		$student_photo_ids = [];
		$staff_photo_ids   = [];

		// 1. Student photos (10 files)
		for ( $i = 1; $i <= 10; $i++ ) {
			$file = $plugin_dir . "assets/demo/students/student_{$i}.jpg";
			$att_id = $this->resolve_demo_attachment( $file, 'students', "Demo Student Photo {$i}", 'image/jpeg' );
			if ( $att_id ) {
				$student_photo_ids[ $i - 1 ] = $att_id;
				$created_ids[]               = $att_id;
			}
		}

		// 2. Staff photos (8 files)
		for ( $i = 1; $i <= 8; $i++ ) {
			$file = $plugin_dir . "assets/demo/staff/staff_{$i}.jpg";
			$att_id = $this->resolve_demo_attachment( $file, 'staff', "Demo Staff Photo {$i}", 'image/jpeg' );
			if ( $att_id ) {
				$staff_photo_ids[ $i - 1 ] = $att_id;
				$created_ids[]             = $att_id;
			}
		}

		// 3. School Logo
		$logo_file = $plugin_dir . 'assets/demo/school-logo.png';
		$logo_id   = $this->resolve_demo_attachment( $logo_file, 'logo', 'Demo School Logo', 'image/png' );
		if ( $logo_id ) {
			$created_ids[] = $logo_id;
			$logo_url      = wp_get_attachment_url( $logo_id ) ?: ( $plugin_url . 'assets/demo/school-logo.png' );
		} else {
			$logo_url = $plugin_url . 'assets/demo/school-logo.png';
		}

		return [
			'student_photo_ids' => $student_photo_ids,
			'staff_photo_ids'   => $staff_photo_ids,
			'logo_id'           => $logo_id,
			'logo_url'          => $logo_url,
			'attachment_ids'    => array_values( array_unique( $created_ids ) ),
		];
	}

	/**
	 * Resolves or uploads a demo media file as a WordPress attachment.
	 *
	 * @param string $source_path Absolute path to the source image file.
	 * @param string $category    Subcategory string ('students', 'staff', 'logo').
	 * @param string $title       Attachment title.
	 * @param string $mime_type   MIME type ('image/jpeg', 'image/png').
	 * @return int|null WordPress attachment ID or null on failure.
	 */
	private function resolve_demo_attachment( string $source_path, string $category, string $title, string $mime_type = 'image/jpeg' ): ?int {
		global $wpdb;

		if ( ! file_exists( $source_path ) ) {
			return null;
		}

		$filename = basename( $source_path );
		$meta_val = "demo_{$category}_{$filename}";

		// Check if already created and valid.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$existing_id = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value = %s LIMIT 1",
				self::DEMO_META_KEY,
				$meta_val
			)
		);

		if ( $existing_id > 0 && get_post( $existing_id ) ) {
			return $existing_id;
		}

		$contents = file_get_contents( $source_path );
		if ( false === $contents ) {
			return null;
		}

		if ( ! function_exists( 'wp_upload_bits' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}
		if ( ! function_exists( 'wp_insert_attachment' ) ) {
			require_once ABSPATH . 'wp-admin/includes/image.php';
			require_once ABSPATH . 'wp-admin/includes/media.php';
		}

		$upload = wp_upload_bits( "codeclove_demo_{$category}_{$filename}", null, $contents );
		if ( ! empty( $upload['error'] ) || empty( $upload['file'] ) ) {
			return null;
		}

		$attachment = [
			'post_mime_type' => $mime_type,
			'post_title'     => $title,
			'post_content'   => '',
			'post_status'    => 'inherit',
			'guid'           => $upload['url'],
		];

		$attach_id = wp_insert_attachment( $attachment, $upload['file'] );
		if ( is_wp_error( $attach_id ) || ! ( $attach_id > 0 ) ) {
			return null;
		}

		if ( function_exists( 'wp_generate_attachment_metadata' ) ) {
			$attach_data = wp_generate_attachment_metadata( (int) $attach_id, $upload['file'] );
			wp_update_attachment_metadata( (int) $attach_id, $attach_data );
		}

		update_post_meta( (int) $attach_id, self::DEMO_META_KEY, $meta_val );

		return (int) $attach_id;
	}

	/**
	 * Generates realistic, fully populated school sample records.
	 *
	 * @param string $country    Country preset input ('IN', 'US', 'GB').
	 * @param array  $media_data Pre-resolved media attachments map.
	 * @return array Created IDs map.
	 */
	private function seed_demo_records( string $country, array $media_data = [] ): array {
		global $wpdb;

		$now       = current_time( 'mysql' );
		$today     = current_time( 'Y-m-d' );
		$cur_year  = (int) gmdate( 'Y' );
		$next_year = $cur_year + 1;

		// Detect country preset and currency.
		$settings_repo = new SettingsRepository();
		$settings      = $settings_repo->get_settings();
		$country_code  = strtoupper( trim( $country ) );
		if ( ! in_array( $country_code, [ 'IN', 'US', 'GB' ], true ) ) {
			$setting_preset = strtoupper( (string) ( $settings['education_system']['preset'] ?? '' ) );
			if ( in_array( $setting_preset, [ 'IN', 'US', 'GB' ], true ) ) {
				$country_code = $setting_preset;
			} else {
				$currency_setting = strtoupper( (string) ( $settings['localization']['currency'] ?? 'INR' ) );
				if ( 'INR' === $currency_setting ) {
					$country_code = 'IN';
				} elseif ( 'GBP' === $currency_setting ) {
					$country_code = 'GB';
				} elseif ( 'USD' === $currency_setting ) {
					$country_code = 'US';
				} else {
					$country_code = 'IN';
				}
			}
		}

		$currency = match ( $country_code ) {
			'GB'    => 'GBP',
			'US'    => 'USD',
			default => 'INR',
		};

		$tracked_ids = [
			'session_ids'              => [],
			'term_ids'                 => [],
			'unit_ids'                 => [],
			'group_ids'                => [],
			'subject_ids'              => [],
			'unit_subject_ids'         => [],
			'staff_ids'                => [],
			'staff_app_ids'            => [],
			'staff_app_event_ids'      => [],
			'staff_app_doc_ids'        => [],
			'staff_app_note_ids'       => [],
			'student_ids'              => [],
			'guardian_ids'             => [],
			'student_guardian_ids'     => [],
			'enrollment_ids'           => [],
			'student_subject_ids'      => [],
			'fee_type_ids'             => [],
			'fee_type_class_rate_ids'  => [],
			'invoice_ids'              => [],
			'line_item_ids'            => [],
			'payment_ids'              => [],
			'attendance_ids'           => [],
			'staff_attendance_ids'     => [],
			'application_ids'          => [],
			'app_event_ids'            => [],
			'app_doc_ids'              => [],
			'app_note_ids'             => [],
			'audit_log_ids'            => [],
			'notification_ids'         => [],
			'attachment_ids'           => $media_data['attachment_ids'] ?? [],
		];
		// ── 0. School Settings & Logo Update ──────────────────────────────────
		if ( ! get_option( self::OPTION_PREV_SETTINGS ) ) {
			update_option( self::OPTION_PREV_SETTINGS, $settings, false );
		}

		$demo_school_info = match ( $country_code ) {
			'GB' => [
				'name'    => "St. Jude's International Grammar School",
				'code'    => 'SJG-2026',
				'email'   => 'admissions@stjudesgrammar.edu.uk',
				'phone'   => '+44 20 7946 0192',
				'website' => 'https://stjudesgrammar.edu.uk',
				'address' => '24 St. Jude\'s Way, Westminster, London, SW1P 3PB',
			],
			'US' => [
				'name'    => 'Oakridge International Preparatory Academy',
				'code'    => 'OAK-2026',
				'email'   => 'admissions@oakridgeprep.org',
				'phone'   => '+1 (555) 234-5678',
				'website' => 'https://oakridgeprep.org',
				'address' => '740 Academy Parkway, Springfield, OR 97477',
			],
			default => [
				'name'    => 'Greenwood International Academy',
				'code'    => 'GIA-2026',
				'email'   => 'admissions@greenwoodacademy.edu.in',
				'phone'   => '+91 22 2876 5432',
				'website' => 'https://greenwoodacademy.edu.in',
				'address' => 'Plot 42, Knowledge Park, Bandra Kurla Complex, Mumbai, Maharashtra 400051',
			],
		};

		$updated_settings                   = $settings;
		$updated_settings['school']['name'] = $demo_school_info['name'];
		$updated_settings['school']['code'] = $demo_school_info['code'];
		if ( ! empty( $media_data['logo_url'] ) ) {
			$updated_settings['school']['logo'] = $media_data['logo_url'];
		}
		$updated_settings['school']['email']   = $demo_school_info['email'];
		$updated_settings['school']['phone']   = $demo_school_info['phone'];
		$updated_settings['school']['website'] = $demo_school_info['website'];
		$updated_settings['school']['address'] = $demo_school_info['address'];
		$settings_repo->update_settings( $updated_settings );

		// ── 1. Academic Session & Terms ────────────────────────────────────────
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->insert(
			Schema::sessions(),
			[
				'name'       => "{$cur_year}-{$next_year}",
				'code'       => "DEMO-{$cur_year}-" . substr( (string) $next_year, -2 ),
				'starts_on'  => gmdate( 'Y-01-01' ),
				'ends_on'    => gmdate( 'Y-12-31', strtotime( '+1 year' ) ),
				'status'     => 'active',
				'is_current' => 1,
				'created_at' => $now,
				'updated_at' => $now,
			]
		);
		$session_id                   = (int) $wpdb->insert_id;
		$tracked_ids['session_ids'][] = $session_id;

		// Term 1 (Active)
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->insert(
			Schema::terms(),
			[
				'academic_session_id' => $session_id,
				'name'                => 'Term 1',
				'code'                => 'DEMO-T1',
				'starts_on'           => gmdate( 'Y-m-d', strtotime( '-2 months' ) ),
				'ends_on'             => gmdate( 'Y-m-d', strtotime( '+4 months' ) ),
				'sort_order'          => 1,
				'status'              => 'active',
				'created_at'          => $now,
				'updated_at'          => $now,
			]
		);
		$term_id                   = (int) $wpdb->insert_id;
		$tracked_ids['term_ids'][] = $term_id;

		// Term 2 (Upcoming)
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->insert(
			Schema::terms(),
			[
				'academic_session_id' => $session_id,
				'name'                => 'Term 2',
				'code'                => 'DEMO-T2',
				'starts_on'           => gmdate( 'Y-m-d', strtotime( '+4 months +1 day' ) ),
				'ends_on'             => gmdate( 'Y-m-d', strtotime( '+10 months' ) ),
				'sort_order'          => 2,
				'status'              => 'inactive',
				'created_at'          => $now,
				'updated_at'          => $now,
			]
		);
		$tracked_ids['term_ids'][] = (int) $wpdb->insert_id;

		// ── 2. Academic Units & Sections ───────────────────────────────────────
		$unit_labels = match ( $country_code ) {
			'GB'    => [ 'Year 1', 'Year 2', 'Year 3' ],
			'US'    => [ 'Grade 1', 'Grade 2', 'Grade 3' ],
			default => [ 'Class 1', 'Class 2', 'Class 3' ],
		};

		$unit_ids  = [];
		$group_ids = [];

		foreach ( $unit_labels as $idx => $unit_name ) {
			$level = $idx + 1;
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::units(),
				[
					'academic_session_id' => $session_id,
					'name'                => $unit_name,
					'code'                => "DEMO-U{$level}",
					'level_order'         => $level,
					'status'              => 'active',
					'created_at'          => $now,
					'updated_at'          => $now,
				]
			);
			$u_id                   = (int) $wpdb->insert_id;
			$unit_ids[]             = $u_id;
			$tracked_ids['unit_ids'][] = $u_id;

			// Add sections (Section A & Section B)
			foreach ( [ 'Section A', 'Section B' ] as $sec_name ) {
				$sec_code = 'A' === substr( $sec_name, -1 ) ? 'A' : 'B';
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->insert(
					Schema::groups(),
					[
						'academic_unit_id' => $u_id,
						'name'             => $sec_name,
						'code'             => "DEMO-G{$level}-{$sec_code}",
						'capacity'         => 35,
						'status'           => 'active',
						'created_at'       => $now,
						'updated_at'       => $now,
					]
				);
				$g_id                        = (int) $wpdb->insert_id;
				$group_ids[ $u_id ][]        = $g_id;
				$tracked_ids['group_ids'][]  = $g_id;
			}
		}

		// ── 3. Core Subjects ───────────────────────────────────────────────────
		$subjects = [
			[ 'name' => 'Mathematics',    'code' => 'DEMO-MATH', 'type' => 'core' ],
			[ 'name' => 'Science',        'code' => 'DEMO-SCI',  'type' => 'core' ],
			[ 'name' => 'English',        'code' => 'DEMO-ENG',  'type' => 'core' ],
			[ 'name' => 'Social Studies', 'code' => 'DEMO-SOC',  'type' => 'core' ],
		];

		$subject_ids = [];
		foreach ( $subjects as $sub ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::subjects(),
				[
					'name'       => $sub['name'],
					'code'       => $sub['code'],
					'type'       => $sub['type'],
					'status'     => 'active',
					'created_at' => $now,
					'updated_at' => $now,
				]
			);
			$s_id                      = (int) $wpdb->insert_id;
			$subject_ids[]             = $s_id;
			$tracked_ids['subject_ids'][] = $s_id;

			// Link to each academic unit
			foreach ( $unit_ids as $u_id ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->insert(
					Schema::unit_subjects(),
					[
						'academic_unit_id' => $u_id,
						'subject_id'       => $s_id,
						'is_required'      => 1,
						'sort_order'       => count( $subject_ids ),
						'created_at'       => $now,
					]
				);
				$tracked_ids['unit_subject_ids'][] = (int) $wpdb->insert_id;
			}
		}

		// ── 4. Staff Members (8 Staff matching 8 Profile Photos) ───────────────
		$staff_data = match ( $country_code ) {
			'GB' => [
				[
					'first'   => 'Claire',
					'last'    => 'Higgins',
					'title'   => 'Ms.',
					'email'   => 'claire.higgins@example.com',
					'phone'   => '+44 7911 123401',
					'role'    => 'Teacher',
					'desig'   => 'Senior Academic Teacher',
					'dept'    => 'Academics',
					'num'     => 'DEMO-STF-101',
					'cat'     => 'teaching',
					'quals'   => [ [ 'degree' => 'PGCE Primary Education', 'institution' => 'University of Cambridge', 'year' => 2017 ] ],
					'address' => [ 'street' => '14 Kensington High St', 'city' => 'London', 'state' => 'Greater London', 'zip' => 'W8 4PT', 'country' => 'GB' ],
				],
				[
					'first'   => 'Philip',
					'last'    => 'Hughes',
					'title'   => 'Dr.',
					'email'   => 'philip.hughes@example.com',
					'phone'   => '+44 7911 123402',
					'role'    => 'Admin',
					'desig'   => 'Head of School & Principal',
					'dept'    => 'Administration',
					'num'     => 'DEMO-STF-102',
					'cat'     => 'administrative',
					'quals'   => [ [ 'degree' => 'Ph.D. Educational Leadership', 'institution' => 'University of Oxford', 'year' => 2012 ] ],
					'address' => [ 'street' => '22 College Road', 'city' => 'London', 'state' => 'Greater London', 'zip' => 'SE21 7HN', 'country' => 'GB' ],
				],
				[
					'first'   => 'Rachel',
					'last'    => 'Bennett',
					'title'   => 'Mrs.',
					'email'   => 'rachel.bennett@example.com',
					'phone'   => '+44 7911 123403',
					'role'    => 'Accountant',
					'desig'   => 'Bursar & Finance Director',
					'dept'    => 'Finance',
					'num'     => 'DEMO-STF-103',
					'cat'     => 'administrative',
					'quals'   => [ [ 'degree' => 'ACA Chartered Accountant', 'institution' => 'ICAEW', 'year' => 2014 ] ],
					'address' => [ 'street' => '8 Victoria Street', 'city' => 'London', 'state' => 'Greater London', 'zip' => 'SW1H 0EX', 'country' => 'GB' ],
				],
				[
					'first'   => 'James',
					'last'    => 'Watson',
					'title'   => 'Mr.',
					'email'   => 'james.watson@example.com',
					'phone'   => '+44 7911 123404',
					'role'    => 'Teacher',
					'desig'   => 'Head of Science Department',
					'dept'    => 'Academics',
					'num'     => 'DEMO-STF-104',
					'cat'     => 'teaching',
					'quals'   => [ [ 'degree' => 'M.Sc. Physics', 'institution' => 'Imperial College London', 'year' => 2016 ] ],
					'address' => [ 'street' => '33 Queen Street', 'city' => 'London', 'state' => 'Greater London', 'zip' => 'EC4R 1AP', 'country' => 'GB' ],
				],
				[
					'first'   => 'Fiona',
					'last'    => 'Clark',
					'title'   => 'Mrs.',
					'email'   => 'fiona.clark@example.com',
					'phone'   => '+44 7911 123405',
					'role'    => 'Teacher',
					'desig'   => 'English Language Faculty',
					'dept'    => 'Academics',
					'num'     => 'DEMO-STF-105',
					'cat'     => 'teaching',
					'quals'   => [ [ 'degree' => 'M.A. English Literature', 'institution' => 'University of Edinburgh', 'year' => 2018 ] ],
					'address' => [ 'street' => '19 Baker Street', 'city' => 'London', 'state' => 'Greater London', 'zip' => 'W1U 8ED', 'country' => 'GB' ],
				],
				[
					'first'   => 'Alistair',
					'last'    => 'Campbell',
					'title'   => 'Mr.',
					'email'   => 'alistair.campbell@example.com',
					'phone'   => '+44 7911 123406',
					'role'    => 'Admin',
					'desig'   => 'Operations & Facilities Registrar',
					'dept'    => 'Administration',
					'num'     => 'DEMO-STF-106',
					'cat'     => 'administrative',
					'quals'   => [ [ 'degree' => 'B.A. Business Administration', 'institution' => "King's College London", 'year' => 2015 ] ],
					'address' => [ 'street' => '45 Millbank', 'city' => 'London', 'state' => 'Greater London', 'zip' => 'SW1P 4RS', 'country' => 'GB' ],
				],
				[
					'first'   => 'Eleanor',
					'last'    => 'Davies',
					'title'   => 'Ms.',
					'email'   => 'eleanor.davies@example.com',
					'phone'   => '+44 7911 123407',
					'role'    => 'Teacher',
					'desig'   => 'Student Wellbeing Counselor',
					'dept'    => 'Student Welfare',
					'num'     => 'DEMO-STF-107',
					'cat'     => 'administrative',
					'quals'   => [ [ 'degree' => 'M.Sc. Child Psychology', 'institution' => 'UCL', 'year' => 2019 ] ],
					'address' => [ 'street' => '12 Richmond Road', 'city' => 'London', 'state' => 'Greater London', 'zip' => 'TW1 3EE', 'country' => 'GB' ],
				],
				[
					'first'   => 'Harry',
					'last'    => 'Edwards',
					'title'   => 'Mr.',
					'email'   => 'harry.edwards@example.com',
					'phone'   => '+44 7911 123408',
					'role'    => 'Teacher',
					'desig'   => 'Athletics & PE Director',
					'dept'    => 'Athletics',
					'num'     => 'DEMO-STF-108',
					'cat'     => 'teaching',
					'quals'   => [ [ 'degree' => 'B.Sc. Sports Science', 'institution' => 'Loughborough University', 'year' => 2016 ] ],
					'address' => [ 'street' => '50 Wimbledon Hill Rd', 'city' => 'London', 'state' => 'Greater London', 'zip' => 'SW19 7PA', 'country' => 'GB' ],
				],
			],
			'US' => [
				[
					'first'   => 'Sarah',
					'last'    => 'Jenkins',
					'title'   => 'Ms.',
					'email'   => 'sarah.jenkins@example.com',
					'phone'   => '+1 555-014-1001',
					'role'    => 'Teacher',
					'desig'   => 'Senior Academic Teacher',
					'dept'    => 'Academics',
					'num'     => 'DEMO-STF-101',
					'cat'     => 'teaching',
					'quals'   => [ [ 'degree' => 'M.Ed. Curriculum & Instruction', 'institution' => 'Stanford University', 'year' => 2016 ] ],
					'address' => [ 'street' => '742 Evergreen Terrace', 'city' => 'Springfield', 'state' => 'OR', 'zip' => '97477', 'country' => 'US' ],
				],
				[
					'first'   => 'Mark',
					'last'    => 'Anderson',
					'title'   => 'Dr.',
					'email'   => 'mark.anderson@example.com',
					'phone'   => '+1 555-014-1002',
					'role'    => 'Admin',
					'desig'   => 'Head of School & Principal',
					'dept'    => 'Administration',
					'num'     => 'DEMO-STF-102',
					'cat'     => 'administrative',
					'quals'   => [ [ 'degree' => 'Ed.D. Educational Administration', 'institution' => 'Harvard University', 'year' => 2011 ] ],
					'address' => [ 'street' => '120 Oakridge Blvd', 'city' => 'Springfield', 'state' => 'OR', 'zip' => '97477', 'country' => 'US' ],
				],
				[
					'first'   => 'Emily',
					'last'    => 'Davis',
					'title'   => 'Mrs.',
					'email'   => 'emily.davis@example.com',
					'phone'   => '+1 555-014-1003',
					'role'    => 'Accountant',
					'desig'   => 'Chief Financial Officer',
					'dept'    => 'Finance',
					'num'     => 'DEMO-STF-103',
					'cat'     => 'administrative',
					'quals'   => [ [ 'degree' => 'B.S. Accounting & CPA', 'institution' => 'UC Berkeley', 'year' => 2013 ] ],
					'address' => [ 'street' => '305 Pine Street', 'city' => 'Springfield', 'state' => 'OR', 'zip' => '97477', 'country' => 'US' ],
				],
				[
					'first'   => 'David',
					'last'    => 'Miller',
					'title'   => 'Mr.',
					'email'   => 'david.miller@example.com',
					'phone'   => '+1 555-014-1004',
					'role'    => 'Teacher',
					'desig'   => 'STEM & Science Coordinator',
					'dept'    => 'Academics',
					'num'     => 'DEMO-STF-104',
					'cat'     => 'teaching',
					'quals'   => [ [ 'degree' => 'M.S. Applied Physics', 'institution' => 'MIT', 'year' => 2015 ] ],
					'address' => [ 'street' => '510 Elm Avenue', 'city' => 'Springfield', 'state' => 'OR', 'zip' => '97477', 'country' => 'US' ],
				],
				[
					'first'   => 'Jessica',
					'last'    => 'Taylor',
					'title'   => 'Mrs.',
					'email'   => 'jessica.taylor@example.com',
					'phone'   => '+1 555-014-1005',
					'role'    => 'Teacher',
					'desig'   => 'Language Arts Specialist',
					'dept'    => 'Academics',
					'num'     => 'DEMO-STF-105',
					'cat'     => 'teaching',
					'quals'   => [ [ 'degree' => 'M.A. English Education', 'institution' => 'Columbia University', 'year' => 2017 ] ],
					'address' => [ 'street' => '820 Maple Court', 'city' => 'Springfield', 'state' => 'OR', 'zip' => '97477', 'country' => 'US' ],
				],
				[
					'first'   => 'Robert',
					'last'    => 'Brown',
					'title'   => 'Mr.',
					'email'   => 'robert.brown@example.com',
					'phone'   => '+1 555-014-1006',
					'role'    => 'Admin',
					'desig'   => 'Campus Operations Registrar',
					'dept'    => 'Administration',
					'num'     => 'DEMO-STF-106',
					'cat'     => 'administrative',
					'quals'   => [ [ 'degree' => 'B.S. Operations Management', 'institution' => 'University of Oregon', 'year' => 2014 ] ],
					'address' => [ 'street' => '440 Cedar Way', 'city' => 'Springfield', 'state' => 'OR', 'zip' => '97477', 'country' => 'US' ],
				],
				[
					'first'   => 'Amanda',
					'last'    => 'White',
					'title'   => 'Ms.',
					'email'   => 'amanda.white@example.com',
					'phone'   => '+1 555-014-1007',
					'role'    => 'Teacher',
					'desig'   => 'Student Guidance Counselor',
					'dept'    => 'Student Welfare',
					'num'     => 'DEMO-STF-107',
					'cat'     => 'administrative',
					'quals'   => [ [ 'degree' => 'M.S. Counseling Psychology', 'institution' => 'NYU', 'year' => 2018 ] ],
					'address' => [ 'street' => '915 Birch Lane', 'city' => 'Springfield', 'state' => 'OR', 'zip' => '97477', 'country' => 'US' ],
				],
				[
					'first'   => 'Michael',
					'last'    => 'Evans',
					'title'   => 'Coach',
					'email'   => 'michael.evans@example.com',
					'phone'   => '+1 555-014-1008',
					'role'    => 'Teacher',
					'desig'   => 'Athletics & PE Director',
					'dept'    => 'Athletics',
					'num'     => 'DEMO-STF-108',
					'cat'     => 'teaching',
					'quals'   => [ [ 'degree' => 'B.S. Kinesiology', 'institution' => 'Penn State', 'year' => 2015 ] ],
					'address' => [ 'street' => '625 Willow Drive', 'city' => 'Springfield', 'state' => 'OR', 'zip' => '97477', 'country' => 'US' ],
				],
			],
			default => [ // IN
				[
					'first'   => 'Sunita',
					'last'    => 'Rao',
					'title'   => 'Mrs.',
					'email'   => 'sunita.rao@example.com',
					'phone'   => '+91 98765 43211',
					'role'    => 'Teacher',
					'desig'   => 'Senior Academic Teacher',
					'dept'    => 'Academics',
					'num'     => 'DEMO-STF-101',
					'cat'     => 'teaching',
					'quals'   => [ [ 'degree' => 'M.Sc. Mathematics, B.Ed.', 'institution' => 'Delhi University', 'year' => 2015 ] ],
					'address' => [ 'street' => 'Flat 402, Sea Green Apts, Worli', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'zip' => '400018', 'country' => 'IN' ],
				],
				[
					'first'   => 'Ramesh',
					'last'    => 'Nair',
					'title'   => 'Dr.',
					'email'   => 'ramesh.nair@example.com',
					'phone'   => '+91 98765 43212',
					'role'    => 'Admin',
					'desig'   => 'Head of School & Principal',
					'dept'    => 'Administration',
					'num'     => 'DEMO-STF-102',
					'cat'     => 'administrative',
					'quals'   => [ [ 'degree' => 'Ph.D. Education Administration', 'institution' => 'TISS Mumbai', 'year' => 2010 ] ],
					'address' => [ 'street' => 'B-12, Palm Grove Enclave, Bandra West', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'zip' => '400050', 'country' => 'IN' ],
				],
				[
					'first'   => 'Kavita',
					'last'    => 'Mehta',
					'title'   => 'Ms.',
					'email'   => 'kavita.mehta@example.com',
					'phone'   => '+91 98765 43213',
					'role'    => 'Accountant',
					'desig'   => 'Chief Accountant & Bursar',
					'dept'    => 'Finance',
					'num'     => 'DEMO-STF-103',
					'cat'     => 'administrative',
					'quals'   => [ [ 'degree' => 'FCA, Chartered Accountant', 'institution' => 'ICAI', 'year' => 2013 ] ],
					'address' => [ 'street' => 'A-701, Silver Arch, Powai', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'zip' => '400076', 'country' => 'IN' ],
				],
				[
					'first'   => 'Vikram',
					'last'    => 'Joshi',
					'title'   => 'Mr.',
					'email'   => 'vikram.joshi@example.com',
					'phone'   => '+91 98765 43214',
					'role'    => 'Teacher',
					'desig'   => 'Head of Science Department',
					'dept'    => 'Academics',
					'num'     => 'DEMO-STF-104',
					'cat'     => 'teaching',
					'quals'   => [ [ 'degree' => 'M.Sc. Physics, B.Ed.', 'institution' => 'IIT Bombay', 'year' => 2016 ] ],
					'address' => [ 'street' => '104, Blue Heaven Towers, Andheri East', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'zip' => '400069', 'country' => 'IN' ],
				],
				[
					'first'   => 'Ananya',
					'last'    => 'Sen',
					'title'   => 'Mrs.',
					'email'   => 'ananya.sen@example.com',
					'phone'   => '+91 98765 43215',
					'role'    => 'Teacher',
					'desig'   => 'English Language Faculty',
					'dept'    => 'Academics',
					'num'     => 'DEMO-STF-105',
					'cat'     => 'teaching',
					'quals'   => [ [ 'degree' => 'M.A. English Literature', 'institution' => 'Jadavpur University', 'year' => 2017 ] ],
					'address' => [ 'street' => '503, Gulmohar Heights, Juhu', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'zip' => '400049', 'country' => 'IN' ],
				],
				[
					'first'   => 'Rajesh',
					'last'    => 'Verma',
					'title'   => 'Mr.',
					'email'   => 'rajesh.verma@example.com',
					'phone'   => '+91 98765 43216',
					'role'    => 'Admin',
					'desig'   => 'Operations & Facilities Registrar',
					'dept'    => 'Administration',
					'num'     => 'DEMO-STF-106',
					'cat'     => 'administrative',
					'quals'   => [ [ 'degree' => 'MBA Operations', 'institution' => 'NMIMS Mumbai', 'year' => 2014 ] ],
					'address' => [ 'street' => 'C-204, Green Acres, Thane West', 'city' => 'Thane', 'state' => 'Maharashtra', 'zip' => '400601', 'country' => 'IN' ],
				],
				[
					'first'   => 'Priya',
					'last'    => 'Sharma',
					'title'   => 'Ms.',
					'email'   => 'priya.sharma@example.com',
					'phone'   => '+91 98765 43217',
					'role'    => 'Teacher',
					'desig'   => 'Student Guidance Counselor',
					'dept'    => 'Student Welfare',
					'num'     => 'DEMO-STF-107',
					'cat'     => 'administrative',
					'quals'   => [ [ 'degree' => 'M.A. Applied Psychology', 'institution' => 'Mumbai University', 'year' => 2019 ] ],
					'address' => [ 'street' => '201, Sunshine Villa, Khar West', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'zip' => '400052', 'country' => 'IN' ],
				],
				[
					'first'   => 'Arjun',
					'last'    => 'Kapoor',
					'title'   => 'Mr.',
					'email'   => 'arjun.kapoor@example.com',
					'phone'   => '+91 98765 43218',
					'role'    => 'Teacher',
					'desig'   => 'Director of Sports & Physical Education',
					'dept'    => 'Athletics',
					'num'     => 'DEMO-STF-108',
					'cat'     => 'teaching',
					'quals'   => [ [ 'degree' => 'M.P.Ed. Physical Education', 'institution' => 'LNIPE Gwalior', 'year' => 2015 ] ],
					'address' => [ 'street' => '304, Sports City Enclave, Chembur', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'zip' => '400071', 'country' => 'IN' ],
				],
			],
		};

		$role_records  = $wpdb->get_results( 'SELECT id, slug FROM ' . Schema::roles(), ARRAY_A );
		$role_slug_map = array_change_key_case( array_column( $role_records ?: [], 'id', 'slug' ), CASE_LOWER );

		$staff_middle_pool = match ( $country_code ) {
			'GB'    => [ 'Elizabeth', 'James', 'Anne', 'Arthur', 'Victoria', 'William', 'Grace', 'Edward' ],
			'US'    => [ 'Marie', 'Lee', 'Lynn', 'Ray', 'Ann', 'Thomas', 'Grace', 'Allen' ],
			default => [ 'Devi', 'Kumar', 'Prakash', 'Chandra', 'Kumari', 'Lal', 'Rani', 'Mohan' ],
		};

		$staff_ids = [];
		foreach ( $staff_data as $s_idx => $stf ) {
			$photo_id = $media_data['staff_photo_ids'][ $s_idx ] ?? null;
			$gender   = in_array( $stf['title'], [ 'Mrs.', 'Ms.' ], true ) ? 'female' : 'male';
			$r_slug   = match ( $stf['role'] ) {
				'Teacher'    => 'teacher',
				'Admin'      => 'administrator',
				'Accountant' => 'accountant',
				default      => 'readonly_staff',
			};
			$r_id     = $role_slug_map[ $r_slug ] ?? null;

			$address_obj = array_merge(
				[ 'address' => $stf['address']['street'] . ', ' . $stf['address']['city'] . ', ' . $stf['address']['state'] . ' ' . ( $stf['address']['zip'] ?? '' ) ],
				$stf['address'],
				[ 'postal_code' => $stf['address']['zip'] ?? '' ]
			);

			$metadata = match ( $country_code ) {
				'IN' => wp_json_encode( [
					'pan_card_number'    => 'ABCDE' . sprintf( '%04d', 2000 + $s_idx ) . 'F',
					'aadhaar_last4'      => sprintf( '%04d', 3000 + $s_idx ),
					'uan_number'         => '100' . sprintf( '%09d', 91000000 + $s_idx ),
					'ctet_qualified'     => ( $s_idx % 2 === 0 ),
					'b_ed_registration'  => 'BED/MH/2017/' . sprintf( '%03d', $s_idx + 1 ),
					'employee_pf_number' => 'MH/MUM/0012345/000/' . sprintf( '%04d', $s_idx + 1 ),
					'blood_group'        => [ 'O+', 'A+', 'B+', 'AB+', 'O-' ][ $s_idx % 5 ],
				] ),
				'GB' => wp_json_encode( [
					'trn'                       => sprintf( '%07d', 7900000 + $s_idx ),
					'qts_status'                => 'Qualified',
					'dbs_certificate_number'    => '001' . sprintf( '%09d', 460000000 + $s_idx ),
					'dbs_issue_date'            => gmdate( 'Y-m-d', strtotime( '-2 years' ) ),
					'dbs_update_service'        => true,
					'national_insurance_number' => 'QQ' . sprintf( '%06d', 230000 + $s_idx ) . 'C',
					'post_scale'                => 'MPS ' . ( ( $s_idx % 6 ) + 1 ),
				] ),
				default => wp_json_encode( [
					'state_educator_id' => 'ED-' . sprintf( '%06d', 990000 + $s_idx ),
					'license_number'    => 'LIC-' . sprintf( '%05d', 49000 + $s_idx ),
					'license_expiry'    => gmdate( 'Y-m-d', strtotime( '+3 years' ) ),
					'fte'               => '1.0',
					'contract_term'     => '10_month',
					'ssn_last4'         => sprintf( '%04d', 5000 + $s_idx ),
					'highly_qualified'  => true,
				] ),
			};

			$documents = wp_json_encode( [
				[
					'label'         => 'Government ID Proof',
					'attachment_id' => $photo_id ?: ( 500 + $s_idx ),
					'url'           => 'https://example.com/docs/government-id.pdf',
				],
				[
					'label'         => 'Certified Degree & License',
					'attachment_id' => $photo_id ?: ( 600 + $s_idx ),
					'url'           => 'https://example.com/docs/degree-certificate.pdf',
				],
			] );

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::staff_members(),
				[
					'staff_number'            => $stf['num'],
					'role_id'                 => $r_id,
					'title'                   => $stf['title'],
					'first_name'              => $stf['first'],
					'middle_name'             => $staff_middle_pool[ $s_idx % count( $staff_middle_pool ) ],
					'last_name'               => $stf['last'],
					'preferred_name'          => $stf['first'],
					'date_of_birth'           => gmdate( 'Y-m-d', strtotime( '-32 years -' . ( $s_idx * 150 ) . ' days' ) ),
					'gender'                  => $gender,
					'email'                   => $stf['email'],
					'phone'                   => $stf['phone'],
					'department'              => $stf['dept'],
					'designation'             => $stf['desig'],
					'staff_category'          => $stf['cat'],
					'employment_type'         => 'full_time',
					'joined_on'               => gmdate( 'Y-m-d', strtotime( '-' . ( 6 + $s_idx * 2 ) . ' months' ) ),
					'photo_id'                => $photo_id,
					'address_json'            => wp_json_encode( $address_obj ),
					'qualifications_json'     => wp_json_encode( $stf['quals'] ),
					'emergency_contact_json'  => wp_json_encode( [
						'name'         => $stf['first'] . ' Emergency Contact',
						'relationship' => 'Spouse',
						'phone'        => $stf['phone'],
						'alt_phone'    => $stf['phone'],
					] ),
					'metadata_json'           => $metadata,
					'documents_json'          => $documents,
					'status'                  => 'active',
					'created_at'              => $now,
					'updated_at'              => $now,
				]
			);
			$st_id                      = (int) $wpdb->insert_id;
			$staff_ids[]                = $st_id;
			$tracked_ids['staff_ids'][] = $st_id;
		}

		// ── 5. Staff Attendance (Past 5 School Days) ───────────────────────────
		$staff_days = [];
		$ts_cursor  = time();
		while ( count( $staff_days ) < 5 ) {
			$dow = (int) gmdate( 'N', $ts_cursor );
			if ( $dow <= 5 ) {
				$staff_days[] = gmdate( 'Y-m-d', $ts_cursor );
			}
			$ts_cursor -= 86400;
		}

		foreach ( $staff_ids as $s_idx => $st_id ) {
			foreach ( $staff_days as $d_idx => $day_str ) {
				$st_status = 'present';
				$st_note   = null;
				if ( 0 === $d_idx && 3 === $s_idx ) {
					$st_status = 'late';
					$st_note   = 'Morning traffic delay on highway.';
				} elseif ( 2 === $d_idx && 6 === $s_idx ) {
					$st_status = 'half_day';
					$st_note   = 'Attended district counselor conference in afternoon.';
				}

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->insert(
					Schema::staff_attendance(),
					[
						'staff_member_id' => $st_id,
						'attendance_date' => $day_str,
						'status'          => $st_status,
						'note'            => $st_note,
						'created_at'      => $now,
						'updated_at'      => $now,
					]
				);
				$tracked_ids['staff_attendance_ids'][] = (int) $wpdb->insert_id;
			}
		}
		// ── 5b. Staff Applications (6 Demo Applications in Different Workflow Stages) ────
		$staff_apps_data = match ( $country_code ) {
			'GB' => [
				[ 'first' => 'Charlotte', 'last' => 'Davies',   'gender' => 'female', 'dob' => '1992-04-18', 'email' => 'charlotte.davies@example.com',   'phone' => '+44 7911 200101', 'role' => 'Science Faculty Teacher',          'dept' => 'Academics',      'status' => 'submitted' ],
				[ 'first' => 'Oliver',    'last' => 'Evans',    'gender' => 'male',   'dob' => '1989-11-25', 'email' => 'oliver.evans@example.com',      'phone' => '+44 7911 200102', 'role' => 'Assistant Head of Primary',        'dept' => 'Administration', 'status' => 'under_review' ],
				[ 'first' => 'Amelia',    'last' => 'Wilson',   'gender' => 'female', 'dob' => '1994-08-12', 'email' => 'amelia.wilson@example.com',     'phone' => '+44 7911 200103', 'role' => 'Primary English Educator',         'dept' => 'Academics',      'status' => 'interview_scheduled' ],
				[ 'first' => 'Thomas',    'last' => 'Taylor',   'gender' => 'male',   'dob' => '1991-03-30', 'email' => 'thomas.taylor@example.com',     'phone' => '+44 7911 200104', 'role' => 'School Bursar & Finance Officer',  'dept' => 'Finance',        'status' => 'offer_sent' ],
				[ 'first' => 'Claire',    'last' => 'Higgins',  'gender' => 'female', 'dob' => '1988-06-22', 'email' => 'claire.higgins@example.com',    'phone' => '+44 7911 200105', 'role' => 'Senior Academic Teacher',          'dept' => 'Academics',      'status' => 'accepted', 'conv_id' => $staff_ids[0] ?? null ],
				[ 'first' => 'George',    'last' => 'Roberts',  'gender' => 'male',   'dob' => '1995-12-05', 'email' => 'george.roberts@example.com',    'phone' => '+44 7911 200106', 'role' => 'Physical Education & Games Coach', 'dept' => 'Athletics',      'status' => 'rejected' ],
			],
			'US' => [
				[ 'first' => 'Emily',     'last' => 'Davis',    'gender' => 'female', 'dob' => '1992-04-18', 'email' => 'emily.davis@example.com',       'phone' => '+1 555-014-2001', 'role' => 'Science Faculty Teacher',          'dept' => 'Academics',      'status' => 'submitted' ],
				[ 'first' => 'Daniel',    'last' => 'Miller',   'gender' => 'male',   'dob' => '1989-11-25', 'email' => 'daniel.miller@example.com',     'phone' => '+1 555-014-2002', 'role' => 'Assistant Principal',              'dept' => 'Administration', 'status' => 'under_review' ],
				[ 'first' => 'Olivia',    'last' => 'Wilson',   'gender' => 'female', 'dob' => '1994-08-12', 'email' => 'olivia.wilson@example.com',     'phone' => '+1 555-014-2003', 'role' => 'Elementary English Specialist',    'dept' => 'Academics',      'status' => 'interview_scheduled' ],
				[ 'first' => 'James',     'last' => 'Anderson', 'gender' => 'male',   'dob' => '1991-03-30', 'email' => 'james.anderson@example.com',    'phone' => '+1 555-014-2004', 'role' => 'Campus Finance Coordinator',        'dept' => 'Finance',        'status' => 'offer_sent' ],
				[ 'first' => 'Sarah',     'last' => 'Jenkins',  'gender' => 'female', 'dob' => '1988-06-22', 'email' => 'sarah.jenkins@example.com',     'phone' => '+1 555-014-2005', 'role' => 'Senior Academic Teacher',          'dept' => 'Academics',      'status' => 'accepted', 'conv_id' => $staff_ids[0] ?? null ],
				[ 'first' => 'Brian',     'last' => 'Taylor',   'gender' => 'male',   'dob' => '1995-12-05', 'email' => 'brian.taylor@example.com',      'phone' => '+1 555-014-2006', 'role' => 'Athletics & PE Coach',            'dept' => 'Athletics',      'status' => 'rejected' ],
			],
			default => [ // IN
				[ 'first' => 'Kavita',    'last' => 'Mehta',    'gender' => 'female', 'dob' => '1992-04-18', 'email' => 'kavita.mehta@example.com',      'phone' => '+91 98765 22001', 'role' => 'Senior Secondary Science Faculty', 'dept' => 'Academics',      'status' => 'submitted' ],
				[ 'first' => 'Vikram',    'last' => 'Deshmukh', 'gender' => 'male',   'dob' => '1989-11-25', 'email' => 'vikram.deshmukh@example.com',  'phone' => '+91 98765 22002', 'role' => 'Vice Principal (Academics)',       'dept' => 'Administration', 'status' => 'under_review' ],
				[ 'first' => 'Pooja',     'last' => 'Chopra',   'gender' => 'female', 'dob' => '1994-08-12', 'email' => 'pooja.chopra@example.com',      'phone' => '+91 98765 22003', 'role' => 'Primary English Faculty',           'dept' => 'Academics',      'status' => 'interview_scheduled' ],
				[ 'first' => 'Siddharth', 'last' => 'Jain',     'gender' => 'male',   'dob' => '1991-03-30', 'email' => 'siddharth.jain@example.com',   'phone' => '+91 98765 22004', 'role' => 'Senior Bursar & Accounts Officer',  'dept' => 'Finance',        'status' => 'offer_sent' ],
				[ 'first' => 'Sunita',    'last' => 'Rao',      'gender' => 'female', 'dob' => '1988-06-22', 'email' => 'sunita.rao@example.com',       'phone' => '+91 98765 22005', 'role' => 'Senior Academic Teacher',          'dept' => 'Academics',      'status' => 'accepted', 'conv_id' => $staff_ids[0] ?? null ],
				[ 'first' => 'Manish',    'last' => 'Pandey',   'gender' => 'male',   'dob' => '1995-12-05', 'email' => 'manish.pandey@example.com',    'phone' => '+91 98765 22006', 'role' => 'Physical Education & Games Coach', 'dept' => 'Athletics',      'status' => 'rejected' ],
			],
		};

		foreach ( $staff_apps_data as $sa_idx => $sa ) {
			$sa_seq     = sprintf( '%03d', $sa_idx + 1 );
			$sa_ref     = "DEMO-STF-APP-{$sa_seq}";
			$sub_date   = gmdate( 'Y-m-d H:i:s', strtotime( '-' . ( 22 - $sa_idx * 3 ) . ' days' ) );
			$rev_date   = in_array( $sa['status'], [ 'under_review', 'interview_scheduled', 'offer_sent', 'accepted', 'rejected' ], true ) ? gmdate( 'Y-m-d H:i:s', strtotime( '-' . ( 12 - $sa_idx * 2 ) . ' days' ) ) : null;
			$dec_date   = in_array( $sa['status'], [ 'accepted', 'rejected' ], true ) ? gmdate( 'Y-m-d H:i:s', strtotime( '-2 days' ) ) : null;

			$sa_address = match ( $country_code ) {
				'GB'    => [ 'address' => ( $sa_idx + 10 ) . ' Gloucester Road, London SW7 4RB', 'street' => ( $sa_idx + 10 ) . ' Gloucester Road', 'city' => 'London', 'state' => 'Greater London', 'postal_code' => 'SW7 4RB', 'country' => 'GB' ],
				'US'    => [ 'address' => ( $sa_idx + 200 ) . ' Oregon Way, Springfield OR 97477', 'street' => ( $sa_idx + 200 ) . ' Oregon Way', 'city' => 'Springfield', 'state' => 'OR', 'postal_code' => '97477', 'country' => 'US' ],
				default => [ 'address' => 'Flat ' . ( $sa_idx + 301 ) . ', Sea View Apts, Bandra West, Mumbai 400050', 'street' => 'Flat ' . ( $sa_idx + 301 ) . ', Sea View Apts', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'postal_code' => '400050', 'country' => 'IN' ],
			};

			$sa_exp = [
				[
					'title'        => 'Secondary Subject Faculty',
					'organization' => ( 'IN' === $country_code ) ? 'National Public High School' : ( ( 'GB' === $country_code ) ? 'Westminster Foundation Academy' : 'Lincoln Secondary School' ),
					'from_date'    => '2021-06-01',
					'to_date'      => '2024-05-31',
					'description'  => 'Designed curriculum lesson plans, organized STEM workshops, and led student extracurricular initiatives.',
				],
			];

			$sa_custom = [
				'notice_period'       => '30 days',
				'expected_salary'     => ( 'IN' === $country_code ) ? 'INR 60,000 / month' : ( ( 'GB' === $country_code ) ? 'GBP 36,000 / annum' : 'USD 52,000 / year' ),
				'teaching_philosophy' => 'Student-centered learning combining rigorous academic foundations with interactive technology.',
				'willing_to_relocate' => 'Yes',
				'certifications'      => 'Certified Subject Faculty, Digital Classroom Educator',
			];

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::staff_apps(),
				[
					'reference_number'          => $sa_ref,
					'status'                    => $sa['status'],
					'source'                    => ( $sa_idx % 2 === 0 ) ? 'public_form' : 'referral',
					'desired_role'              => $sa['role'],
					'department'                => $sa['dept'],
					'first_name'                => $sa['first'],
					'middle_name'               => $staff_middle_pool[ ( $sa_idx + 3 ) % count( $staff_middle_pool ) ],
					'last_name'                 => $sa['last'],
					'preferred_name'            => $sa['first'],
					'date_of_birth'             => $sa['dob'],
					'email'                     => $sa['email'],
					'phone'                     => $sa['phone'],
					'address_json'              => wp_json_encode( $sa_address ),
					'experience_json'           => wp_json_encode( $sa_exp ),
					'custom_fields_json'        => wp_json_encode( $sa_custom ),
					'submitted_at'              => $sub_date,
					'reviewed_at'               => $rev_date,
					'decision_at'               => $dec_date,
					'converted_staff_member_id' => $sa['conv_id'] ?? null,
					'created_at'                => $sub_date,
					'updated_at'                => $now,
				]
			);
			$sa_id                          = (int) $wpdb->insert_id;
			$tracked_ids['staff_app_ids'][] = $sa_id;

			// Staff app events
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::staff_app_events(),
				[
					'staff_application_id' => $sa_id,
					'from_status'          => null,
					'to_status'            => 'submitted',
					'reason'               => 'Application Submitted',
					'message'              => 'Candidate profile submitted for open faculty position.',
					'changed_at'           => $sub_date,
				]
			);
			$tracked_ids['staff_app_event_ids'][] = (int) $wpdb->insert_id;

			if ( in_array( $sa['status'], [ 'under_review', 'interview_scheduled', 'offer_sent', 'accepted', 'rejected' ], true ) ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->insert(
					Schema::staff_app_events(),
					[
						'staff_application_id' => $sa_id,
						'from_status'          => 'submitted',
						'to_status'            => 'under_review',
						'reason'               => 'Document Verification',
						'message'              => 'Credentials verified. Forwarded to academic search committee.',
						'changed_at'           => $rev_date ?: $sub_date,
					]
				);
				$tracked_ids['staff_app_event_ids'][] = (int) $wpdb->insert_id;
			}

			if ( in_array( $sa['status'], [ 'accepted', 'rejected' ], true ) ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->insert(
					Schema::staff_app_events(),
					[
						'staff_application_id' => $sa_id,
						'from_status'          => 'under_review',
						'to_status'            => $sa['status'],
						'reason'               => 'Committee Decision',
						'message'              => ( 'accepted' === $sa['status'] ) ? 'Candidate accepted position offer.' : 'Candidate not shortlisted for this cycle.',
						'changed_at'           => $dec_date ?: $now,
					]
				);
				$tracked_ids['staff_app_event_ids'][] = (int) $wpdb->insert_id;
			}

			// Staff app documents
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::staff_app_docs(),
				[
					'staff_application_id' => $sa_id,
					'document_type'        => 'resume',
					'label'                => 'Curriculum Vitae / Resume',
					'attachment_id'        => $media_data['staff_photo_ids'][ $sa_idx % count( $media_data['staff_photo_ids'] ?? [ 1 ] ) ] ?? 501,
					'status'               => 'uploaded',
					'required'             => 1,
					'uploaded_by_email'    => $sa['email'],
					'uploaded_at'          => $sub_date,
					'created_at'           => $now,
					'updated_at'           => $now,
				]
			);
			$tracked_ids['staff_app_doc_ids'][] = (int) $wpdb->insert_id;

			// Staff app notes
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::staff_app_notes(),
				[
					'staff_application_id' => $sa_id,
					'note_type'            => 'interview',
					'body'                 => 'Panel remarks: Candidate showed sound pedagogical knowledge and communicative clarity during interview.',
					'visibility'           => 'internal',
					'pinned'               => ( $sa_idx % 2 === 0 ) ? 1 : 0,
					'created_by'           => 1,
					'created_at'           => $sub_date,
					'updated_at'           => $now,
				]
			);
			$tracked_ids['staff_app_note_ids'][] = (int) $wpdb->insert_id;
		}

		// ── 6. Students & Guardians (10 Students matching 10 Profile Photos) ────
		$students_data = match ( $country_code ) {
			'GB' => [
				[ 'first' => 'George',  'last' => 'Taylor',    'gender' => 'male',   'dob' => '2018-05-14', 'g_first' => 'Richard',  'g_last' => 'Taylor',    'phone' => '+44 7700 900101', 'rel' => 'Father' ],
				[ 'first' => 'Olivia',  'last' => 'Wilson',    'gender' => 'female', 'dob' => '2018-08-22', 'g_first' => 'Sarah',    'g_last' => 'Wilson',    'phone' => '+44 7700 900102', 'rel' => 'Mother' ],
				[ 'first' => 'Harry',   'last' => 'Davies',    'gender' => 'male',   'dob' => '2017-03-10', 'g_first' => 'Edward',   'g_last' => 'Davies',    'phone' => '+44 7700 900103', 'rel' => 'Father' ],
				[ 'first' => 'Amelia',  'last' => 'Evans',     'gender' => 'female', 'dob' => '2017-11-05', 'g_first' => 'Emma',     'g_last' => 'Evans',     'phone' => '+44 7700 900104', 'rel' => 'Mother' ],
				[ 'first' => 'Jack',    'last' => 'Thomas',    'gender' => 'male',   'dob' => '2017-07-19', 'g_first' => 'Arthur',   'g_last' => 'Thomas',    'phone' => '+44 7700 900105', 'rel' => 'Father' ],
				[ 'first' => 'Isla',    'last' => 'Roberts',   'gender' => 'female', 'dob' => '2016-02-28', 'g_first' => 'Charlotte','g_last' => 'Roberts',   'phone' => '+44 7700 900106', 'rel' => 'Mother' ],
				[ 'first' => 'Charlie', 'last' => 'Walker',    'gender' => 'male',   'dob' => '2016-09-12', 'g_first' => 'John',     'g_last' => 'Walker',    'phone' => '+44 7700 900107', 'rel' => 'Father' ],
				[ 'first' => 'Mia',     'last' => 'Wright',    'gender' => 'female', 'dob' => '2016-12-01', 'g_first' => 'Victoria', 'g_last' => 'Wright',    'phone' => '+44 7700 900108', 'rel' => 'Mother' ],
				[ 'first' => 'Freddie', 'last' => 'Robinson',  'gender' => 'male',   'dob' => '2015-04-18', 'g_first' => 'Albert',   'g_last' => 'Robinson',  'phone' => '+44 7700 900109', 'rel' => 'Father' ],
				[ 'first' => 'Poppy',   'last' => 'Thompson',  'gender' => 'female', 'dob' => '2015-10-30', 'g_first' => 'Helen',    'g_last' => 'Thompson',  'phone' => '+44 7700 900110', 'rel' => 'Mother' ],
			],
			'US' => [
				[ 'first' => 'Liam',     'last' => 'Smith',     'gender' => 'male',   'dob' => '2018-05-14', 'g_first' => 'Robert',   'g_last' => 'Smith',     'phone' => '+1 555-019-2001', 'rel' => 'Father' ],
				[ 'first' => 'Emma',     'last' => 'Johnson',   'gender' => 'female', 'dob' => '2018-08-22', 'g_first' => 'Jennifer', 'g_last' => 'Johnson',   'phone' => '+1 555-019-2002', 'rel' => 'Mother' ],
				[ 'first' => 'Noah',     'last' => 'Williams',  'gender' => 'male',   'dob' => '2017-03-10', 'g_first' => 'Michael',  'g_last' => 'Williams',  'phone' => '+1 555-019-2003', 'rel' => 'Father' ],
				[ 'first' => 'Olivia',   'last' => 'Brown',     'gender' => 'female', 'dob' => '2017-11-05', 'g_first' => 'Jessica',  'g_last' => 'Brown',     'phone' => '+1 555-019-2004', 'rel' => 'Mother' ],
				[ 'first' => 'Oliver',   'last' => 'Jones',     'gender' => 'male',   'dob' => '2017-07-19', 'g_first' => 'William',  'g_last' => 'Jones',     'phone' => '+1 555-019-2005', 'rel' => 'Father' ],
				[ 'first' => 'Ava',      'last' => 'Garcia',    'gender' => 'female', 'dob' => '2016-02-28', 'g_first' => 'Maria',    'g_last' => 'Garcia',    'phone' => '+1 555-019-2006', 'rel' => 'Mother' ],
				[ 'first' => 'Elijah',   'last' => 'Miller',    'gender' => 'male',   'dob' => '2016-09-12', 'g_first' => 'Thomas',   'g_last' => 'Miller',    'phone' => '+1 555-019-2007', 'rel' => 'Father' ],
				[ 'first' => 'Sophia',   'last' => 'Davis',     'gender' => 'female', 'dob' => '2016-12-01', 'g_first' => 'Patricia', 'g_last' => 'Davis',     'phone' => '+1 555-019-2008', 'rel' => 'Mother' ],
				[ 'first' => 'Lucas',    'last' => 'Rodriguez', 'gender' => 'male',   'dob' => '2015-04-18', 'g_first' => 'Jose',     'g_last' => 'Rodriguez', 'phone' => '+1 555-019-2009', 'rel' => 'Father' ],
				[ 'first' => 'Isabella', 'last' => 'Martinez',  'gender' => 'female', 'dob' => '2015-10-30', 'g_first' => 'Carmen',   'g_last' => 'Martinez',  'phone' => '+1 555-019-2010', 'rel' => 'Mother' ],
			],
			default => [ // IN
				[ 'first' => 'Aarav',   'last' => 'Sharma',    'gender' => 'male',   'dob' => '2018-05-14', 'g_first' => 'Rajesh',   'g_last' => 'Sharma',    'phone' => '+91 91234 56701', 'rel' => 'Father' ],
				[ 'first' => 'Ananya',  'last' => 'Patel',     'gender' => 'female', 'dob' => '2018-08-22', 'g_first' => 'Geeta',    'g_last' => 'Patel',     'phone' => '+91 91234 56702', 'rel' => 'Mother' ],
				[ 'first' => 'Vivaan',  'last' => 'Gupta',     'gender' => 'male',   'dob' => '2017-03-10', 'g_first' => 'Amit',     'g_last' => 'Gupta',     'phone' => '+91 91234 56703', 'rel' => 'Father' ],
				[ 'first' => 'Diya',    'last' => 'Reddy',     'gender' => 'female', 'dob' => '2017-11-05', 'g_first' => 'Lakshmi',  'g_last' => 'Reddy',     'phone' => '+91 91234 56704', 'rel' => 'Mother' ],
				[ 'first' => 'Ishaan',  'last' => 'Kumar',     'gender' => 'male',   'dob' => '2017-07-19', 'g_first' => 'Manoj',    'g_last' => 'Kumar',     'phone' => '+91 91234 56705', 'rel' => 'Father' ],
				[ 'first' => 'Sanvi',   'last' => 'Verma',     'gender' => 'female', 'dob' => '2016-02-28', 'g_first' => 'Sunita',   'g_last' => 'Verma',     'phone' => '+91 91234 56706', 'rel' => 'Mother' ],
				[ 'first' => 'Reyansh', 'last' => 'Joshi',     'gender' => 'male',   'dob' => '2016-09-12', 'g_first' => 'Deepak',   'g_last' => 'Joshi',     'phone' => '+91 91234 56707', 'rel' => 'Father' ],
				[ 'first' => 'Myra',    'last' => 'Singh',     'gender' => 'female', 'dob' => '2016-12-01', 'g_first' => 'Jaspreet', 'g_last' => 'Singh',     'phone' => '+91 91234 56708', 'rel' => 'Mother' ],
				[ 'first' => 'Advait',  'last' => 'Nair',      'gender' => 'male',   'dob' => '2015-04-18', 'g_first' => 'Prakash',  'g_last' => 'Nair',      'phone' => '+91 91234 56709', 'rel' => 'Father' ],
				[ 'first' => 'Kiara',   'last' => 'Malhotra',  'gender' => 'female', 'dob' => '2015-10-30', 'g_first' => 'Pooja',    'g_last' => 'Malhotra',  'phone' => '+91 91234 56710', 'rel' => 'Mother' ],
			],
		};

		$enrolled_students = [];

		foreach ( $students_data as $i => $stu ) {
			$seq            = sprintf( '%03d', $i + 1 );
			$adm_number     = "DEMO-ADM-{$seq}";
			$stu_number     = "DEMO-STU-{$seq}";
			$guardian_email = strtolower( "{$stu['g_first']}.{$stu['g_last']}@example.com" );
			$guardian_name  = "{$stu['g_first']} {$stu['g_last']}";
			$photo_id       = $media_data['student_photo_ids'][ $i ] ?? null;

			$address_payload = match ( $country_code ) {
				'GB'    => [ 'address' => ( $i + 10 ) . ' Kingfisher Lane, London, Greater London SW1A 2AA', 'street' => ( $i + 10 ) . ' Kingfisher Lane', 'city' => 'London', 'state' => 'Greater London', 'zip' => 'SW1A 2AA', 'postal_code' => 'SW1A 2AA', 'country' => 'GB' ],
				'US'    => [ 'address' => ( $i + 100 ) . ' Maplewood Drive, Springfield, OR 97477', 'street' => ( $i + 100 ) . ' Maplewood Drive', 'city' => 'Springfield', 'state' => 'OR', 'zip' => '97477', 'postal_code' => '97477', 'country' => 'US' ],
				default => [ 'address' => 'Flat ' . ( $i + 101 ) . ', Gulmohar Enclave, Juhu, Mumbai, Maharashtra 400049', 'street' => 'Flat ' . ( $i + 101 ) . ', Gulmohar Enclave, Juhu', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'zip' => '400049', 'postal_code' => '400049', 'country' => 'IN' ],
			};

			$occupations_list = [
				'Senior Software Architect',
				'Pediatrician & Child Specialist',
				'Chartered Accountant & Financial Consultant',
				'Professor of Humanities',
				'Structural Civil Engineer',
				'Senior Corporate Marketing Director',
				'Senior Research Scientist',
				'Commercial Pilot',
				'High School Academic Principal',
				'Corporate Legal Counsel',
			];

			$stu_middle = $staff_middle_pool[ ( $i + 2 ) % count( $staff_middle_pool ) ];
			$g_middle   = $staff_middle_pool[ ( $i + 4 ) % count( $staff_middle_pool ) ];
			$g_alt_phone = match ( $country_code ) {
				'GB'    => '+44 7700 9' . sprintf( '%05d', 5000 + $i ),
				'US'    => '+1 555-019-' . sprintf( '%04d', 8000 + $i ),
				default => '+91 91234 ' . sprintf( '%05d', 8000 + $i ),
			};

			// Create guardian
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::guardians(),
				[
					'first_name'      => $stu['g_first'],
					'middle_name'     => $g_middle,
					'last_name'       => $stu['g_last'],
					'email'           => $guardian_email,
					'phone'           => $stu['phone'],
					'alternate_phone' => $g_alt_phone,
					'occupation'      => $occupations_list[ $i % count( $occupations_list ) ],
					'address_json'    => wp_json_encode( $address_payload ),
					'status'          => 'active',
					'created_at'      => $now,
					'updated_at'      => $now,
				]
			);
			$guardian_id                   = (int) $wpdb->insert_id;
			$tracked_ids['guardian_ids'][] = $guardian_id;

			// Create student
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::students(),
				[
					'student_number'   => $stu_number,
					'admission_number' => $adm_number,
					'first_name'       => $stu['first'],
					'middle_name'      => $stu_middle,
					'last_name'        => $stu['last'],
					'preferred_name'   => $stu['first'],
					'date_of_birth'    => $stu['dob'],
					'gender'           => $stu['gender'],
					'photo_id'         => $photo_id,
					'admission_date'   => gmdate( 'Y-m-d', strtotime( '-2 months' ) ),
					'graduation_year'  => ( $i >= 8 ? (int) gmdate( 'Y' ) : null ),
					'email'            => strtolower( "{$stu['first']}.{$stu['last']}@school.example.com" ),
					'phone'            => $stu['phone'],
					'address_json'     => wp_json_encode( $address_payload ),
					'status'           => 'active',
					'created_at'       => $now,
					'updated_at'       => $now,
				]
			);
			$student_id                   = (int) $wpdb->insert_id;
			$tracked_ids['student_ids'][] = $student_id;

			// Link primary guardian
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::student_guardians(),
				[
					'student_id'           => $student_id,
					'guardian_id'          => $guardian_id,
					'relationship'         => $stu['rel'],
					'is_primary'           => 1,
					'is_billing_contact'   => 1,
					'is_emergency_contact' => 1,
					'sort_order'           => 1,
					'created_at'           => $now,
					'updated_at'           => $now,
				]
			);
			$tracked_ids['student_guardian_ids'][] = (int) $wpdb->insert_id;

			// Link secondary guardian
			$sec_rel   = ( 'Father' === $stu['rel'] ) ? 'Mother' : 'Father';
			$sec_first = ( 'Mother' === $sec_rel ) ? ( [ 'Pooja', 'Sarah', 'Jennifer', 'Emma', 'Lakshmi', 'Sunita', 'Geeta', 'Charlotte', 'Victoria', 'Helen' ][ $i % 10 ] ) : ( [ 'Rajesh', 'David', 'Robert', 'Michael', 'Amit', 'Manoj', 'Deepak', 'John', 'Arthur', 'Albert' ][ $i % 10 ] );
			$sec_email = strtolower( "{$sec_first}.{$stu['g_last']}@example.com" );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::guardians(),
				[
					'first_name'      => $sec_first,
					'middle_name'     => $g_middle,
					'last_name'       => $stu['g_last'],
					'email'           => $sec_email,
					'phone'           => $g_alt_phone,
					'alternate_phone' => $stu['phone'],
					'occupation'      => $occupations_list[ ( $i + 3 ) % count( $occupations_list ) ],
					'address_json'    => wp_json_encode( $address_payload ),
					'status'          => 'active',
					'created_at'      => $now,
					'updated_at'      => $now,
				]
			);
			$sec_g_id                      = (int) $wpdb->insert_id;
			$tracked_ids['guardian_ids'][] = $sec_g_id;

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::student_guardians(),
				[
					'student_id'           => $student_id,
					'guardian_id'          => $sec_g_id,
					'relationship'         => $sec_rel,
					'is_primary'           => 0,
					'is_billing_contact'   => 0,
					'is_emergency_contact' => 1,
					'sort_order'           => 2,
					'created_at'           => $now,
					'updated_at'           => $now,
				]
			);
			$tracked_ids['student_guardian_ids'][] = (int) $wpdb->insert_id;

			// Enroll in one of the 3 units
			$assigned_unit_id  = $unit_ids[ $i % count( $unit_ids ) ];
			$assigned_groups   = $group_ids[ $assigned_unit_id ] ?? [];
			$assigned_group_id = ! empty( $assigned_groups ) ? $assigned_groups[ $i % count( $assigned_groups ) ] : null;

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::enrollments(),
				[
					'student_id'          => $student_id,
					'academic_session_id' => $session_id,
					'academic_unit_id'    => $assigned_unit_id,
					'academic_group_id'   => $assigned_group_id,
					'roll_number'         => (string) ( ( $i % 4 ) + 1 ),
					'starts_on'           => gmdate( 'Y-m-d', strtotime( '-2 months' ) ),
					'status'              => 'active',
					'created_at'          => $now,
					'updated_at'          => $now,
				]
			);
			$tracked_ids['enrollment_ids'][] = (int) $wpdb->insert_id;

			// Link student subjects
			foreach ( $subject_ids as $sub_id ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->insert(
					Schema::student_subjects(),
					[
						'student_id' => $student_id,
						'subject_id' => $sub_id,
						'created_at' => $now,
					]
				);
				$tracked_ids['student_subject_ids'][] = (int) $wpdb->insert_id;
			}

			$enrolled_students[] = [
				'student_id'     => $student_id,
				'unit_id'        => $assigned_unit_id,
				'group_id'       => $assigned_group_id,
				'guardian_name'  => $guardian_name,
				'guardian_email' => $guardian_email,
				'photo_id'       => $photo_id,
			];
		}

		// ── 7. Student Attendance Records ──────────────────────────────────────
		// 7a. Today's attendance (Exactly 8 Present, 2 Late to maintain test assertions)
		foreach ( $enrolled_students as $idx => $student ) {
			$status = $idx < 8 ? 'present' : 'late';
			$note   = 'late' === $status ? 'Delayed by morning transit' : 'On time';

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::attendance(),
				[
					'student_id'          => $student['student_id'],
					'academic_session_id' => $session_id,
					'academic_unit_id'    => $student['unit_id'],
					'academic_group_id'   => $student['group_id'],
					'attendance_date'     => $today,
					'status'              => $status,
					'note'                => $note,
					'created_at'          => $now,
					'updated_at'          => $now,
				]
			);
			$tracked_ids['attendance_ids'][] = (int) $wpdb->insert_id;
		}

		// 7b. Historical attendance over the past 10 school days for rich analytics
		$history_days = [];
		$hist_cursor  = time() - 86400; // Start from yesterday
		while ( count( $history_days ) < 10 ) {
			$dow = (int) gmdate( 'N', $hist_cursor );
			if ( $dow <= 5 ) {
				$history_days[] = gmdate( 'Y-m-d', $hist_cursor );
			}
			$hist_cursor -= 86400;
		}

		$status_pool = [ 'present', 'present', 'present', 'present', 'present', 'present', 'late', 'absent' ];
		foreach ( $enrolled_students as $s_idx => $student ) {
			foreach ( $history_days as $d_idx => $day_str ) {
				$pick_idx = ( $s_idx * 3 + $d_idx * 2 ) % count( $status_pool );
				$h_status = $status_pool[ $pick_idx ];
				$h_note   = match ( $h_status ) {
					'late'   => 'Traffic congestion on school bus route.',
					'absent' => 'Doctor appointment - medical certificate submitted.',
					default  => null,
				};

				// phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->insert(
					Schema::attendance(),
					[
						'student_id'          => $student['student_id'],
						'academic_session_id' => $session_id,
						'academic_unit_id'    => $student['unit_id'],
						'academic_group_id'   => $student['group_id'],
						'attendance_date'     => $day_str,
						'status'              => $h_status,
						'note'                => $h_note,
						'created_at'          => $now,
						'updated_at'          => $now,
					]
				);
				$tracked_ids['attendance_ids'][] = (int) $wpdb->insert_id;
			}
		}

		// ── 8. Admissions Applications (6 Applications in Various Stages) ──────
		$admissions_data = match ( $country_code ) {
			'GB' => [
				[ 'first' => 'Oliver',   'last' => 'Scott',     'gender' => 'male',   'dob' => '2019-03-12', 'g_name' => 'David Scott',    'email' => 'david.scott@example.com',    'status' => 'inquiry',       'photo_idx' => 0 ],
				[ 'first' => 'Freya',    'last' => 'Miller',    'gender' => 'female', 'dob' => '2018-11-20', 'g_name' => 'Claire Miller',  'email' => 'claire.miller@example.com',  'status' => 'submitted',     'photo_idx' => 1 ],
				[ 'first' => 'Leo',      'last' => 'Brown',     'gender' => 'male',   'dob' => '2018-07-04', 'g_name' => 'Simon Brown',    'email' => 'simon.brown@example.com',    'status' => 'under_review',  'photo_idx' => 2 ],
				[ 'first' => 'Florence', 'last' => 'Clark',     'gender' => 'female', 'dob' => '2017-09-18', 'g_name' => 'Laura Clark',    'email' => 'laura.clark@example.com',    'status' => 'under_review',  'photo_idx' => 3 ],
				[ 'first' => 'Arthur',   'last' => 'White',     'gender' => 'male',   'dob' => '2017-04-25', 'g_name' => 'Graham White',   'email' => 'graham.white@example.com',   'status' => 'approved',      'photo_idx' => 4 ],
				[ 'first' => 'Ivy',      'last' => 'Taylor',    'gender' => 'female', 'dob' => '2016-10-11', 'g_name' => 'Martin Taylor',  'email' => 'martin.taylor@example.com',  'status' => 'admitted',      'photo_idx' => 5 ],
			],
			'US' => [
				[ 'first' => 'Benjamin', 'last' => 'Wilson',    'gender' => 'male',   'dob' => '2019-03-12', 'g_name' => 'Brian Wilson',   'email' => 'brian.wilson@example.com',   'status' => 'inquiry',       'photo_idx' => 0 ],
				[ 'first' => 'Charlotte','last' => 'Harris',    'gender' => 'female', 'dob' => '2018-11-20', 'g_name' => 'Sarah Harris',   'email' => 'sarah.harris@example.com',   'status' => 'submitted',     'photo_idx' => 1 ],
				[ 'first' => 'Henry',    'last' => 'Clark',     'gender' => 'male',   'dob' => '2018-07-04', 'g_name' => 'Daniel Clark',   'email' => 'daniel.clark@example.com',   'status' => 'under_review',  'photo_idx' => 2 ],
				[ 'first' => 'Harper',   'last' => 'Lewis',     'gender' => 'female', 'dob' => '2017-09-18', 'g_name' => 'Kelly Lewis',    'email' => 'kelly.lewis@example.com',    'status' => 'under_review',  'photo_idx' => 3 ],
				[ 'first' => 'Alexander','last' => 'Walker',    'gender' => 'male',   'dob' => '2017-04-25', 'g_name' => 'Robert Walker',  'email' => 'robert.walker@example.com',  'status' => 'approved',      'photo_idx' => 4 ],
				[ 'first' => 'Evelyn',   'last' => 'Hall',      'gender' => 'female', 'dob' => '2016-10-11', 'g_name' => 'Steven Hall',    'email' => 'steven.hall@example.com',    'status' => 'admitted',      'photo_idx' => 5 ],
			],
			default => [ // IN
				[ 'first' => 'Vihaan',   'last' => 'Mehra',     'gender' => 'male',   'dob' => '2019-03-12', 'g_name' => 'Rohit Mehra',    'email' => 'rohit.mehra@example.com',    'status' => 'inquiry',       'photo_idx' => 0 ],
				[ 'first' => 'Riya',     'last' => 'Sengupta',  'gender' => 'female', 'dob' => '2018-11-20', 'g_name' => 'Ananya Sengupta', 'email' => 'ananya.sengupta@example.com', 'status' => 'submitted',     'photo_idx' => 1 ],
				[ 'first' => 'Neil',     'last' => 'Deshmukh',  'gender' => 'male',   'dob' => '2018-07-04', 'g_name' => 'Abhay Deshmukh',  'email' => 'abhay.deshmukh@example.com',  'status' => 'under_review',  'photo_idx' => 2 ],
				[ 'first' => 'Zara',     'last' => 'Khan',      'gender' => 'female', 'dob' => '2017-09-18', 'g_name' => 'Farhan Khan',    'email' => 'farhan.khan@example.com',    'status' => 'under_review',  'photo_idx' => 3 ],
				[ 'first' => 'Kabir',    'last' => 'Chawla',    'gender' => 'male',   'dob' => '2017-04-25', 'g_name' => 'Harish Chawla',  'email' => 'harish.chawla@example.com',  'status' => 'approved',      'photo_idx' => 4 ],
				[ 'first' => 'Tara',     'last' => 'Bose',      'gender' => 'female', 'dob' => '2016-10-11', 'g_name' => 'Debashis Bose',  'email' => 'debashis.bose@example.com',  'status' => 'admitted',      'photo_idx' => 5 ],
			],
		};

		foreach ( $admissions_data as $a_idx => $adm ) {
			$seq          = sprintf( '%03d', $a_idx + 1 );
			$ref_number   = "DEMO-APP-{$seq}";
			$assigned_u   = $unit_ids[ $a_idx % count( $unit_ids ) ];
			$app_photo_id = $media_data['student_photo_ids'][ $adm['photo_idx'] ] ?? null;

			$adm_phone = match ( $country_code ) {
				'GB'    => '+44 7911 3' . sprintf( '%05d', 1000 + $a_idx ),
				'US'    => '+1 555-018-' . sprintf( '%04d', 2000 + $a_idx ),
				default => '+91 98200 ' . sprintf( '%05d', 1000 + $a_idx ),
			};

			$adm_address = match ( $country_code ) {
				'GB'    => [ 'address' => ( $a_idx + 12 ) . ' Richmond Road, London, Greater London TW1 3EE', 'street' => ( $a_idx + 12 ) . ' Richmond Road', 'city' => 'London', 'state' => 'Greater London', 'postal_code' => 'TW1 3EE', 'country' => 'GB' ],
				'US'    => [ 'address' => ( $a_idx + 140 ) . ' Elm Avenue, Springfield, OR 97477', 'street' => ( $a_idx + 140 ) . ' Elm Avenue', 'city' => 'Springfield', 'state' => 'OR', 'postal_code' => '97477', 'country' => 'US' ],
				default => [ 'address' => 'Flat ' . ( $a_idx + 201 ) . ', Sea Green Apts, Worli, Mumbai, Maharashtra 400018', 'street' => 'Flat ' . ( $a_idx + 201 ) . ', Sea Green Apts', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'postal_code' => '400018', 'country' => 'IN' ],
			};

			$adm_custom = [
				'previous_school'         => ( 'IN' === $country_code ) ? 'St. Xavier Primary School' : ( ( 'GB' === $country_code ) ? 'St. Peter Grammar School' : 'West Valley Elementary' ),
				'previous_grade_marks'    => 'A (90%)',
				'second_language'         => ( 'IN' === $country_code ) ? 'Hindi' : ( ( 'GB' === $country_code ) ? 'French' : 'Spanish' ),
				'transport_required'      => ( $a_idx % 2 === 0 ) ? 'Yes - Route ' . ( $a_idx + 1 ) : 'No - Self Transport',
				'medical_conditions'      => ( 1 === $a_idx ) ? 'Mild Asthma (Carries inhaler)' : 'None / Fully healthy',
				'blood_group'             => [ 'O+', 'A+', 'B+', 'AB+', 'O-' ][ $a_idx % 5 ],
				'emergency_contact_name'  => $adm['g_name'] . ' (Parent)',
				'emergency_contact_phone' => $adm_phone,
			];

			$adm_is_walk_in   = ( $a_idx % 2 !== 0 );
			$adm_submitted_at = gmdate( 'Y-m-d H:i:s', strtotime( '-' . ( 20 - $a_idx * 2 ) . ' days' ) );
			$adm_reviewed_at  = in_array( $adm['status'], [ 'under_review', 'approved', 'admitted' ], true ) ? gmdate( 'Y-m-d H:i:s', strtotime( '-' . ( 12 - $a_idx * 2 ) . ' days' ) ) : null;
			$adm_decision_at  = in_array( $adm['status'], [ 'approved', 'admitted' ], true ) ? gmdate( 'Y-m-d H:i:s', strtotime( '-' . ( 4 - $a_idx * 2 ) . ' days' ) ) : null;
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::applications(),
				[
					'reference_number'       => $ref_number,
					'status'                 => $adm['status'],
					'source'                 => ( $a_idx % 2 === 0 ) ? 'online' : 'walk_in',
					'academic_session_id'    => $session_id,
					'academic_unit_id'       => $assigned_u,
					'academic_group_id'      => $group_ids[ $assigned_u ][0] ?? null,
					'student_first_name'     => $adm['first'],
					'student_middle_name'    => $staff_middle_pool[ ( $a_idx + 2 ) % count( $staff_middle_pool ) ],
					'student_last_name'      => $adm['last'],
					'student_preferred_name' => $adm['first'],
					'student_date_of_birth'  => $adm['dob'],
					'student_gender'         => $adm['gender'],
					'student_photo_id'       => $app_photo_id,
					'guardian_name'          => $adm['g_name'],
					'guardian_email'         => $adm['email'],
					'guardian_phone'         => $adm_phone,
					'address_json'           => wp_json_encode( $adm_address ),
					'custom_fields_json'     => wp_json_encode( $adm_custom ),
					'submitted_at'           => $adm_submitted_at,
					'reviewed_at'            => $adm_reviewed_at,
					'decision_at'            => $adm_decision_at,
					'converted_student_id'   => ( 'admitted' === $adm['status'] ) ? ( $enrolled_students[0]['student_id'] ?? null ) : null,
					'created_at'             => $now,
					'updated_at'             => $now,
				]
			);
			$app_id                         = (int) $wpdb->insert_id;
			$tracked_ids['application_ids'][] = $app_id;

			// Application status events
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::app_events(),
				[
					'application_id' => $app_id,
					'from_status'    => null,
					'to_status'      => 'submitted',
					'reason'         => $adm_is_walk_in ? 'Application Registered' : 'Application Form Received',
					'message'        => $adm_is_walk_in ? 'Walk-in application recorded at admissions desk.' : 'Application submitted with verified certificates.',
					'changed_by'     => $adm_is_walk_in ? ( get_current_user_id() ?: 1 ) : null,
					'changed_at'     => $adm_submitted_at,
				]
			);
			$tracked_ids['app_event_ids'][] = (int) $wpdb->insert_id;

			if ( in_array( $adm['status'], [ 'under_review', 'approved', 'admitted' ], true ) && $adm_reviewed_at ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->insert(
					Schema::app_events(),
					[
						'application_id' => $app_id,
						'from_status'    => 'submitted',
						'to_status'      => 'under_review',
						'reason'         => 'Document Verification',
						'message'        => 'Moving application to admissions review committee.',
						'changed_by'     => get_current_user_id() ?: 1,
						'changed_at'     => $adm_reviewed_at,
					]
				);
				$tracked_ids['app_event_ids'][] = (int) $wpdb->insert_id;
			}

			if ( in_array( $adm['status'], [ 'approved', 'admitted' ], true ) && $adm_decision_at ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->insert(
					Schema::app_events(),
					[
						'application_id' => $app_id,
						'from_status'    => 'under_review',
						'to_status'      => $adm['status'],
						'reason'         => 'Committee Approval',
						'message'        => 'Offer of admission granted for academic session.',
						'changed_by'     => get_current_user_id() ?: 1,
						'changed_at'     => $adm_decision_at,
					]
				);
				$tracked_ids['app_event_ids'][] = (int) $wpdb->insert_id;
			}

			// Admission documents
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::app_documents(),
				[
					'application_id'    => $app_id,
					'document_type'     => 'birth_certificate',
					'label'             => 'Official Birth Certificate',
					'attachment_id'     => $app_photo_id ?: 502,
					'status'            => 'verified',
					'required'          => 1,
					'review_note'       => 'Verified against municipal registrar records.',
					'uploaded_by_email' => $adm['email'],
					'uploaded_at'       => gmdate( 'Y-m-d H:i:s', strtotime( '-15 days' ) ),
					'created_at'        => $now,
					'updated_at'        => $now,
				]
			);
			$tracked_ids['app_doc_ids'][] = (int) $wpdb->insert_id;

			// Admission notes
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::app_notes(),
				[
					'application_id' => $app_id,
					'note_type'      => 'interview',
					'body'           => 'Interaction with applicant and parents went very well. High reading comprehension and numeracy demonstrated.',
					'visibility'     => 'internal',
					'pinned'         => ( $a_idx % 2 === 0 ) ? 1 : 0,
					'created_by'     => 1,
					'created_at'     => gmdate( 'Y-m-d H:i:s', strtotime( '-8 days' ) ),
					'updated_at'     => $now,
				]
			);
			$tracked_ids['app_note_ids'][] = (int) $wpdb->insert_id;
		}


		// ── 10. Fee Types ──────────────────────────────────────────────────────
		$fee_types = [
			[ 'name' => 'Tuition Fee',           'code' => 'DEMO-TUI', 'amount' => 500000, 'freq' => 'term' ],
			[ 'name' => 'Lab & Technology Fee',  'code' => 'DEMO-LAB', 'amount' => 150000, 'freq' => 'term' ],
			[ 'name' => 'Sports & Activity Fee', 'code' => 'DEMO-SPT', 'amount' => 100000, 'freq' => 'annual' ],
		];

		$fee_type_ids = [];
		foreach ( $fee_types as $ft ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::fee_types(),
				[
					'name'                 => $ft['name'],
					'code'                 => $ft['code'],
					'description'          => "Standard {$ft['name']} for regular curriculum.",
					'default_amount_minor' => $ft['amount'],
					'currency'             => $currency,
					'frequency'            => $ft['freq'],
					'scope'                => 'global',
					'status'               => 'active',
					'created_at'           => $now,
					'updated_at'           => $now,
				]
			);
			$ft_id                       = (int) $wpdb->insert_id;
			$fee_type_ids[]              = $ft_id;
			$tracked_ids['fee_type_ids'][] = $ft_id;
		}

		// 10b. Fee Type Class Rates
		foreach ( $fee_type_ids as $ft_id ) {
			foreach ( $unit_ids as $u_idx => $u_id ) {
				$class_rate = (int) round( 500000 * ( 1 + $u_idx * 0.15 ) );
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->insert(
					Schema::fee_type_class_rates(),
					[
						'fee_type_id'      => $ft_id,
						'academic_unit_id' => $u_id,
						'amount_minor'     => $class_rate,
						'currency'         => $currency,
						'created_at'       => $now,
						'updated_at'       => $now,
					]
				);
				$tracked_ids['fee_type_class_rate_ids'][] = (int) $wpdb->insert_id;
			}
		}
		// ── 11. Invoices & Payments (6 Invoices: 2 Paid, 2 Partial, 2 Overdue) ──
		$tuition_fee_id = $fee_type_ids[0];

		// Invoice 1: Paid (Student 0)
		$this->create_invoice_and_payment(
			$session_id,
			$term_id,
			$enrolled_students[0],
			$tuition_fee_id,
			'DEMO-INV-001',
			'DEMO-PAY-001',
			$currency,
			500000,
			'paid',
			gmdate( 'Y-m-d', strtotime( '-20 days' ) ),
			gmdate( 'Y-m-d', strtotime( '-5 days' ) ),
			500000,
			$tracked_ids
		);

		// Invoice 2: Paid (Student 1)
		$this->create_invoice_and_payment(
			$session_id,
			$term_id,
			$enrolled_students[1],
			$tuition_fee_id,
			'DEMO-INV-002',
			'DEMO-PAY-002',
			$currency,
			500000,
			'paid',
			gmdate( 'Y-m-d', strtotime( '-18 days' ) ),
			gmdate( 'Y-m-d', strtotime( '-5 days' ) ),
			500000,
			$tracked_ids
		);

		// Invoice 3: Partially Paid (Student 2)
		$this->create_invoice_and_payment(
			$session_id,
			$term_id,
			$enrolled_students[2],
			$tuition_fee_id,
			'DEMO-INV-003',
			'DEMO-PAY-003',
			$currency,
			500000,
			'partially_paid',
			gmdate( 'Y-m-d', strtotime( '-15 days' ) ),
			gmdate( 'Y-m-d', strtotime( '+15 days' ) ),
			250000,
			$tracked_ids
		);

		// Invoice 4: Partially Paid (Student 3)
		$this->create_invoice_and_payment(
			$session_id,
			$term_id,
			$enrolled_students[3],
			$tuition_fee_id,
			'DEMO-INV-004',
			'DEMO-PAY-004',
			$currency,
			500000,
			'partially_paid',
			gmdate( 'Y-m-d', strtotime( '-14 days' ) ),
			gmdate( 'Y-m-d', strtotime( '+15 days' ) ),
			250000,
			$tracked_ids
		);

		// Invoice 5: Overdue (Student 4)
		$this->create_invoice_and_payment(
			$session_id,
			$term_id,
			$enrolled_students[4],
			$tuition_fee_id,
			'DEMO-INV-005',
			null,
			$currency,
			500000,
			'overdue',
			gmdate( 'Y-m-d', strtotime( '-30 days' ) ),
			gmdate( 'Y-m-d', strtotime( '-10 days' ) ),
			0,
			$tracked_ids
		);

		// Invoice 6: Overdue (Student 5)
		$this->create_invoice_and_payment(
			$session_id,
			$term_id,
			$enrolled_students[5],
			$tuition_fee_id,
			'DEMO-INV-006',
			null,
			$currency,
			500000,
			'overdue',
			gmdate( 'Y-m-d', strtotime( '-25 days' ) ),
			gmdate( 'Y-m-d', strtotime( '-5 days' ) ),
			0,
			$tracked_ids
		);
		// ── 12. Noticeboard Announcements ─────────────────────────────────────
		$announcements = [
			[
				'title'        => 'Welcome to CodeClove (Demo)',
				'content'      => 'Welcome all parents, faculty, and students to the new academic session. Orientation schedules and syllabus guidelines have been published on the school portal.',
				'event_type'   => 'announcement',
				'accent_color' => 'purple',
				'icon'         => 'megaphone',
				'is_pinned'    => 1,
				'url'          => null,
			],
			[
				'title'        => 'Annual Athletics & Sports Meet Schedule',
				'content'      => 'The Annual Sports Meet will be held on the central sports grounds next Friday. Students are requested to wear their respective house uniforms.',
				'event_type'   => 'event',
				'accent_color' => 'indigo',
				'icon'         => 'calendar',
				'is_pinned'    => 0,
				'url'          => '/timetable',
			],
			[
				'title'        => 'School Library Digital Catalog & Circular',
				'content'      => 'Over 200 new reference books, digital textbooks, and term syllabus guides have been uploaded to the school catalog for student download.',
				'event_type'   => 'circular',
				'accent_color' => 'teal',
				'icon'         => 'book-open',
				'is_pinned'    => 0,
				'url'          => null,
			],
			[
				'title'        => 'Term 1 Parent-Teacher Conferences',
				'content'      => 'Parent-Teacher Conferences for Term 1 are scheduled for this coming Saturday from 09:00 AM to 01:00 PM. Individual meeting slots are available via the portal.',
				'event_type'   => 'notice',
				'accent_color' => 'slate',
				'icon'         => 'file-text',
				'is_pinned'    => 0,
				'url'          => null,
			],
			[
				'title'        => 'Urgent: Weather Advisory & Outdoor Suspension',
				'content'      => 'Due to forecasted severe weather conditions, all outdoor sports and extracurriculars after 03:00 PM are suspended. Please follow campus shuttle pickup guidelines.',
				'event_type'   => 'urgent',
				'accent_color' => 'rose',
				'icon'         => 'alert-circle',
				'is_pinned'    => 0,
				'url'          => null,
			],
			[
				'title'        => 'National Holiday School Closure Notice',
				'content'      => 'All academic classes and administrative offices will remain closed this Monday in observance of the public holiday. Normal classes resume on Tuesday.',
				'event_type'   => 'holiday',
				'accent_color' => 'emerald',
				'icon'         => 'calendar',
				'is_pinned'    => 0,
				'url'          => null,
			],
		];

		foreach ( $announcements as $ann ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::notifications(),
				[
					'user_id'      => 0,
					'student_id'   => null,
					'audience'     => 'portal',
					'title'        => $ann['title'],
					'content'      => $ann['content'],
					'notice_date'  => substr( $now, 0, 10 ),
					'event_type'   => $ann['event_type'],
					'accent_color' => $ann['accent_color'],
					'icon'         => $ann['icon'],
					'is_pinned'    => $ann['is_pinned'],
					'url'          => $ann['url'],
					'is_read'      => 0,
					'created_at'   => $now,
				]
			);
			$tracked_ids['notification_ids'][] = (int) $wpdb->insert_id;
		}
		// ── 13. Demo Activity Logs ────────────────────────────────────────────
		$demo_audit_events = [
			[ 'event_type' => 'student_enrolled',     'actor_type' => 'admin',  'meta' => [ 'module' => 'students',    'action' => 'enrolled',    'desc' => 'Demo student enrolled in active academic class.' ] ],
			[ 'event_type' => 'payment_recorded',     'actor_type' => 'staff',  'meta' => [ 'module' => 'finance',     'action' => 'paid',        'desc' => 'Tuition fee collection receipt DEMO-PAY-001 issued.' ] ],
			[ 'event_type' => 'application_received', 'actor_type' => 'public', 'meta' => [ 'module' => 'admissions',  'action' => 'submitted',   'desc' => 'Online application DEMO-APP-001 received.' ] ],
			[ 'event_type' => 'settings_updated',     'actor_type' => 'admin',  'meta' => [ 'module' => 'settings',    'action' => 'configured',  'desc' => 'School management preset applied with country defaults.' ] ],
		];
		foreach ( $demo_audit_events as $da_idx => $da ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::activity_logs(),
				[
					'event_type'    => $da['event_type'],
					'actor_type'    => $da['actor_type'],
					'actor_id'      => 1,
					'actor_label'   => 'CodeClove (Demo)',
					'ip_address'    => '127.0.0.1',
					'user_agent'    => 'Mozilla/5.0 (Demo Seeder)',
					'metadata_json' => wp_json_encode( $da['meta'] ),
					'created_at'    => gmdate( 'Y-m-d H:i:s', strtotime( '-' . ( 8 - $da_idx * 2 ) . ' days' ) ),
				]
			);
			$tracked_ids['audit_log_ids'][] = (int) $wpdb->insert_id;
		}
		// Persist the IDs map for clean teardown.
		update_option( self::OPTION_RECORD_IDS, $tracked_ids, false );

		return $tracked_ids;
	}

	/**
	 * Helper to create an invoice, line item, and optional payment.
	 *
	 * @param int         $session_id  Academic session ID.
	 * @param int         $term_id     Academic term ID.
	 * @param array       $student     Student enrollment details.
	 * @param int         $fee_type_id Fee type ID.
	 * @param string      $inv_number  Invoice number.
	 * @param string|null $pay_number  Payment number or null.
	 * @param string      $currency    Currency code.
	 * @param int         $total_minor Total amount in minor units.
	 * @param string      $status      Invoice status ('paid', 'partially_paid', 'overdue').
	 * @param string      $issue_date  Issue date.
	 * @param string      $due_date    Due date.
	 * @param int         $paid_minor  Paid amount in minor units.
	 * @param array       &$tracked_ids Reference to IDs tracker.
	 */
	private function create_invoice_and_payment(
		int $session_id,
		int $term_id,
		array $student,
		int $fee_type_id,
		string $inv_number,
		?string $pay_number,
		string $currency,
		int $total_minor,
		string $status,
		string $issue_date,
		string $due_date,
		int $paid_minor,
		array &$tracked_ids
	): void {
		global $wpdb;

		$now           = current_time( 'mysql' );
		$balance_minor = max( 0, $total_minor - $paid_minor );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->insert(
			Schema::invoices(),
			[
				'invoice_number'      => $inv_number,
				'student_id'          => $student['student_id'],
				'academic_session_id' => $session_id,
				'academic_term_id'    => $term_id,
				'academic_unit_id'    => $student['unit_id'],
				'academic_group_id'   => $student['group_id'],
				'guardian_name'       => $student['guardian_name'],
				'guardian_email'      => $student['guardian_email'],
				'currency'            => $currency,
				'issue_date'          => $issue_date,
				'due_date'            => $due_date,
				'subtotal_minor'      => $total_minor,
				'discount_minor'      => 0,
				'tax_minor'           => 0,
				'total_minor'         => $total_minor,
				'paid_minor'          => $paid_minor,
				'balance_minor'       => $balance_minor,
				'status'              => $status,
				'created_at'          => $now,
				'updated_at'          => $now,
			]
		);
		$invoice_id                   = (int) $wpdb->insert_id;
		$tracked_ids['invoice_ids'][] = $invoice_id;

		// Line item
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->insert(
			Schema::line_items(),
			[
				'invoice_id'        => $invoice_id,
				'fee_type_id'       => $fee_type_id,
				'description'       => 'Tuition Fee - Regular Term',
				'quantity'          => '1.00',
				'unit_amount_minor' => $total_minor,
				'discount_minor'    => 0,
				'total_minor'       => $total_minor,
				'tax_minor'         => 0,
				'sort_order'        => 1,
				'created_at'        => $now,
				'updated_at'        => $now,
			]
		);
		$tracked_ids['line_item_ids'][] = (int) $wpdb->insert_id;

		// Payment record if paid
		if ( $paid_minor > 0 && ! empty( $pay_number ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::payments(),
				[
					'payment_number'      => $pay_number,
					'invoice_id'          => $invoice_id,
					'student_id'          => $student['student_id'],
					'academic_session_id' => $session_id,
					'amount_minor'        => $paid_minor,
					'currency'            => $currency,
					'method'              => 'bank_transfer',
					'payment_source'      => 'manual',
					'status'              => 'completed',
					'paid_on'             => gmdate( 'Y-m-d', strtotime( '-5 days' ) ),
					'reference'           => 'DEMO-TXN-REF',
					'created_at'          => $now,
					'updated_at'          => $now,
				]
			);
			$tracked_ids['payment_ids'][] = (int) $wpdb->insert_id;
		}
	}

	/**
	 * Deletes records by an array of IDs.
	 *
	 * @param string $table Database table name.
	 * @param array  $ids   Record IDs.
	 */
	private function delete_by_ids( string $table, array $ids ): void {
		global $wpdb;

		$filtered_ids = array_filter( array_map( 'intval', $ids ) );
		if ( empty( $filtered_ids ) ) {
			return;
		}

		$placeholders = implode( ',', array_fill( 0, count( $filtered_ids ), '%d' ) );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM %i WHERE id IN ({$placeholders})", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber
				$table,
				...$filtered_ids
			)
		);
	}
}
