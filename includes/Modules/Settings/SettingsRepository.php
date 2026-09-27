<?php
/**
 * Settings repository.
 *
 * Handles reading and writing consolidated Nexora settings stored in a single
 * WordPress option. Implements deep merging with default values to guarantee
 * that all configuration keys are always defined.
 *
 * @package Nexora\Modules\Settings
 */

declare( strict_types=1 );

namespace Nexora\Modules\Settings;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class SettingsRepository
 */
final class SettingsRepository {

	/**
	 * WordPress option name for Nexora settings.
	 */
	private const OPTION_NAME = 'nexora_settings';

	/**
	 * Gets the complete consolidated settings array, merged with defaults.
	 *
	 * @param bool $mask_sensitive Whether to mask sensitive values.
	 * @return array
	 */
	public function get_settings( bool $mask_sensitive = false ): array {
		$stored = get_option( self::OPTION_NAME, [] );
		if ( ! is_array( $stored ) ) {
			$stored = [];
		}

		$defaults = $this->get_defaults();
		$settings = $this->deep_merge( $defaults, $stored );
		$settings = $this->filter_known_settings( $settings, $defaults );

		// Normalize values written by earlier settings implementations.
		if ( ! in_array( $settings['localization']['time_format'], [ 'H:i', 'h:i A' ], true ) ) {
			$settings['localization']['time_format'] = $defaults['localization']['time_format'];
		}
		if ( '' === trim( (string) $settings['localization']['timezone'] ) ) {
			$settings['localization']['timezone'] = $defaults['localization']['timezone'];
		}
		if ( empty( $settings['school']['logo'] ) ) {
			$settings['school']['logo'] = $defaults['school']['logo'];
		}
		if ( empty( $settings['school']['signature'] ) ) {
			$settings['school']['signature'] = $defaults['school']['signature'];
		}

		if ( $mask_sensitive ) {
			if ( ! empty( $settings['notifications']['smtp_password'] ) ) {
				$settings['notifications']['smtp_password'] = '********';
			}
		if ( defined( 'NEXORA_IS_PRO' ) && NEXORA_IS_PRO ) {
				if ( ! empty( $settings['notifications']['twilio_auth_token'] ) ) {
					$settings['notifications']['twilio_auth_token'] = '********';
				}
				if ( ! empty( $settings['notifications']['msg91_auth_key'] ) ) {
					$settings['notifications']['msg91_auth_key'] = '********';
				}
				if ( ! empty( $settings['notifications']['fast2sms_api_key'] ) ) {
					$settings['notifications']['fast2sms_api_key'] = '********';
				}
				if ( ! empty( $settings['notifications']['vonage_api_secret'] ) ) {
					$settings['notifications']['vonage_api_secret'] = '********';
				}
			}
		}

		return $settings;
	}

	/**
	 * Updates the settings array in the WordPress database.
	 *
	 * Returns the fully merged settings that were persisted, so callers do not
	 * need a second get_settings() call to retrieve the saved state.
	 *
	 * @param array $settings New settings to merge and save.
	 * @return array The saved settings array.
	 */
	public function update_settings( array $settings ): array {
		$current = $this->get_settings();

		// Handle SMTP password masking to prevent overwriting with placeholder.
		if ( isset( $settings['notifications']['smtp_password'] ) && '********' === $settings['notifications']['smtp_password'] ) {
			if ( ! empty( $current['notifications']['smtp_password'] ) ) {
				$settings['notifications']['smtp_password'] = $current['notifications']['smtp_password'];
			} else {
				$settings['notifications']['smtp_password'] = '';
			}
		}

		// Handle SMS provider credential masking (Pro-only keys).
		if ( defined( 'NEXORA_IS_PRO' ) && NEXORA_IS_PRO ) {
			foreach ( [ 'twilio_auth_token', 'msg91_auth_key', 'fast2sms_api_key', 'vonage_api_secret' ] as $key ) {
				if ( isset( $settings['notifications'][ $key ] ) && '********' === $settings['notifications'][ $key ] ) {
					$settings['notifications'][ $key ] = ! empty( $current['notifications'][ $key ] )
						? $current['notifications'][ $key ]
						: '';
				}
			}
		}

		$merged  = $this->deep_merge( $current, $settings );

		// Clean up fields that might be empty/null or require sanitization.
		$merged = $this->sanitize_settings( $merged );

		// Detect if manual settings deviate from the active preset defaults.
		$merged['education_system']['customized'] = $this->detect_customizations( $merged );

		// Always update the stored schema and plugin versions just in case.
		$merged['schema_version'] = NEXORA_DB_VERSION;
		$merged['plugin_version'] = NEXORA_VERSION;

		update_option( self::OPTION_NAME, $merged, false );

		return $merged;
	}

	/**
	 * Returns the comprehensive set of default values for Nexora.
	 *
	 * @return array
	 */
	public function get_defaults(): array {
		return [
			'schema_version'   => NEXORA_DB_VERSION,
			'plugin_version'   => NEXORA_VERSION,
			'school'           => [
				'name'      => get_bloginfo( 'name' ),
				'code'      => '',
				'logo'      => NEXORA_URL . 'assets/defaults/logo.svg',
				'signature' => NEXORA_URL . 'assets/defaults/signature.svg',
				'email'     => get_bloginfo( 'admin_email' ),
				'phone'     => '',
				'website'   => get_bloginfo( 'url' ),
				'address'   => '',
			],
			'education_system' => [
				'preset'                    => null, // 'IN', 'US', 'GB', or null (for custom)
				'preset_name'               => null,
				'preset_version'            => null,
				'customized'                => false,
				'academic_year_start_month' => 1,
				'academic_year_end_month'   => 12,
				'default_number_terms'      => 3,
				'grading_default'           => 'marks_percentage',
				'default_academic_units'    => [],
				'default_groups_per_unit'   => [],
				'new_session_classes_creation' => 'clone',
			],
			'labels'           => $this->get_default_labels(),
			'admissions'       => [
				'enable_public_form'      => true,
				'enable_status_lookup'    => true,
				'require_approval'        => true, // V1 always true
				'default_status'          => 'submitted',
				'allowed_statuses'        => [
					'inquiry',
					'submitted',
					'under_review',
					'more_info_needed',
					'interview_scheduled',
					'accepted',
					'waitlisted',
					'rejected',
					'admitted',
					'withdrawn',
				],
				'required_documents'      => [],
				'notification_recipients' => get_bloginfo( 'admin_email' ),
				'verification_fields'     => [ 'reference_number', 'student_date_of_birth' ],
				'auto_convert'            => false,
			],
			'staff_onboarding' => [
				'enable_form'             => true,
				'enable_status_lookup'    => true,
				'require_approval'        => true, // V1 always true
				'default_status'          => 'submitted',
				'allowed_statuses'        => [
					'submitted',
					'under_review',
					'more_info_needed',
					'interview_scheduled',
					'offer_sent',
					'accepted',
					'rejected',
					'hired',
					'withdrawn',
				],
				'required_documents'      => [],
				'notification_recipients' => get_bloginfo( 'admin_email' ),
				'verification_fields'     => [ 'reference_number', 'email' ],
				'login_creation_behavior' => 'invite', // 'immediate', 'invite', 'profile_only'
				'default_role'            => 'staff',
			],
			'identifiers'      => $this->get_default_identifiers(),
			'localization'     => [
				'language'          => 'en',
				'date_format'       => 'd/m/Y',
				'time_format'       => 'H:i',
				'week_start_day'    => 1, // Monday
				'timezone'          => 'UTC',
				'currency'          => 'USD',
				'currency_position' => 'left',
				'decimal_precision' => 2,
				'number_format'     => 'standard',
				'rtl'               => false,
			],
			'appearance'       => [
				'mode'            => 'light',
				'layout'          => 'boxed',
				'sidebar_density' => 'comfortable',
				'table_density'   => 'comfortable',
				'theme_color'     => 'classic_indigo',
				'ui_scale'        => '100%',
			],
			'system'           => [
				'debug_logging'      => false,
				'log_retention_days' => 0,
			],
			'notifications'    => [
				'in_app_events' => [
					'notify_admission_received' => true,
					'notify_admission_status'   => true,
					'notify_invoice_issued'     => true,
					'notify_payment_recorded'   => true,
					'notify_invoice_overdue'    => true,
					'notify_attendance_taken'   => true,
				],
				'mail_driver'   => 'wp_mail', // 'wp_mail' | 'smtp'
				'sender_name'   => get_bloginfo( 'name' ),
				'sender_email'  => get_bloginfo( 'admin_email' ),
				'smtp_host'     => '',
				'smtp_port'     => 587,
				'smtp_secure'   => 'tls', // 'none' | 'ssl' | 'tls'
				'smtp_auth'     => true,
				'smtp_username' => '',
				'smtp_password' => '',
				'templates'     => [
					'admission_received'       => [
						'enabled' => true,
						'subject' => 'New Admission Application Received',
						'body'    => "Dear {school_name} Team,\n\nA new admission application has been received.\n\nApplicant: {student_name}\nReference: {reference_number}\nGuardian: {guardian_name}\nGuardian Email: {guardian_email}\n\nPlease log in to review this application.\n\nRegards,\n{school_name}",
						'send_to_student' => false,
						'send_to_guardian' => false,
					],
					'admission_status_changed' => [
						'enabled' => true,
						'subject' => 'Your Application Status Has Been Updated',
						'body'    => "Dear {guardian_name},\n\nThe status of {student_name}'s application has been updated to: {status}\n\nReference: {reference_number}\n\nFor any queries, please contact us at {school_email}.\n\nRegards,\n{school_name}",
						'send_to_student' => false,
						'send_to_guardian' => true,
					],
					'payment_recorded'         => [
						'enabled' => true,
						'subject' => 'Payment Receipt — {invoice_number}',
						'body'    => "Dear {guardian_name},\n\nWe have received a payment of {amount} against invoice {invoice_number}.\n\nDate: {payment_date}\nMethod: {payment_method}\nReference: {payment_reference}\nRemaining Balance: {balance}\n\nThank you.\n\nRegards,\n{school_name}",
						'send_to_student' => false,
						'send_to_guardian' => true,
					],
					'attendance_alert'         => [
						'enabled' => false,
						'subject' => 'Attendance Alert — {student_name}',
						'body'    => "Dear {guardian_name},\n\n{student_name} was marked {status} on {date}.\n\nIf you believe this is incorrect, please contact the school.\n\nRegards,\n{school_name}",
						'send_to_student' => false,
						'send_to_guardian' => true,
					],
					'fee_reminder'             => [
						'enabled' => true,
						'subject' => 'Fee Payment Reminder — {invoice_number}',
						'body'    => "Dear {guardian_name},\n\nThis is a reminder that invoice {invoice_number} for {amount} is due on {due_date}.\n\nCurrent Balance: {balance}\n\nPlease make payment at your earliest convenience.\n\nRegards,\n{school_name}",
						'send_to_student' => false,
						'send_to_guardian' => true,
					],
					'invoice_issued'           => [
						'enabled' => true,
						'subject' => 'New Invoice Issued — {invoice_number}',
						'body'    => "Dear {guardian_name},\n\nA new invoice {invoice_number} has been generated for {amount}.\n\nDue Date: {due_date}\n\nPlease review the invoice details and proceed with the payment.\n\nRegards,\n{school_name}",
						'send_to_student' => false,
						'send_to_guardian' => true,
					],
					'invoice_overdue'          => [
						'enabled' => true,
						'subject' => 'Overdue Fee Notice — {invoice_number}',
						'body'    => "Dear {guardian_name},\n\nThis is to notify you that invoice {invoice_number} is now overdue.\n\nOutstanding Balance: {balance}\nOriginal Due Date: {due_date}\n\nPlease clear the outstanding dues immediately to avoid late fees.\n\nRegards,\n{school_name}",
						'send_to_student' => false,
						'send_to_guardian' => true,
					],
					'payment_reversed'         => [
						'enabled' => true,
						'subject' => 'Payment Cancelled / Reversed — {invoice_number}',
						'body'    => "Dear {guardian_name},\n\nWe would like to inform you that payment {payment_number} of {amount} against invoice {invoice_number} has been cancelled or reversed.\n\nPlease check your account statement or contact the school office if you have any questions.\n\nRegards,\n{school_name}",
						'send_to_student' => false,
						'send_to_guardian' => true,
					],
				],
				...( defined( 'NEXORA_IS_PRO' ) && NEXORA_IS_PRO ? [
					'sms_enabled'        => false,
					'sms_provider'       => 'none',
					'twilio_account_sid' => '',
					'twilio_auth_token'  => '',
					'twilio_from_number' => '',
					'msg91_auth_key'     => '',
					'msg91_sender_id'    => '',
					'fast2sms_api_key'   => '',
					'vonage_api_key'     => '',
					'vonage_api_secret'  => '',
					'vonage_from'        => '',
					'sms_templates'      => [],
				] : [] ),
			],
		];
	}

	/**
	 * Returns default labels for all core entities.
	 *
	 * @return array
	 */
	public function get_default_labels(): array {
		return [
			'academic_session'         => [ 'singular' => 'Academic Session', 'plural' => 'Academic Sessions' ],
			'academic_term'            => [ 'singular' => 'Academic Term', 'plural' => 'Academic Terms' ],
			'academic_unit'            => [ 'singular' => 'Academic Unit', 'plural' => 'Academic Units' ],
			'academic_group'           => [ 'singular' => 'Academic Group', 'plural' => 'Academic Groups' ],
			'subject'                  => [ 'singular' => 'Subject', 'plural' => 'Subjects' ],
			'assessment'               => [ 'singular' => 'Assessment', 'plural' => 'Assessments' ],
			'guardian'                 => [ 'singular' => 'Guardian', 'plural' => 'Guardians' ],
			'student_guardian'         => [ 'singular' => 'Student Guardian', 'plural' => 'Student Guardians' ],
			'admission_application'    => [ 'singular' => 'Admission Application', 'plural' => 'Admission Applications' ],
			'admission_status'         => [ 'singular' => 'Admission Status', 'plural' => 'Admission Statuses' ],
			'staff_application'        => [ 'singular' => 'Staff Application', 'plural' => 'Staff Applications' ],
			'staff_application_status' => [ 'singular' => 'Staff Application Status', 'plural' => 'Staff Application Statuses' ],
			'student'                  => [ 'singular' => 'Student', 'plural' => 'Students' ],
			'staff_member'             => [ 'singular' => 'Staff Member', 'plural' => 'Staff Members' ],
			'fee_type'                 => [ 'singular' => 'Fee Type', 'plural' => 'Fee Types' ],
			'invoice_line_item'        => [ 'singular' => 'Invoice Line Item', 'plural' => 'Invoice Line Items' ],
			'invoice'                  => [ 'singular' => 'Invoice', 'plural' => 'Invoices' ],
			'payment'                  => [ 'singular' => 'Payment', 'plural' => 'Payments' ],
			'attendance_record'        => [ 'singular' => 'Attendance Record', 'plural' => 'Attendance Records' ],
		];
	}

	/**
	 * Returns default settings for generated identifiers.
	 *
	 * @return array
	 */
	public function get_default_identifiers(): array {
		return [
			'admission_application' => [
				'prefix'           => 'APP',
				'year_token'       => '{YYYY}',
				'sequence_padding' => 4,
				'next_number'      => 1,
				'reset_rule'       => 'yearly',
				'separator'        => '',
			],
			'staff_application'     => [
				'prefix'           => 'STFAPP',
				'year_token'       => '{YYYY}',
				'sequence_padding' => 4,
				'next_number'      => 1,
				'reset_rule'       => 'yearly',
				'separator'        => '',
			],
			'admission_number'      => [
				'prefix'           => 'ADM',
				'year_token'       => '{YYYY}',
				'sequence_padding' => 4,
				'next_number'      => 1,
				'reset_rule'       => 'yearly',
				'separator'        => '',
			],
			'student_number'        => [
				'prefix'           => 'STU',
				'year_token'       => '{YYYY}',
				'sequence_padding' => 4,
				'next_number'      => 1,
				'reset_rule'       => 'yearly',
				'separator'        => '',
			],
			'staff_member'          => [
				'prefix'           => 'EMP',
				'year_token'       => '{YYYY}',
				'sequence_padding' => 4,
				'next_number'      => 1,
				'reset_rule'       => 'yearly',
				'separator'        => '',
			],
			'roll_number'           => [
				'prefix'           => '',
				'year_token'       => '',
				'sequence_padding' => 3,
				'next_number'      => 1,
				'reset_rule'       => 'none',
				'separator'        => '',
			],
			'invoice_number'        => [
				'prefix'           => 'INV',
				'year_token'       => '{YYYY}',
				'sequence_padding' => 5,
				'next_number'      => 10001,
				'reset_rule'       => 'none',
				'separator'        => '',
			],
			'payment_number'        => [
				'prefix'           => 'PAY',
				'year_token'       => '{YYYY}',
				'sequence_padding' => 5,
				'next_number'      => 10001,
				'reset_rule'       => 'none',
				'separator'        => '',
			],
		];
	}

	/**
	 * Sanitizes setting values before database persistence.
	 *
	 * @param array $settings
	 * @return array
	 */
	private function sanitize_settings( array $settings ): array {
		if ( isset( $settings['school']['email'] ) ) {
			$settings['school']['email'] = sanitize_email( $settings['school']['email'] );
		}
		if ( isset( $settings['school']['website'] ) ) {
			$settings['school']['website'] = esc_url_raw( $settings['school']['website'] );
		}
		if ( isset( $settings['admissions']['notification_recipients'] ) && is_string( $settings['admissions']['notification_recipients'] ) ) {
			$settings['admissions']['notification_recipients'] = implode( ',', array_map( 'sanitize_email', array_filter( array_map( 'trim', explode( ',', $settings['admissions']['notification_recipients'] ) ) ) ) );
		}
		if ( isset( $settings['staff_onboarding']['notification_recipients'] ) && is_string( $settings['staff_onboarding']['notification_recipients'] ) ) {
			$settings['staff_onboarding']['notification_recipients'] = implode( ',', array_map( 'sanitize_email', array_filter( array_map( 'trim', explode( ',', $settings['staff_onboarding']['notification_recipients'] ) ) ) ) );
		}

		return $settings;
	}

	/**
	 * Detects whether the settings have been customized relative to the selected preset.
	 *
	 * Also callable externally as detect_customizations_for() by PresetsService
	 * so both places share the same comparison logic without duplication.
	 *
	 * @param array $settings Updated settings array.
	 * @return bool True if customized.
	 */
	public function detect_customizations( array $settings ): bool {
		$preset_code = $settings['education_system']['preset'] ?? null;
		if ( ! $preset_code ) {
			return false;
		}

		$presets_service = new PresetsService();
		$preset_data = $presets_service->get_preset_data( $preset_code );
		if ( ! $preset_data ) {
			return false;
		}

		// Compare education_system settings (excluding preset meta fields and class seeding strategy)
		$exclude_system_keys = [ 'preset', 'preset_name', 'preset_version', 'customized', 'new_session_classes_creation' ];
		foreach ( $preset_data['education_system'] as $key => $val ) {
			if ( in_array( $key, $exclude_system_keys, true ) ) {
				continue;
			}
			if ( isset( $settings['education_system'][ $key ] ) && $settings['education_system'][ $key ] !== $val ) {
				return true;
			}
		}

		// Compare terminology labels
		foreach ( $preset_data['labels'] as $key => $val ) {
			if ( ! isset( $settings['labels'][ $key ] ) ) {
				continue;
			}
			// Comparing arrays of singular/plural
			if ( is_array( $val ) ) {
				foreach ( $val as $sub_key => $sub_val ) {
					if ( isset( $settings['labels'][ $key ][ $sub_key ] ) && $settings['labels'][ $key ][ $sub_key ] !== $sub_val ) {
						return true;
					}
				}
			} else {
				if ( $settings['labels'][ $key ] !== $val ) {
					return true;
				}
			}
		}

		// Compare localization settings
		foreach ( $preset_data['localization'] as $key => $val ) {
			if ( isset( $settings['localization'][ $key ] ) && $settings['localization'][ $key ] !== $val ) {
				return true;
			}
		}

		// Compare identifiers settings
		if ( isset( $preset_data['identifiers'] ) && is_array( $preset_data['identifiers'] ) ) {
			foreach ( $preset_data['identifiers'] as $key => $val ) {
				if ( ! isset( $settings['identifiers'][ $key ] ) ) {
					continue;
				}
				if ( is_array( $val ) ) {
					foreach ( $val as $sub_key => $sub_val ) {
						if ( isset( $settings['identifiers'][ $key ][ $sub_key ] ) && $settings['identifiers'][ $key ][ $sub_key ] !== $sub_val ) {
							return true;
						}
					}
				} else {
					if ( $settings['identifiers'][ $key ] !== $val ) {
						return true;
					}
				}
			}
		}

		return false;
	}

	/**
	 * Recursively merges two associative arrays.
	 *
	 * @param array $default
	 * @param array $override
	 * @return array
	 */
	private function deep_merge( array $default, array $override ): array {
		$merged = $default;

		foreach ( $override as $key => $value ) {
			if ( is_array( $value ) && isset( $merged[ $key ] ) && is_array( $merged[ $key ] ) ) {
				// Check if the array is sequential/numeric to avoid recursive index overwrite
				if ( [] === $value || array_is_list( $value ) ) {
					$merged[ $key ] = $value;
				} else {
					$merged[ $key ] = $this->deep_merge( $merged[ $key ], $value );
				}
			} else {
				$merged[ $key ] = $value;
			}
		}

		return $merged;
	}

	/**
	 * Removes legacy or unknown keys while preserving list values.
	 *
	 * The default settings shape is the canonical storage contract. Filtering
	 * here prevents old option keys from being echoed back into strict PATCH
	 * requests by the admin application.
	 *
	 * @param array $settings Resolved settings.
	 * @param array $schema   Canonical default shape.
	 */
	private function filter_known_settings( array $settings, array $schema ): array {
		$filtered = [];

		foreach ( $schema as $key => $default_value ) {
			$value = array_key_exists( $key, $settings ) ? $settings[ $key ] : $default_value;

			if ( is_array( $default_value ) && is_array( $value ) && ! array_is_list( $default_value ) ) {
				$filtered[ $key ] = $this->filter_known_settings( $value, $default_value );
			} else {
				$filtered[ $key ] = $value;
			}
		}

		return $filtered;
	}

	/**
	 * Public alias for external callers (PresetsService) who need to evaluate
	 * customisation drift without going through the full update_settings() path.
	 *
	 * @param array $settings Settings array to compare against the active preset.
	 * @return bool True if customized relative to the preset.
	 */
	public function detect_customizations_for( array $settings ): bool {
		return $this->detect_customizations( $settings );
	}
}
