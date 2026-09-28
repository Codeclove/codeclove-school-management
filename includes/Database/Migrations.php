<?php
/**
 * Database migrations.
 *
 * Creates and upgrades all CodeClove custom tables using WordPress's dbDelta().
 * dbDelta() is additive — it adds missing tables/columns but never removes
 * existing ones, making it safe to re-run on every upgrade.
 *
 * All table definitions must follow dbDelta() rules:
 *   - Two spaces between column name and type.
 *   - PRIMARY KEY must be uppercase.
 *   - Index definitions must use KEY, not INDEX.
 *
 * @package CodeClove\Database
 */

declare( strict_types=1 );

namespace CodeClove\Database;

/**
 * Class Migrations
 */
final class Migrations {

	/**
	 * Checks whether representative tables from every V1 domain exist.
	 *
	 * Version options can become stale after database restores or interrupted
	 * activations, so migration decisions must also verify physical schema.
	 */
	public static function is_schema_installed(): bool {
		global $wpdb;

		$required_tables = Schema::all();
		$pattern         = $wpdb->esc_like( $wpdb->prefix . 'codeclove_' ) . '%';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$installed_tables = $wpdb->get_col(
			$wpdb->prepare( 'SHOW TABLES LIKE %s', $pattern )
		);

		return [] === array_diff( $required_tables, $installed_tables );
	}

	/**
	 * Runs all table migrations and updates the stored schema version.
	 * Idempotent — safe to call multiple times.
	 */
	public static function run(): void {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset_collate = self::charset_collate();

		self::migrate_academic_tables( $charset_collate );
		self::migrate_role_tables( $charset_collate );
		self::migrate_admission_tables( $charset_collate );
		self::migrate_student_tables( $charset_collate );
		self::migrate_staff_tables( $charset_collate );
		self::migrate_attendance_tables( $charset_collate );
		self::migrate_finance_tables( $charset_collate );
		if ( class_exists( ProMigrations::class ) ) {
			ProMigrations::run( $charset_collate );
		}



		// Store the new schema version.
		$settings                   = get_option( 'codeclove_settings', [] );
		$settings['schema_version'] = CODECLOVE_DB_VERSION;
		update_option( 'codeclove_settings', $settings, false );
	}

	// ─── Academic Tables ─────────────────────────────────────────────────────

	private static function migrate_academic_tables( string $cc ): void {
		dbDelta( "CREATE TABLE " . Schema::sessions() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  name varchar(120) NOT NULL,
  code varchar(40) DEFAULT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  is_current tinyint(1) NOT NULL DEFAULT 0,
  status varchar(30) NOT NULL DEFAULT 'draft',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY idx_status (status),
  KEY idx_is_current (is_current)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::terms() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  academic_session_id bigint(20) UNSIGNED NOT NULL,
  name varchar(120) NOT NULL,
  code varchar(40) DEFAULT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  status varchar(30) NOT NULL DEFAULT 'draft',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY idx_session (academic_session_id),
  KEY idx_status (status)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::units() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  academic_session_id bigint(20) UNSIGNED NOT NULL,
  name varchar(120) NOT NULL,
  code varchar(40) DEFAULT NULL,
  level_order int NOT NULL DEFAULT 0,
  status varchar(30) NOT NULL DEFAULT 'active',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY idx_session (academic_session_id),
  KEY idx_status (status)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::groups() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  academic_unit_id bigint(20) UNSIGNED NOT NULL,
  name varchar(120) NOT NULL,
  code varchar(40) DEFAULT NULL,
  capacity int DEFAULT NULL,
  status varchar(30) NOT NULL DEFAULT 'active',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY idx_unit (academic_unit_id),
  KEY idx_status (status)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::subjects() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  name varchar(160) NOT NULL,
  code varchar(40) DEFAULT NULL,
  type varchar(40) NOT NULL DEFAULT 'core',
  status varchar(30) NOT NULL DEFAULT 'active',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY idx_status (status),
  KEY idx_type (type),
  KEY idx_code (code)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::unit_subjects() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  academic_unit_id bigint(20) UNSIGNED NOT NULL,
  subject_id bigint(20) UNSIGNED NOT NULL,
  is_required tinyint(1) NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 0,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  UNIQUE KEY uq_unit_subject (academic_unit_id, subject_id),
  KEY idx_unit (academic_unit_id),
  KEY idx_subject (subject_id)
) $cc;" );
	}

	// ─── Role Tables ─────────────────────────────────────────────────────────

	private static function migrate_role_tables( string $cc ): void {
		dbDelta( "CREATE TABLE " . Schema::roles() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  name varchar(120) NOT NULL,
  slug varchar(80) NOT NULL,
  description text DEFAULT NULL,
  is_system tinyint(1) NOT NULL DEFAULT 0,
  is_locked tinyint(1) NOT NULL DEFAULT 0,
  created_by bigint(20) UNSIGNED DEFAULT NULL,
  updated_by bigint(20) UNSIGNED DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  UNIQUE KEY uq_slug (slug)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::role_permissions() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id bigint(20) UNSIGNED NOT NULL,
  permission_key varchar(120) NOT NULL,
  allowed tinyint(1) NOT NULL DEFAULT 0,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  UNIQUE KEY uq_role_permission (role_id, permission_key),
  KEY idx_role (role_id),
  KEY idx_key (permission_key)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::user_roles() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id bigint(20) UNSIGNED NOT NULL,
  role_id bigint(20) UNSIGNED NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  UNIQUE KEY uq_user_role (user_id, role_id),
  KEY idx_user (user_id),
  KEY idx_role (role_id)
) $cc;" );
	}

	// ─── Admission Tables ─────────────────────────────────────────────────────

	private static function migrate_admission_tables( string $cc ): void {
		dbDelta( "CREATE TABLE " . Schema::applications() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  reference_number varchar(80) NOT NULL,
  status varchar(40) NOT NULL DEFAULT 'inquiry',
  source varchar(60) NOT NULL DEFAULT 'public_form',
  academic_session_id bigint(20) UNSIGNED DEFAULT NULL,
  academic_unit_id bigint(20) UNSIGNED DEFAULT NULL,
  academic_group_id bigint(20) UNSIGNED DEFAULT NULL,
  student_first_name varchar(120) NOT NULL,
  student_middle_name varchar(120) DEFAULT NULL,
  student_last_name varchar(120) NOT NULL,
  student_preferred_name varchar(120) DEFAULT NULL,
  student_date_of_birth date DEFAULT NULL,
  student_gender varchar(40) DEFAULT NULL,
  student_photo_id bigint(20) UNSIGNED DEFAULT NULL,
  guardian_name varchar(180) NOT NULL,
  guardian_email varchar(190) NOT NULL,
  guardian_phone varchar(80) DEFAULT NULL,
  address_json longtext DEFAULT NULL,
  custom_fields_json longtext DEFAULT NULL,
  submitted_at datetime DEFAULT NULL,
  reviewed_at datetime DEFAULT NULL,
  decision_at datetime DEFAULT NULL,
  converted_student_id bigint(20) UNSIGNED DEFAULT NULL,
  converted_guardian_id bigint(20) UNSIGNED DEFAULT NULL,
  converted_enrollment_id bigint(20) UNSIGNED DEFAULT NULL,
  created_by bigint(20) UNSIGNED DEFAULT NULL,
  updated_by bigint(20) UNSIGNED DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY uq_reference (reference_number),
  KEY idx_status (status),
  KEY idx_session (academic_session_id),
  KEY idx_academic_unit_id (academic_unit_id),
  KEY idx_deleted (deleted_at),
  KEY idx_status_deleted (status, deleted_at),
  KEY idx_guardian_email (guardian_email)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::app_events() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id bigint(20) UNSIGNED NOT NULL,
  from_status varchar(40) DEFAULT NULL,
  to_status varchar(40) NOT NULL,
  reason varchar(255) DEFAULT NULL,
  message text DEFAULT NULL,
  visibility varchar(30) NOT NULL DEFAULT 'internal',
  changed_by bigint(20) UNSIGNED DEFAULT NULL,
  changed_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY idx_application (application_id)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::app_documents() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id bigint(20) UNSIGNED NOT NULL,
  document_type varchar(80) NOT NULL DEFAULT 'other',
  label varchar(160) NOT NULL,
  attachment_id bigint(20) UNSIGNED DEFAULT NULL,
  status varchar(40) NOT NULL DEFAULT 'requested',
  required tinyint(1) NOT NULL DEFAULT 0,
  review_note text DEFAULT NULL,
  uploaded_by_email varchar(190) DEFAULT NULL,
  reviewed_by bigint(20) UNSIGNED DEFAULT NULL,
  uploaded_at datetime DEFAULT NULL,
  reviewed_at datetime DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY idx_application (application_id),
  KEY idx_status (status)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::app_notes() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id bigint(20) UNSIGNED NOT NULL,
  note_type varchar(40) NOT NULL DEFAULT 'internal',
  body text NOT NULL,
  visibility varchar(30) NOT NULL DEFAULT 'internal',
  pinned tinyint(1) NOT NULL DEFAULT 0,
  created_by bigint(20) UNSIGNED NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY idx_application (application_id),
  KEY idx_pinned (pinned)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::app_logs() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type varchar(80) NOT NULL,
  actor_type varchar(40) NOT NULL DEFAULT 'system',
  actor_id bigint(20) UNSIGNED DEFAULT NULL,
  actor_label varchar(190) DEFAULT NULL,
  ip_address varchar(45) DEFAULT NULL,
  user_agent text DEFAULT NULL,
  metadata_json longtext DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY idx_event_type (event_type),
  KEY idx_created_at (created_at)
) $cc;" );
	}

	// ─── Student Tables ───────────────────────────────────────────────────────

	private static function migrate_student_tables( string $cc ): void {
		dbDelta( "CREATE TABLE " . Schema::students() . " (
  id  bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id  bigint(20) UNSIGNED DEFAULT NULL,
  student_number  varchar(80) DEFAULT NULL,
  admission_number varchar(80) DEFAULT NULL,
  first_name varchar(120) NOT NULL,
  middle_name varchar(120) DEFAULT NULL,
  last_name varchar(120) NOT NULL,
  preferred_name varchar(120) DEFAULT NULL,
  date_of_birth date DEFAULT NULL,
  gender varchar(40) DEFAULT NULL,
  photo_id bigint(20) UNSIGNED DEFAULT NULL,
  admission_date date DEFAULT NULL,
  graduation_year int(11) DEFAULT NULL,
  address_json longtext DEFAULT NULL,
  email varchar(190) DEFAULT NULL,
  phone varchar(80) DEFAULT NULL,
  status varchar(40) NOT NULL DEFAULT 'active',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  KEY idx_status (status),
  KEY idx_user (user_id),
  KEY idx_student_number (student_number),
  KEY idx_admission_number (admission_number),
  KEY idx_deleted (deleted_at),
  KEY idx_status_deleted (status, deleted_at),
  KEY idx_name (last_name, first_name)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::guardians() . " (
  id  bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id  bigint(20) UNSIGNED DEFAULT NULL,
  first_name  varchar(120) NOT NULL,
  middle_name varchar(120) DEFAULT NULL,
  last_name varchar(120) NOT NULL,
  email varchar(190) DEFAULT NULL,
  phone varchar(80) DEFAULT NULL,
  alternate_phone varchar(80) DEFAULT NULL,
  occupation varchar(160) DEFAULT NULL,
  address_json longtext DEFAULT NULL,
  status varchar(40) NOT NULL DEFAULT 'active',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  KEY idx_status (status),
  KEY idx_user (user_id),
  KEY idx_email (email),
  KEY idx_deleted (deleted_at),
  KEY idx_status_deleted (status, deleted_at)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::student_guardians() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id bigint(20) UNSIGNED NOT NULL,
  guardian_id bigint(20) UNSIGNED NOT NULL,
  relationship varchar(60) NOT NULL DEFAULT 'guardian',
  is_primary tinyint(1) NOT NULL DEFAULT 0,
  is_billing_contact tinyint(1) NOT NULL DEFAULT 0,
  is_emergency_contact tinyint(1) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  UNIQUE KEY uq_student_guardian (student_id, guardian_id),
  KEY idx_student (student_id),
  KEY idx_guardian (guardian_id)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::enrollments() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id bigint(20) UNSIGNED NOT NULL,
  academic_session_id bigint(20) UNSIGNED NOT NULL,
  academic_unit_id bigint(20) UNSIGNED NOT NULL,
  academic_group_id bigint(20) UNSIGNED DEFAULT NULL,
  roll_number varchar(80) DEFAULT NULL,
  starts_on date DEFAULT NULL,
  ends_on date DEFAULT NULL,
  status varchar(40) NOT NULL DEFAULT 'active',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY idx_student_session (student_id, academic_session_id),
  KEY idx_student (student_id),
  KEY idx_session (academic_session_id),
  KEY idx_unit (academic_unit_id),
  KEY idx_group (academic_group_id),
  KEY idx_status (status)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::student_subjects() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id bigint(20) UNSIGNED NOT NULL,
  subject_id bigint(20) UNSIGNED NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  UNIQUE KEY uq_student_subject (student_id, subject_id),
  KEY idx_student (student_id),
  KEY idx_subject (subject_id)
) $cc;" );
	}

	// ─── Staff Tables ─────────────────────────────────────────────────────────

	private static function migrate_staff_tables( string $cc ): void {
		dbDelta( "CREATE TABLE " . Schema::staff_apps() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  reference_number varchar(80) NOT NULL,
  status varchar(40) NOT NULL DEFAULT 'submitted',
  source varchar(60) NOT NULL DEFAULT 'public_form',
  desired_role varchar(120) DEFAULT NULL,
  department varchar(120) DEFAULT NULL,
  first_name varchar(120) NOT NULL,
  middle_name varchar(120) DEFAULT NULL,
  last_name varchar(120) NOT NULL,
  preferred_name varchar(120) DEFAULT NULL,
  date_of_birth date DEFAULT NULL,
  email varchar(190) NOT NULL,
  phone varchar(80) DEFAULT NULL,
  address_json longtext DEFAULT NULL,
  experience_json longtext DEFAULT NULL,
  custom_fields_json longtext DEFAULT NULL,
  submitted_at datetime DEFAULT NULL,
  reviewed_at datetime DEFAULT NULL,
  decision_at datetime DEFAULT NULL,
  converted_staff_member_id bigint(20) UNSIGNED DEFAULT NULL,
  converted_user_id bigint(20) UNSIGNED DEFAULT NULL,
  created_by bigint(20) UNSIGNED DEFAULT NULL,
  updated_by bigint(20) UNSIGNED DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY uq_reference (reference_number),
  KEY idx_status (status),
  KEY idx_email (email),
  KEY idx_deleted (deleted_at),
  KEY idx_status_deleted (status, deleted_at)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::staff_app_events() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  staff_application_id bigint(20) UNSIGNED NOT NULL,
  from_status varchar(40) DEFAULT NULL,
  to_status varchar(40) NOT NULL,
  reason varchar(255) DEFAULT NULL,
  message text DEFAULT NULL,
  visibility varchar(30) NOT NULL DEFAULT 'internal',
  changed_by bigint(20) UNSIGNED DEFAULT NULL,
  changed_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY idx_application (staff_application_id)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::staff_app_docs() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  staff_application_id bigint(20) UNSIGNED NOT NULL,
  document_type varchar(80) NOT NULL DEFAULT 'other',
  label varchar(160) NOT NULL,
  attachment_id bigint(20) UNSIGNED DEFAULT NULL,
  status varchar(40) NOT NULL DEFAULT 'requested',
  required tinyint(1) NOT NULL DEFAULT 0,
  review_note text DEFAULT NULL,
  uploaded_by_email varchar(190) DEFAULT NULL,
  reviewed_by bigint(20) UNSIGNED DEFAULT NULL,
  uploaded_at datetime DEFAULT NULL,
  reviewed_at datetime DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY idx_application (staff_application_id),
  KEY idx_status (status)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::staff_app_notes() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  staff_application_id bigint(20) UNSIGNED NOT NULL,
  note_type varchar(40) NOT NULL DEFAULT 'internal',
  body text NOT NULL,
  visibility varchar(30) NOT NULL DEFAULT 'internal',
  pinned tinyint(1) NOT NULL DEFAULT 0,
  created_by bigint(20) UNSIGNED NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY idx_application (staff_application_id)
) $cc;" );


		dbDelta( "CREATE TABLE " . Schema::staff_members() . " (
  id  bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id  bigint(20) UNSIGNED DEFAULT NULL,
  role_id  bigint(20) UNSIGNED DEFAULT NULL,
  staff_number  varchar(80) DEFAULT NULL,
  title  varchar(40) DEFAULT NULL,
  first_name  varchar(120) NOT NULL,
  middle_name  varchar(120) DEFAULT NULL,
  last_name  varchar(120) NOT NULL,
  preferred_name  varchar(120) DEFAULT NULL,
  date_of_birth  date DEFAULT NULL,
  gender  varchar(40) DEFAULT NULL,
  email  varchar(190) NOT NULL,
  phone  varchar(80) DEFAULT NULL,
  department  varchar(120) DEFAULT NULL,
  designation  varchar(120) DEFAULT NULL,
  staff_category  varchar(60) DEFAULT NULL,
  employment_type  varchar(60) DEFAULT NULL,
  joined_on  date DEFAULT NULL,
  photo_id  bigint(20) UNSIGNED DEFAULT NULL,
  emergency_contact_json  longtext DEFAULT NULL,
  qualifications_json  longtext DEFAULT NULL,
  metadata_json  longtext DEFAULT NULL,
  address_json  longtext DEFAULT NULL,
  documents_json  longtext DEFAULT NULL,
  status  varchar(40) NOT NULL DEFAULT 'active',
  created_at  datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at  datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  KEY idx_user (user_id),
  KEY idx_role (role_id),
  KEY idx_email (email),
  KEY idx_status (status),
  KEY idx_staff_number (staff_number),
  KEY idx_deleted (deleted_at),
  KEY idx_status_deleted (status, deleted_at)
) $cc;" );
	}

	// ─── Attendance Tables ────────────────────────────────────────────────────

	private static function migrate_attendance_tables( string $cc ): void {
		dbDelta( "CREATE TABLE " . Schema::attendance() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id bigint(20) UNSIGNED NOT NULL,
  academic_session_id bigint(20) UNSIGNED NOT NULL,
  academic_unit_id bigint(20) UNSIGNED NOT NULL,
  academic_group_id bigint(20) UNSIGNED DEFAULT NULL,
  attendance_date date NOT NULL,
  status varchar(40) NOT NULL DEFAULT 'present',
  note text DEFAULT NULL,
  taken_by bigint(20) UNSIGNED DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY uq_student_date_session (student_id, attendance_date, academic_session_id),
  KEY idx_group_date (academic_group_id, attendance_date),
  KEY idx_session (academic_session_id),
  KEY idx_unit (academic_unit_id),
  KEY idx_group (academic_group_id),
  KEY idx_date (attendance_date),
  KEY idx_status (status),
  KEY idx_deleted (deleted_at)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::staff_attendance() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  staff_member_id bigint(20) UNSIGNED NOT NULL,
  attendance_date date NOT NULL,
  status varchar(40) NOT NULL DEFAULT 'present',
  note text DEFAULT NULL,
  taken_by bigint(20) UNSIGNED DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY uq_staff_date (staff_member_id, attendance_date),
  KEY idx_date (attendance_date),
  KEY idx_status (status),
  KEY idx_deleted (deleted_at)
) $cc;" );
	}

	// ─── Finance Tables ───────────────────────────────────────────────────────

	private static function migrate_finance_tables( string $cc ): void {
		dbDelta( "CREATE TABLE " . Schema::fee_types() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  name varchar(160) NOT NULL,
  code varchar(60) DEFAULT NULL,
  description text DEFAULT NULL,
  default_amount_minor bigint(20) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'USD',
  frequency varchar(40) NOT NULL DEFAULT 'one_time',
  scope varchar(20) NOT NULL DEFAULT 'global',
  status varchar(30) NOT NULL DEFAULT 'active',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY uq_code (code),
  KEY idx_status (status),
  KEY idx_scope (scope),
  KEY idx_deleted (deleted_at)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::invoices() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_number varchar(80) NOT NULL,
  student_id bigint(20) UNSIGNED NOT NULL,
  academic_session_id bigint(20) UNSIGNED NOT NULL,
  academic_term_id bigint(20) UNSIGNED DEFAULT NULL,
  academic_unit_id bigint(20) UNSIGNED DEFAULT NULL,
  academic_group_id bigint(20) UNSIGNED DEFAULT NULL,
  guardian_name varchar(180) DEFAULT NULL,
  guardian_email varchar(190) DEFAULT NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  issue_date date NOT NULL,
  due_date date DEFAULT NULL,
  subtotal_minor bigint(20) NOT NULL DEFAULT 0,
  discount_minor bigint(20) NOT NULL DEFAULT 0,
  tax_minor bigint(20) NOT NULL DEFAULT 0,
  total_minor bigint(20) NOT NULL DEFAULT 0,
  paid_minor bigint(20) NOT NULL DEFAULT 0,
  balance_minor bigint(20) NOT NULL DEFAULT 0,
  discount_note varchar(255) DEFAULT NULL,
  cancellation_reason varchar(255) DEFAULT NULL,
  status varchar(40) NOT NULL DEFAULT 'draft',
  created_by bigint(20) UNSIGNED DEFAULT NULL,
  updated_by bigint(20) UNSIGNED DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY uq_invoice_number (invoice_number),
  KEY idx_student (student_id),
  KEY idx_session (academic_session_id),
  KEY idx_term (academic_term_id),
  KEY idx_issue_date (issue_date),
  KEY idx_due_date (due_date),
  KEY idx_status (status),
  KEY idx_deleted (deleted_at)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::line_items() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id bigint(20) UNSIGNED NOT NULL,
  fee_type_id bigint(20) UNSIGNED DEFAULT NULL,
  description varchar(255) NOT NULL,
  quantity decimal(10,2) NOT NULL DEFAULT '1.00',
  unit_amount_minor bigint(20) NOT NULL DEFAULT 0,
  discount_minor bigint(20) NOT NULL DEFAULT 0,
  discount_type varchar(40) DEFAULT NULL,
  total_minor bigint(20) NOT NULL DEFAULT 0,
  tax_minor bigint(20) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY idx_invoice (invoice_id),
  KEY idx_fee_type (fee_type_id)
) $cc;" );

		dbDelta( "CREATE TABLE " . Schema::payments() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_number varchar(80) NOT NULL,
  invoice_id bigint(20) UNSIGNED NOT NULL,
  student_id bigint(20) UNSIGNED NOT NULL,
  academic_session_id bigint(20) UNSIGNED NOT NULL,
  amount_minor bigint(20) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'USD',
  method varchar(40) NOT NULL DEFAULT 'cash',
  payment_source varchar(20) NOT NULL DEFAULT 'manual',
  status varchar(40) NOT NULL DEFAULT 'completed',
  paid_on date NOT NULL,
  reference varchar(160) DEFAULT NULL,
  note text DEFAULT NULL,
  created_by bigint(20) UNSIGNED DEFAULT NULL,
  updated_by bigint(20) UNSIGNED DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at datetime DEFAULT NULL,
  cancellation_reason varchar(80) DEFAULT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY uq_payment_number (payment_number),
  KEY idx_invoice (invoice_id),
  KEY idx_student (student_id),
  KEY idx_session (academic_session_id),
  KEY idx_paid_on (paid_on),
  KEY idx_source (payment_source),
  KEY idx_status (status),
  KEY idx_deleted (deleted_at)
) $cc;" );

		// v1.0.9: Per-class fee rate overrides.
		// Allows schools to charge different amounts for the same fee type per academic unit (class/grade).
		// Falls back to fee_type.default_amount_minor when no override exists.
		dbDelta( "CREATE TABLE " . Schema::fee_type_class_rates() . " (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  fee_type_id bigint(20) UNSIGNED NOT NULL,
  academic_unit_id bigint(20) UNSIGNED NOT NULL,
  amount_minor bigint(20) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'USD',
  created_by bigint(20) UNSIGNED DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  UNIQUE KEY uq_fee_class (fee_type_id, academic_unit_id),
  KEY idx_fee_type (fee_type_id),
  KEY idx_unit (academic_unit_id)
) $cc;" );
	}

	// ─── Private Helpers ─────────────────────────────────────────────────────

	/**
	 * Returns the CHARACTER SET COLLATE string for the current WordPress DB.
	 */
	private static function charset_collate(): string {
		global $wpdb;
		return $wpdb->get_charset_collate();
	}

}

