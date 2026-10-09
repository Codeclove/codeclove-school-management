<?php
/**
 * Demo Data Service.
 *
 * Populates realistic sample school records (academic sessions, classes, subjects,
 * staff, students, fee types, invoices, attendance, and noticeboard announcements)
 * so that new installations do not face an empty screen.
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

		set_transient( self::LOCK_TRANSIENT, 1, 60 );

		try {
			// Clear any previous demo data first to prevent duplicate key collisions.
			$this->clear();

			$result = Transaction::run(
				function () use ( $country ): array {
					return $this->seed_demo_records( $country );
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
	 * Clears demo records from the database and removes the demo data imported option.
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
			$this->delete_by_ids( Schema::attendance(), $ids['attendance_ids'] ?? [] );
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

			// Also clean any demo records matching prefix in case IDs were missing or legacy.
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
			$wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE title LIKE %s', Schema::notifications(), '%CodeClove (Demo)%' ) );

			delete_option( self::OPTION_IMPORTED );
			delete_option( self::OPTION_RECORD_IDS );
			delete_option( self::OPTION_PROMPT_DISMISSED );

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
		$student_count = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . Schema::students() . ' WHERE deleted_at IS NULL' );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$raw_session_count = @$wpdb->get_var( 'SELECT COUNT(*) FROM ' . Schema::sessions() . ' WHERE deleted_at IS NULL' );
		if ( null === $raw_session_count ) {
			// Fallback in case academic_sessions table does not have deleted_at column.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$raw_session_count = $wpdb->get_var( 'SELECT COUNT(*) FROM ' . Schema::sessions() );
		}
		$session_count = (int) $raw_session_count;

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
	 * Generates lightweight, realistic sample records.
	 *
	 * @param string $country Country preset input.
	 * @return array Created IDs map.
	 */
	private function seed_demo_records( string $country ): array {
		global $wpdb;

		$now     = current_time( 'mysql' );
		$today   = current_time( 'Y-m-d' );
		$cur_year = (int) gmdate( 'Y' );
		$next_year = $cur_year + 1;

		// Detect country preset and currency.
		$settings = ( new SettingsRepository() )->get_settings();
		$country_code = strtoupper( trim( $country ) );
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
			'session_ids'          => [],
			'term_ids'             => [],
			'unit_ids'             => [],
			'group_ids'            => [],
			'subject_ids'          => [],
			'unit_subject_ids'     => [],
			'staff_ids'            => [],
			'student_ids'          => [],
			'guardian_ids'         => [],
			'student_guardian_ids' => [],
			'enrollment_ids'       => [],
			'student_subject_ids'  => [],
			'fee_type_ids'         => [],
			'invoice_ids'          => [],
			'line_item_ids'        => [],
			'payment_ids'          => [],
			'attendance_ids'       => [],
			'notification_ids'     => [],
		];

		// ── 1. Academic Session & Term ─────────────────────────────────────────
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->insert(
			Schema::sessions(),
			[
				'name'       => "{$cur_year}-{$next_year}",
				'code'       => "DEMO-{$cur_year}-" . substr( (string) $next_year, -2 ),
				'starts_on'  => gmdate( 'Y-01-01' ),
				'ends_on'    => gmdate( 'Y-12-31', strtotime( '+1 year' ) ),
				'is_current' => 1,
				'status'     => 'active',
				'created_at' => $now,
				'updated_at' => $now,
			]
		);
		$session_id = (int) $wpdb->insert_id;
		$tracked_ids['session_ids'][] = $session_id;

		// 1 Term so current term resolver and dashboard term filter works smoothly.
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
		$term_id = (int) $wpdb->insert_id;
		$tracked_ids['term_ids'][] = $term_id;

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
			$u_id = (int) $wpdb->insert_id;
			$unit_ids[] = $u_id;
			$tracked_ids['unit_ids'][] = $u_id;

			// Add sections (Section A & Section B)
			foreach ( [ 'Section A', 'Section B' ] as $g_idx => $sec_name ) {
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
				$g_id = (int) $wpdb->insert_id;
				$group_ids[ $u_id ][] = $g_id;
				$tracked_ids['group_ids'][] = $g_id;
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
			$s_id = (int) $wpdb->insert_id;
			$subject_ids[] = $s_id;
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

		// ── 4. Staff Members ───────────────────────────────────────────────────
		$staff_data = match ( $country_code ) {
			'GB' => [
				[ 'first' => 'Claire', 'last' => 'Higgins', 'title' => 'Ms.', 'email' => 'claire.higgins@example.com', 'role' => 'Teacher', 'desig' => 'Lead Teacher', 'dept' => 'Academics', 'num' => 'DEMO-STF-101' ],
				[ 'first' => 'Philip', 'last' => 'Hughes',  'title' => 'Mr.', 'email' => 'philip.hughes@example.com',  'role' => 'Admin',   'desig' => 'Operations Manager', 'dept' => 'Administration', 'num' => 'DEMO-STF-102' ],
				[ 'first' => 'Rachel', 'last' => 'Bennett', 'title' => 'Mrs.', 'email' => 'rachel.bennett@example.com', 'role' => 'Accountant', 'desig' => 'Bursar', 'dept' => 'Finance', 'num' => 'DEMO-STF-103' ],
			],
			'US' => [
				[ 'first' => 'Sarah',  'last' => 'Jenkins',  'title' => 'Ms.', 'email' => 'sarah.jenkins@example.com',  'role' => 'Teacher', 'desig' => 'Lead Teacher', 'dept' => 'Academics', 'num' => 'DEMO-STF-101' ],
				[ 'first' => 'Mark',   'last' => 'Anderson', 'title' => 'Mr.', 'email' => 'mark.anderson@example.com', 'role' => 'Admin',   'desig' => 'Administrator', 'dept' => 'Administration', 'num' => 'DEMO-STF-102' ],
				[ 'first' => 'Emily',  'last' => 'Davis',    'title' => 'Mrs.', 'email' => 'emily.davis@example.com',    'role' => 'Accountant', 'desig' => 'Finance Officer', 'dept' => 'Finance', 'num' => 'DEMO-STF-103' ],
			],
			default => [
				[ 'first' => 'Sunita', 'last' => 'Rao',     'title' => 'Mrs.', 'email' => 'sunita.rao@example.com',     'role' => 'Teacher', 'desig' => 'Senior Teacher', 'dept' => 'Academics', 'num' => 'DEMO-STF-101' ],
				[ 'first' => 'Ramesh', 'last' => 'Nair',    'title' => 'Mr.',  'email' => 'ramesh.nair@example.com',    'role' => 'Admin',   'desig' => 'Administrator', 'dept' => 'Administration', 'num' => 'DEMO-STF-102' ],
				[ 'first' => 'Kavita', 'last' => 'Mehta',   'title' => 'Ms.',  'email' => 'kavita.mehta@example.com',   'role' => 'Accountant', 'desig' => 'Chief Accountant', 'dept' => 'Finance', 'num' => 'DEMO-STF-103' ],
			],
		};

		foreach ( $staff_data as $stf ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::staff_members(),
				[
					'staff_number'    => $stf['num'],
					'title'           => $stf['title'],
					'first_name'      => $stf['first'],
					'last_name'       => $stf['last'],
					'email'           => $stf['email'],
					'phone'           => '+91 98765 43210',
					'department'      => $stf['dept'],
					'designation'     => $stf['desig'],
					'staff_category'  => 'teaching' === strtolower( $stf['role'] ) ? 'teaching' : 'administrative',
					'employment_type' => 'full_time',
					'joined_on'       => gmdate( 'Y-m-d', strtotime( '-6 months' ) ),
					'status'          => 'active',
					'created_at'      => $now,
					'updated_at'      => $now,
				]
			);
			$tracked_ids['staff_ids'][] = (int) $wpdb->insert_id;
		}

		// ── 5. Students & Guardians ────────────────────────────────────────────
		$students_data = match ( $country_code ) {
			'GB' => [
				[ 'first' => 'George',  'last' => 'Taylor',    'gender' => 'male',   'dob' => '2018-05-14', 'g_first' => 'Richard',  'g_last' => 'Taylor' ],
				[ 'first' => 'Olivia',  'last' => 'Wilson',    'gender' => 'female', 'dob' => '2018-08-22', 'g_first' => 'Paul',     'g_last' => 'Wilson' ],
				[ 'first' => 'Harry',   'last' => 'Davies',    'gender' => 'male',   'dob' => '2017-03-10', 'g_first' => 'Edward',   'g_last' => 'Davies' ],
				[ 'first' => 'Amelia',  'last' => 'Evans',     'gender' => 'female', 'dob' => '2017-11-05', 'g_first' => 'George',   'g_last' => 'Evans' ],
				[ 'first' => 'Jack',    'last' => 'Thomas',    'gender' => 'male',   'dob' => '2017-07-19', 'g_first' => 'Arthur',   'g_last' => 'Thomas' ],
				[ 'first' => 'Isla',    'last' => 'Roberts',   'gender' => 'female', 'dob' => '2016-02-28', 'g_first' => 'William',  'g_last' => 'Roberts' ],
				[ 'first' => 'Charlie', 'last' => 'Walker',    'gender' => 'male',   'dob' => '2016-09-12', 'g_first' => 'John',     'g_last' => 'Walker' ],
				[ 'first' => 'Mia',     'last' => 'Wright',    'gender' => 'female', 'dob' => '2016-12-01', 'g_first' => 'Henry',    'g_last' => 'Wright' ],
				[ 'first' => 'Freddie', 'last' => 'Robinson',  'gender' => 'male',   'dob' => '2015-04-18', 'g_first' => 'Albert',   'g_last' => 'Robinson' ],
				[ 'first' => 'Poppy',   'last' => 'Thompson',  'gender' => 'female', 'dob' => '2015-10-30', 'g_first' => 'Charles',  'g_last' => 'Thompson' ],
			],
			'US' => [
				[ 'first' => 'Liam',     'last' => 'Smith',     'gender' => 'male',   'dob' => '2018-05-14', 'g_first' => 'Robert',   'g_last' => 'Smith' ],
				[ 'first' => 'Emma',     'last' => 'Johnson',   'gender' => 'female', 'dob' => '2018-08-22', 'g_first' => 'David',    'g_last' => 'Johnson' ],
				[ 'first' => 'Noah',     'last' => 'Williams',  'gender' => 'male',   'dob' => '2017-03-10', 'g_first' => 'Michael',  'g_last' => 'Williams' ],
				[ 'first' => 'Olivia',   'last' => 'Brown',     'gender' => 'female', 'dob' => '2017-11-05', 'g_first' => 'James',    'g_last' => 'Brown' ],
				[ 'first' => 'Oliver',   'last' => 'Jones',     'gender' => 'male',   'dob' => '2017-07-19', 'g_first' => 'William',  'g_last' => 'Jones' ],
				[ 'first' => 'Ava',      'last' => 'Garcia',    'gender' => 'female', 'dob' => '2016-02-28', 'g_first' => 'Carlos',   'g_last' => 'Garcia' ],
				[ 'first' => 'Elijah',   'last' => 'Miller',    'gender' => 'male',   'dob' => '2016-09-12', 'g_first' => 'Thomas',   'g_last' => 'Miller' ],
				[ 'first' => 'Sophia',   'last' => 'Davis',     'gender' => 'female', 'dob' => '2016-12-01', 'g_first' => 'Charles',  'g_last' => 'Davis' ],
				[ 'first' => 'Lucas',    'last' => 'Rodriguez', 'gender' => 'male',   'dob' => '2015-04-18', 'g_first' => 'Jose',     'g_last' => 'Rodriguez' ],
				[ 'first' => 'Isabella', 'last' => 'Martinez',  'gender' => 'female', 'dob' => '2015-10-30', 'g_first' => 'Daniel',   'g_last' => 'Martinez' ],
			],
			default => [
				[ 'first' => 'Aarav',   'last' => 'Sharma',    'gender' => 'male',   'dob' => '2018-05-14', 'g_first' => 'Rajesh',   'g_last' => 'Sharma' ],
				[ 'first' => 'Ananya',  'last' => 'Patel',     'gender' => 'female', 'dob' => '2018-08-22', 'g_first' => 'Suresh',   'g_last' => 'Patel' ],
				[ 'first' => 'Vivaan',  'last' => 'Gupta',     'gender' => 'male',   'dob' => '2017-03-10', 'g_first' => 'Amit',     'g_last' => 'Gupta' ],
				[ 'first' => 'Diya',    'last' => 'Reddy',     'gender' => 'female', 'dob' => '2017-11-05', 'g_first' => 'Vikram',   'g_last' => 'Reddy' ],
				[ 'first' => 'Ishaan',  'last' => 'Kumar',     'gender' => 'male',   'dob' => '2017-07-19', 'g_first' => 'Manoj',    'g_last' => 'Kumar' ],
				[ 'first' => 'Sanvi',   'last' => 'Verma',     'gender' => 'female', 'dob' => '2016-02-28', 'g_first' => 'Ramesh',   'g_last' => 'Verma' ],
				[ 'first' => 'Reyansh', 'last' => 'Joshi',     'gender' => 'male',   'dob' => '2016-09-12', 'g_first' => 'Deepak',   'g_last' => 'Joshi' ],
				[ 'first' => 'Myra',    'last' => 'Singh',     'gender' => 'female', 'dob' => '2016-12-01', 'g_first' => 'Harpreet', 'g_last' => 'Singh' ],
				[ 'first' => 'Advait',  'last' => 'Nair',      'gender' => 'male',   'dob' => '2015-04-18', 'g_first' => 'Prakash',  'g_last' => 'Nair' ],
				[ 'first' => 'Kiara',   'last' => 'Malhotra',  'gender' => 'female', 'dob' => '2015-10-30', 'g_first' => 'Sunil',    'g_last' => 'Malhotra' ],
			],
		};

		$enrolled_students = [];

		foreach ( $students_data as $i => $stu ) {
			$seq          = sprintf( '%03d', $i + 1 );
			$adm_number   = "DEMO-ADM-{$seq}";
			$stu_number   = "DEMO-STU-{$seq}";
			$guardian_email = strtolower( "{$stu['g_first']}.{$stu['g_last']}@example.com" );
			$guardian_name  = "{$stu['g_first']} {$stu['g_last']}";

			// Create guardian
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::guardians(),
				[
					'first_name' => $stu['g_first'],
					'last_name'  => $stu['g_last'],
					'email'      => $guardian_email,
					'phone'      => '+91 91234 56789',
					'status'     => 'active',
					'created_at' => $now,
					'updated_at' => $now,
				]
			);
			$guardian_id = (int) $wpdb->insert_id;
			$tracked_ids['guardian_ids'][] = $guardian_id;

			// Create student
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::students(),
				[
					'student_number'   => $stu_number,
					'admission_number' => $adm_number,
					'first_name'       => $stu['first'],
					'last_name'        => $stu['last'],
					'date_of_birth'    => $stu['dob'],
					'gender'           => $stu['gender'],
					'admission_date'   => gmdate( 'Y-m-d', strtotime( '-2 months' ) ),
					'email'            => strtolower( "{$stu['first']}.{$stu['last']}@school.example.com" ),
					'status'           => 'active',
					'created_at'       => $now,
					'updated_at'       => $now,
				]
			);
			$student_id = (int) $wpdb->insert_id;
			$tracked_ids['student_ids'][] = $student_id;

			// Link guardian
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->insert(
				Schema::student_guardians(),
				[
					'student_id'           => $student_id,
					'guardian_id'          => $guardian_id,
					'relationship'         => 'parent',
					'is_primary'           => 1,
					'is_billing_contact'   => 1,
					'is_emergency_contact' => 1,
					'created_at'           => $now,
					'updated_at'           => $now,
				]
			);
			$tracked_ids['student_guardian_ids'][] = (int) $wpdb->insert_id;

			// Enroll in one of the 3 units (distributed across classes)
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
			];
		}

		// ── 6. Fee Types ───────────────────────────────────────────────────────
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
			$ft_id = (int) $wpdb->insert_id;
			$fee_type_ids[] = $ft_id;
			$tracked_ids['fee_type_ids'][] = $ft_id;
		}

		// ── 7. Invoices & Payments (6 Invoices: 2 Paid, 2 Partial, 2 Overdue) ───
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

		// ── 8. Student Attendance Records (Today: 8 Present, 2 Late) ───────────
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

		// ── 9. Noticeboard Announcement ────────────────────────────────────────
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->insert(
			Schema::notifications(),
			[
				'user_id'    => 0,
				'student_id' => null,
				'audience'   => 'portal',
				'title'      => 'Welcome to CodeClove (Demo)',
				'content'    => 'Welcome all parents, faculty, and students to the new academic session. Orientation schedules and syllabus guidelines have been published.',
				'event_type' => 'announcement',
				'is_read'    => 0,
				'created_at' => $now,
			]
		);
		$tracked_ids['notification_ids'][] = (int) $wpdb->insert_id;

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
		$invoice_id = (int) $wpdb->insert_id;
		$tracked_ids['invoice_ids'][] = $invoice_id;

		// Line item
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->insert(
			Schema::line_items(),
			[
				'invoice_id'         => $invoice_id,
				'fee_type_id'        => $fee_type_id,
				'description'        => 'Tuition Fee - Regular Term',
				'quantity'           => '1.00',
				'unit_amount_minor'  => $total_minor,
				'discount_minor'     => 0,
				'total_minor'        => $total_minor,
				'tax_minor'          => 0,
				'sort_order'         => 1,
				'created_at'         => $now,
				'updated_at'         => $now,
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
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM %i WHERE id IN ({$placeholders})", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$table,
				...$filtered_ids
			)
		);
	}
}
