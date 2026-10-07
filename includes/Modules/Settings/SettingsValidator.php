<?php
/**
 * Settings payload validation.
 *
 * Keeps the REST boundary authoritative by rejecting unknown keys and
 * normalizing all accepted values before they reach persistence.
 *
 * @package CodeClove\Modules\Settings
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Settings;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_Error;

/**
 * Class SettingsValidator
 */
final class SettingsValidator {

	private const IDENTIFIER_KEYS = [
		'admission_application',
		'staff_application',
		'admission_number',
		'student_number',
		'staff_member',
		'roll_number',
		'invoice_number',
		'payment_number',
	];

	private const ADMISSION_STATUSES = [
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
	];

	private const STAFF_STATUSES = [
		'submitted',
		'under_review',
		'more_info_needed',
		'interview_scheduled',
		'offer_sent',
		'accepted',
		'rejected',
		'hired',
		'withdrawn',
	];

	/**
	 * Validates and sanitizes a partial settings payload.
	 *
	 * @param array $payload Raw REST payload.
	 * @return array|WP_Error
	 */
	public function validate_patch( array $payload ): array|WP_Error {
		$allowed_sections = [
			'schema_version',
			'plugin_version',
			'school',
			'education_system',
			'labels',
			'admissions',
			'staff_onboarding',
			'identifiers',
			'localization',
			'appearance',
			'system',
			'notifications',
			'payment_gateways',
			'payment_methods',
			'finance',
		];
		$error = $this->reject_unknown_keys( $payload, $allowed_sections, 'settings' );
		if ( $error ) {
			return $error;
		}

		// Version values are server-owned and never accepted from clients.
		unset( $payload['schema_version'], $payload['plugin_version'] );

		$validated = [];

		foreach ( $payload as $section => $values ) {
			if ( ! is_array( $values ) ) {
				return $this->invalid( $section, 'must be an object.' );
			}

			$result = match ( $section ) {
				'school'           => $this->validate_school( $values ),
				'education_system' => $this->validate_education_system( $values ),
				'labels'           => $this->validate_labels( $values ),
				'admissions'       => $this->validate_admissions( $values ),
				'staff_onboarding' => $this->validate_staff_onboarding( $values ),
				'identifiers'      => $this->validate_identifiers( $values ),
				'localization'     => $this->validate_localization( $values ),
				'appearance'       => $this->validate_appearance( $values ),
				'system'           => $this->validate_system( $values ),
				'notifications'    => $this->validate_notifications( $values ),
				'payment_methods'  => $this->validate_payment_methods( $values ),
				'payment_gateways' => $this->validate_payment_gateways( $values ),
				'finance'          => $this->validate_finance( $values ),
				default            => [],
			};

			if ( is_wp_error( $result ) ) {
				return $result;
			}

			$validated[ $section ] = $result;
		}

		return $validated;
	}

	/**
	 * @param array $values Section values.
	 * @return array|WP_Error
	 */
	private function validate_school( array $values ): array|WP_Error {
		$error = $this->reject_unknown_keys(
			$values,
			[ 'name', 'code', 'logo', 'signature', 'email', 'phone', 'website', 'address' ],
			'school'
		);
		if ( $error ) {
			return $error;
		}

		$result = [];
		foreach ( $values as $key => $value ) {
			if ( ! is_scalar( $value ) && null !== $value ) {
				return $this->invalid( "school.{$key}", 'must be text.' );
			}

			$text = trim( (string) $value );
			$result[ $key ] = match ( $key ) {
				'email'   => sanitize_email( $text ),
				'website' => esc_url_raw( $text ),
				'address' => sanitize_textarea_field( $text ),
				default   => sanitize_text_field( $text ),
			};

			if ( 'email' === $key && '' !== $text && ! is_email( $result[ $key ] ) ) {
				return $this->invalid( 'school.email', 'must be a valid email address.' );
			}
		}

		return $result;
	}

	/**
	 * @param array $values Section values.
	 * @return array|WP_Error
	 */
	private function validate_education_system( array $values ): array|WP_Error {
		$error = $this->reject_unknown_keys(
			$values,
			[
				'preset',
				'preset_name',
				'preset_version',
				'customized',
				'academic_year_start_month',
				'academic_year_end_month',
				'default_number_terms',
				'grading_default',
				'default_academic_units',
				'default_groups_per_unit',
				'new_session_classes_creation',
			],
			'education_system'
		);
		if ( $error ) {
			return $error;
		}

		$result = [];
		foreach ( $values as $key => $value ) {
			switch ( $key ) {
				case 'preset':
					if ( null !== $value && ! in_array( $value, [ 'IN', 'US', 'GB' ], true ) ) {
						return $this->invalid( 'education_system.preset', 'must be IN, US, GB, or null.' );
					}
					$result[ $key ] = $value;
					break;
				case 'preset_name':
				$result[ $key ] = null === $value ? null : sanitize_text_field( (string) $value );
					break;
				case 'preset_version':
					if ( null !== $value && ! preg_match( '/^\d+\.\d+\.\d+$/', (string) $value ) ) {
						return $this->invalid( 'education_system.preset_version', 'must be a semantic version or null.' );
					}
					$result[ $key ] = null === $value ? null : (string) $value;
					break;
				case 'customized':
					$boolean = $this->to_bool( $value );
					if ( null === $boolean ) {
						return $this->invalid( 'education_system.customized', 'must be a boolean.' );
					}
					$result[ $key ] = $boolean;
					break;
				case 'academic_year_start_month':
				case 'academic_year_end_month':
					$month = $this->to_int( $value );
					if ( null === $month || $month < 1 || $month > 12 ) {
						return $this->invalid( "education_system.{$key}", 'must be between 1 and 12.' );
					}
					$result[ $key ] = $month;
					break;
				case 'default_number_terms':
					$count = $this->to_int( $value );
					if ( null === $count || $count < 1 || $count > 6 ) {
						return $this->invalid( 'education_system.default_number_terms', 'must be between 1 and 6.' );
					}
					$result[ $key ] = $count;
					break;
				case 'grading_default':
					if ( ! in_array( $value, [ 'marks_percentage', 'letter_gpa', 'levels_marks' ], true ) ) {
						return $this->invalid( 'education_system.grading_default', 'contains an unsupported grading scheme.' );
					}
					$result[ $key ] = $value;
					break;
				case 'default_academic_units':
				case 'default_groups_per_unit':
					$list = $this->sanitize_string_list( $value, "education_system.{$key}" );
					if ( is_wp_error( $list ) ) {
						return $list;
					}
					$result[ $key ] = $list;
					break;
				case 'new_session_classes_creation':
					if ( ! in_array( $value, [ 'clone', 'defaults' ], true ) ) {
						return $this->invalid( 'education_system.new_session_classes_creation', 'must be clone or defaults.' );
					}
					$result[ $key ] = $value;
					break;
			}
		}

		return $result;
	}

	/**
	 * @param array $values Section values.
	 * @return array|WP_Error
	 */
	private function validate_labels( array $values ): array|WP_Error {
		// Derive allowed keys from the repository — single source of truth.
		// ponytail: was a hardcoded LABEL_KEYS constant that had to be kept in
		// sync with SettingsRepository::get_default_labels() manually.
		$allowed_keys = array_keys( ( new SettingsRepository() )->get_default_labels() );
		$error = $this->reject_unknown_keys( $values, $allowed_keys, 'labels' );
		if ( $error ) {
			return $error;
		}

		$result = [];
		foreach ( $values as $key => $label ) {
			if ( ! is_array( $label ) ) {
				return $this->invalid( "labels.{$key}", 'must be an object.' );
			}
			$error = $this->reject_unknown_keys( $label, [ 'singular', 'plural' ], "labels.{$key}" );
			if ( $error ) {
				return $error;
			}

			$result[ $key ] = [];
			foreach ( $label as $form => $value ) {
				$text = sanitize_text_field( (string) $value );
				if ( '' === $text ) {
					return $this->invalid( "labels.{$key}.{$form}", 'cannot be empty.' );
				}
				$result[ $key ][ $form ] = $text;
			}
		}

		return $result;
	}

	/**
	 * @param array $values Section values.
	 * @return array|WP_Error
	 */
	private function validate_admissions( array $values ): array|WP_Error {
		$error = $this->reject_unknown_keys(
			$values,
			[
				'enable_public_form',
				'enable_status_lookup',
				'require_approval',
				'default_status',
				'allowed_statuses',
				'required_documents',
				'notification_recipients',
				'verification_fields',
				'auto_convert',
			],
			'admissions'
		);
		if ( $error ) {
			return $error;
		}

		$result = [];
		foreach ( $values as $key => $value ) {
			if ( in_array( $key, [ 'enable_public_form', 'enable_status_lookup', 'auto_convert' ], true ) ) {
				$boolean = $this->to_bool( $value );
				if ( null === $boolean ) {
					return $this->invalid( "admissions.{$key}", 'must be a boolean.' );
				}
				$result[ $key ] = $boolean;
			} elseif ( 'require_approval' === $key ) {
				$result[ $key ] = true;
			} elseif ( 'default_status' === $key ) {
				$status = sanitize_key( (string) $value );
				if ( ! in_array( $status, self::ADMISSION_STATUSES, true ) ) {
					return $this->invalid( "admissions.{$key}", 'contains an unsupported status.' );
				}
				$result[ $key ] = $status;
			} elseif ( 'allowed_statuses' === $key ) {
				$list = $this->sanitize_enum_list( $value, self::ADMISSION_STATUSES, 'admissions.allowed_statuses' );
				if ( is_wp_error( $list ) ) {
					return $list;
				}
				$result[ $key ] = $list;
			} elseif ( in_array( $key, [ 'required_documents', 'verification_fields' ], true ) ) {
				$list = $this->sanitize_string_list( $value, "admissions.{$key}", 'verification_fields' === $key );
				if ( is_wp_error( $list ) ) {
					return $list;
				}
				$result[ $key ] = $list;
			} elseif ( 'notification_recipients' === $key ) {
				$emails = $this->sanitize_email_list( $value, 'admissions.notification_recipients' );
				if ( is_wp_error( $emails ) ) {
					return $emails;
				}
				$result[ $key ] = $emails;
			}
		}

		$result['require_approval'] = true;

		return $result;
	}

	/**
	 * @param array $values Section values.
	 * @return array|WP_Error
	 */
	private function validate_staff_onboarding( array $values ): array|WP_Error {
		$error = $this->reject_unknown_keys(
			$values,
			[
				'enable_form',
				'enable_status_lookup',
				'require_approval',
				'default_status',
				'allowed_statuses',
				'required_documents',
				'notification_recipients',
				'verification_fields',
				'login_creation_behavior',
				'default_role',
			],
			'staff_onboarding'
		);
		if ( $error ) {
			return $error;
		}

		$result = [];
		foreach ( $values as $key => $value ) {
			if ( in_array( $key, [ 'enable_form', 'enable_status_lookup' ], true ) ) {
				$boolean = $this->to_bool( $value );
				if ( null === $boolean ) {
					return $this->invalid( "staff_onboarding.{$key}", 'must be a boolean.' );
				}
				$result[ $key ] = $boolean;
			} elseif ( 'require_approval' === $key ) {
				$result[ $key ] = true;
			} elseif ( 'default_status' === $key ) {
				$status = sanitize_key( (string) $value );
				if ( ! in_array( $status, self::STAFF_STATUSES, true ) ) {
					return $this->invalid( 'staff_onboarding.default_status', 'contains an unsupported status.' );
				}
				$result[ $key ] = $status;
			} elseif ( 'allowed_statuses' === $key ) {
				$list = $this->sanitize_enum_list( $value, self::STAFF_STATUSES, 'staff_onboarding.allowed_statuses' );
				if ( is_wp_error( $list ) ) {
					return $list;
				}
				$result[ $key ] = $list;
			} elseif ( in_array( $key, [ 'required_documents', 'verification_fields' ], true ) ) {
				$list = $this->sanitize_string_list( $value, "staff_onboarding.{$key}", 'verification_fields' === $key );
				if ( is_wp_error( $list ) ) {
					return $list;
				}
				$result[ $key ] = $list;
			} elseif ( 'notification_recipients' === $key ) {
				$emails = $this->sanitize_email_list( $value, 'staff_onboarding.notification_recipients' );
				if ( is_wp_error( $emails ) ) {
					return $emails;
				}
				$result[ $key ] = $emails;
			} elseif ( 'login_creation_behavior' === $key ) {
				if ( ! in_array( $value, [ 'immediate', 'invite', 'profile_only' ], true ) ) {
					return $this->invalid( 'staff_onboarding.login_creation_behavior', 'contains an unsupported behavior.' );
				}
				$result[ $key ] = $value;
			} elseif ( 'default_role' === $key ) {
				$result[ $key ] = sanitize_key( (string) $value );
			}
		}

		$result['require_approval'] = true;

		return $result;
	}

	/**
	 * @param array $values Section values.
	 * @return array|WP_Error
	 */
	private function validate_identifiers( array $values ): array|WP_Error {
		$error = $this->reject_unknown_keys( $values, self::IDENTIFIER_KEYS, 'identifiers' );
		if ( $error ) {
			return $error;
		}

		$result = [];
		foreach ( $values as $identifier => $config ) {
			if ( ! is_array( $config ) ) {
				return $this->invalid( "identifiers.{$identifier}", 'must be an object.' );
			}
			$error = $this->reject_unknown_keys(
				$config,
				[ 'prefix', 'year_token', 'sequence_padding', 'next_number', 'reset_rule', 'separator' ],
				"identifiers.{$identifier}"
			);
			if ( $error ) {
				return $error;
			}

			$result[ $identifier ] = [];
			foreach ( $config as $key => $value ) {
				if ( in_array( $key, [ 'prefix', 'year_token' ], true ) ) {
					$result[ $identifier ][ $key ] = sanitize_text_field( (string) $value );
				} elseif ( 'sequence_padding' === $key ) {
					$number = $this->to_int( $value );
					if ( null === $number || $number < 1 || $number > 10 ) {
						return $this->invalid( "identifiers.{$identifier}.sequence_padding", 'must be between 1 and 10.' );
					}
					$result[ $identifier ][ $key ] = $number;
				} elseif ( 'next_number' === $key ) {
					$number = $this->to_int( $value );
					if ( null === $number || $number < 1 ) {
						return $this->invalid( "identifiers.{$identifier}.next_number", 'must be at least 1.' );
					}
					$result[ $identifier ][ $key ] = $number;
				} elseif ( 'reset_rule' === $key ) {
					if ( ! in_array( $value, [ 'none', 'yearly' ], true ) ) {
						return $this->invalid( "identifiers.{$identifier}.reset_rule", 'must be none or yearly.' );
					}
					$result[ $identifier ][ $key ] = $value;
				} elseif ( 'separator' === $key ) {
					if ( ! in_array( $value, [ '', '-', '/', '_', '.' ], true ) ) {
						return $this->invalid( "identifiers.{$identifier}.separator", 'must be one of: "", "-", "/", "_", ".".' );
					}
					$result[ $identifier ][ $key ] = $value;
				}
			}
		}

		return $result;
	}

	/**
	 * @param array $values Section values.
	 * @return array|WP_Error
	 */
	private function validate_localization( array $values ): array|WP_Error {
		$error = $this->reject_unknown_keys(
			$values,
			[
				'language',
				'date_format',
				'time_format',
				'week_start_day',
				'timezone',
				'currency',
				'currency_position',
				'decimal_precision',
				'number_format',
				'rtl',
			],
			'localization'
		);
		if ( $error ) {
			return $error;
		}

		$result = [];
		foreach ( $values as $key => $value ) {
			switch ( $key ) {
				case 'language':
					$result[ $key ] = sanitize_key( (string) $value );
					break;
				case 'date_format':
					if ( ! in_array( $value, [ 'd/m/Y', 'm/d/Y', 'Y-m-d', 'd-m-Y', 'm-d-Y', 'F j, Y', 'j F Y', 'D, M j, Y' ], true ) ) {
						return $this->invalid( 'localization.date_format', 'contains an unsupported format.' );
					}
					$result[ $key ] = $value;
					break;
				case 'time_format':
					if ( ! in_array( $value, [ 'H:i', 'H:i:s', 'h:i A', 'h:i a', 'h:i:s A', 'g:i A' ], true ) ) {
						return $this->invalid( 'localization.time_format', 'contains an unsupported format.' );
					}
					$result[ $key ] = $value;
					break;
				case 'week_start_day':
					$day = $this->to_int( $value );
					if ( null === $day || $day < 0 || $day > 6 ) {
						return $this->invalid( 'localization.week_start_day', 'must be between 0 and 6.' );
					}
					$result[ $key ] = $day;
					break;
				case 'timezone':
					$timezone = sanitize_text_field( (string) $value );
					try {
						new \DateTimeZone( $timezone );
					} catch ( \Throwable ) {
						return $this->invalid( 'localization.timezone', 'must be a valid IANA timezone.' );
					}
					$result[ $key ] = $timezone;
					break;
				case 'currency':
					$currency = strtoupper( sanitize_text_field( (string) $value ) );
					if ( ! preg_match( '/^[A-Z]{3}$/', $currency ) ) {
						return $this->invalid( 'localization.currency', 'must be a three-letter currency code.' );
					}
					$result[ $key ] = $currency;
					break;
				case 'currency_position':
					if ( ! in_array( $value, [ 'left', 'right', 'left_space', 'right_space' ], true ) ) {
						return $this->invalid( 'localization.currency_position', 'contains an unsupported position.' );
					}
					$result[ $key ] = $value;
					break;
				case 'decimal_precision':
					$precision = $this->to_int( $value );
					if ( null === $precision || $precision < 0 || $precision > 4 ) {
						return $this->invalid( 'localization.decimal_precision', 'must be between 0 and 4.' );
					}
					$result[ $key ] = $precision;
					break;
				case 'number_format':
					if ( ! in_array( $value, [ 'standard', 'indian' ], true ) ) {
						return $this->invalid( 'localization.number_format', 'contains an unsupported format.' );
					}
					$result[ $key ] = $value;
					break;
				case 'rtl':
					$boolean = $this->to_bool( $value );
					if ( null === $boolean ) {
						return $this->invalid( 'localization.rtl', 'must be a boolean.' );
					}
					$result[ $key ] = $boolean;
					break;
			}
		}

		return $result;
	}

	/**
	 * @param array $values Section values.
	 * @return array|WP_Error
	 */
	private function validate_appearance( array $values ): array|WP_Error {
		$error = $this->reject_unknown_keys(
			$values,
			[ 'mode', 'layout', 'sidebar_density', 'table_density', 'theme_color', 'ui_scale' ],
			'appearance'
		);
		if ( $error ) {
			return $error;
		}

		$allowed = [
			'mode'            => [ 'light', 'dark', 'system' ],
			'layout'          => [ 'fluid', 'boxed' ],
			'sidebar_density' => [ 'comfortable', 'compact' ],
			'table_density'   => [ 'comfortable', 'compact' ],
			'theme_color'     => [ 'classic_indigo', 'sky_blue', 'sunset_orange', 'sunny_gold', 'fresh_mint', 'playful_violet', 'fun_pink' ],
			'ui_scale'        => [ '80%', '90%', '100%', '110%', '125%', '150%' ],
		];
		$result = [];
		foreach ( $values as $key => $value ) {
			if ( ! in_array( $value, $allowed[ $key ], true ) ) {
				return $this->invalid( "appearance.{$key}", 'contains an unsupported value.' );
			}
			$result[ $key ] = $value;
		}

		return $result;
	}

	/**
	 * @param array $values Section values.
	 * @return array|WP_Error
	 */
	private function validate_system( array $values ): array|WP_Error {
		$error = $this->reject_unknown_keys( $values, [ 'debug_logging', 'log_retention_days' ], 'system' );
		if ( $error ) {
			return $error;
		}

		$result = [];

		if ( array_key_exists( 'debug_logging', $values ) ) {
			$boolean = $this->to_bool( $values['debug_logging'] );
			if ( null === $boolean ) {
				return $this->invalid( 'system.debug_logging', 'must be a boolean.' );
			}
			$result['debug_logging'] = $boolean;
		}

		if ( array_key_exists( 'log_retention_days', $values ) ) {
			$days = $values['log_retention_days'];
			if ( ! is_numeric( $days ) || (int) $days < 0 ) {
				return $this->invalid( 'system.log_retention_days', 'must be a non-negative integer.' );
			}
			$result['log_retention_days'] = (int) $days;
		}

		return $result;
	}

	/**
	 * @param array $values Section values.
	 * @return array|WP_Error
	 */
	private function validate_notifications( array $values ): array|WP_Error {
		$allowed_fields = [
			'in_app_events',
			'mail_driver',
			'sender_name',
			'sender_email',
			'smtp_host',
			'smtp_port',
			'smtp_secure',
			'smtp_auth',
			'smtp_username',
			'smtp_password',
			'templates',
		];
		$allowed_fields = apply_filters( 'codeclove_notification_allowed_keys', $allowed_fields );
		$error = $this->reject_unknown_keys( $values, $allowed_fields, 'notifications' );
		if ( $error ) {
			return $error;
		}

		$result = [];

		if ( isset( $values['in_app_events'] ) ) {
			if ( ! is_array( $values['in_app_events'] ) ) {
				return $this->invalid( 'notifications.in_app_events', 'must be an object.' );
			}
			$allowed_in_app = [
				'notify_admission_received',
				'notify_admission_status',
				'notify_invoice_issued',
				'notify_payment_recorded',
				'notify_invoice_overdue',
				'notify_attendance_taken',
			];
			$in_app_error = $this->reject_unknown_keys( $values['in_app_events'], $allowed_in_app, 'notifications.in_app_events' );
			if ( $in_app_error ) {
				return $in_app_error;
			}
			$result['in_app_events'] = [];
			foreach ( $allowed_in_app as $k ) {
				if ( isset( $values['in_app_events'][ $k ] ) ) {
					$val = $this->to_bool( $values['in_app_events'][ $k ] );
					if ( null === $val ) {
						return $this->invalid( 'notifications.in_app_events.' . $k, 'must be a boolean.' );
					}
					$result['in_app_events'][ $k ] = $val;
				}
			}
		}

		if ( isset( $values['mail_driver'] ) ) {
			if ( ! in_array( $values['mail_driver'], [ 'wp_mail', 'smtp' ], true ) ) {
				return $this->invalid( 'notifications.mail_driver', 'must be wp_mail or smtp.' );
			}
			$result['mail_driver'] = $values['mail_driver'];
		}

		if ( isset( $values['sender_name'] ) ) {
			$result['sender_name'] = sanitize_text_field( (string) $values['sender_name'] );
		}

		if ( isset( $values['sender_email'] ) ) {
			$email = sanitize_email( (string) $values['sender_email'] );
			if ( ! is_email( $email ) ) {
				return $this->invalid( 'notifications.sender_email', 'must be a valid email address.' );
			}
			$result['sender_email'] = $email;
		}

		if ( isset( $values['smtp_host'] ) ) {
			$result['smtp_host'] = sanitize_text_field( (string) $values['smtp_host'] );
		}

		if ( isset( $values['smtp_port'] ) ) {
			$port = $this->to_int( $values['smtp_port'] );
			if ( null === $port || $port < 1 || $port > 65535 ) {
				return $this->invalid( 'notifications.smtp_port', 'must be an integer between 1 and 65535.' );
			}
			$result['smtp_port'] = $port;
		}

		if ( isset( $values['smtp_secure'] ) ) {
			if ( ! in_array( $values['smtp_secure'], [ 'none', 'ssl', 'tls' ], true ) ) {
				return $this->invalid( 'notifications.smtp_secure', 'must be none, ssl, or tls.' );
			}
			$result['smtp_secure'] = $values['smtp_secure'];
		}

		if ( isset( $values['smtp_auth'] ) ) {
			$auth = $this->to_bool( $values['smtp_auth'] );
			if ( null === $auth ) {
				return $this->invalid( 'notifications.smtp_auth', 'must be a boolean.' );
			}
			$result['smtp_auth'] = $auth;
		}

		if ( isset( $values['smtp_username'] ) ) {
			$result['smtp_username'] = sanitize_text_field( (string) $values['smtp_username'] );
		}

		if ( isset( $values['smtp_password'] ) ) {
			$result['smtp_password'] = (string) $values['smtp_password'];
		}

		if ( isset( $values['templates'] ) ) {
			if ( ! is_array( $values['templates'] ) ) {
				return $this->invalid( 'notifications.templates', 'must be an object.' );
			}

			$allowed_templates = [
				'admission_received',
				'admission_status_changed',
				'payment_recorded',
				'attendance_alert',
				'fee_reminder',
				'invoice_issued',
				'invoice_overdue',
				'payment_reversed',
			];

			$tpl_error = $this->reject_unknown_keys( $values['templates'], $allowed_templates, 'notifications.templates' );
			if ( $tpl_error ) {
				return $tpl_error;
			}

			$result['templates'] = [];

			foreach ( $values['templates'] as $tpl_key => $tpl_val ) {
				if ( ! is_array( $tpl_val ) ) {
					return $this->invalid( "notifications.templates.{$tpl_key}", 'must be an object.' );
				}

				$tpl_field_error = $this->reject_unknown_keys( $tpl_val, [ 'enabled', 'subject', 'body', 'send_to_student', 'send_to_guardian' ], "notifications.templates.{$tpl_key}" );
				if ( $tpl_field_error ) {
					return $tpl_field_error;
				}

				$tpl_data = [];

				if ( isset( $tpl_val['enabled'] ) ) {
					$enabled = $this->to_bool( $tpl_val['enabled'] );
					if ( null === $enabled ) {
						return $this->invalid( "notifications.templates.{$tpl_key}.enabled", 'must be a boolean.' );
					}
					$tpl_data['enabled'] = $enabled;
				}

				if ( isset( $tpl_val['subject'] ) ) {
					$tpl_data['subject'] = sanitize_text_field( (string) $tpl_val['subject'] );
				}

				if ( isset( $tpl_val['body'] ) ) {
					$tpl_data['body'] = sanitize_textarea_field( (string) $tpl_val['body'] );
				}

				if ( isset( $tpl_val['send_to_student'] ) ) {
					$send_to_student = $this->to_bool( $tpl_val['send_to_student'] );
					if ( null === $send_to_student ) {
						return $this->invalid( "notifications.templates.{$tpl_key}.send_to_student", 'must be a boolean.' );
					}
					$tpl_data['send_to_student'] = $send_to_student;
				}

				if ( isset( $tpl_val['send_to_guardian'] ) ) {
					$send_to_guardian = $this->to_bool( $tpl_val['send_to_guardian'] );
					if ( null === $send_to_guardian ) {
						return $this->invalid( "notifications.templates.{$tpl_key}.send_to_guardian", 'must be a boolean.' );
					}
					$tpl_data['send_to_guardian'] = $send_to_guardian;
				}

				$result['templates'][ $tpl_key ] = $tpl_data;
			}
		}

		$result = apply_filters( 'codeclove_validate_notifications', $result, $values );
		if ( $result instanceof \WP_Error ) {
			return $result;
		}

		return $result;
	}

	/**
	 * @param array  $values  Values to inspect.
	 * @param array  $allowed Allowed keys.
	 * @param string $path    Error path.
	 */
	private function reject_unknown_keys( array $values, array $allowed, string $path ): ?WP_Error {
		$unknown = array_diff( array_keys( $values ), $allowed );
		if ( [] === $unknown ) {
			return null;
		}

		return $this->invalid(
			$path,
			'contains unsupported keys: ' . implode( ', ', array_map( 'strval', $unknown ) ) . '.'
		);
	}

	/**
	 * @param mixed  $value       Raw list.
	 * @param string $path        Error path.
	 * @param bool   $sanitize_key Whether values are machine keys.
	 * @return array|WP_Error
	 */
	private function sanitize_string_list( mixed $value, string $path, bool $sanitize_key = false ): array|WP_Error {
		if ( ! is_array( $value ) ) {
			return $this->invalid( $path, 'must be an array.' );
		}
		if ( ! array_is_list( $value ) ) {
			return $this->invalid( $path, 'must be a sequential array.' );
		}

		$result = [];
		foreach ( $value as $item ) {
			if ( ! is_scalar( $item ) ) {
				return $this->invalid( $path, 'must contain only strings.' );
			}
			$text = $sanitize_key ? sanitize_key( (string) $item ) : sanitize_text_field( (string) $item );
			if ( '' !== $text ) {
				$result[] = $text;
			}
		}

		return array_values( array_unique( $result ) );
	}

	/**
	 * @param mixed  $value   Raw list.
	 * @param array  $allowed Allowed values.
	 * @param string $path    Error path.
	 * @return array|WP_Error
	 */
	private function sanitize_enum_list( mixed $value, array $allowed, string $path ): array|WP_Error {
		$list = $this->sanitize_string_list( $value, $path, true );
		if ( is_wp_error( $list ) ) {
			return $list;
		}

		foreach ( $list as $item ) {
			if ( ! in_array( $item, $allowed, true ) ) {
				return $this->invalid( $path, "contains unsupported value '{$item}'." );
			}
		}

		return $list;
	}

	/**
	 * @param mixed  $value Raw comma-separated emails.
	 * @param string $path  Error path.
	 * @return string|WP_Error
	 */
	private function sanitize_email_list( mixed $value, string $path ): string|WP_Error {
		if ( ! is_string( $value ) ) {
			return $this->invalid( $path, 'must be a comma-separated string.' );
		}

		$emails = [];
		foreach ( array_filter( array_map( 'trim', explode( ',', $value ) ) ) as $email ) {
			$sanitized = sanitize_email( $email );
			if ( ! is_email( $sanitized ) ) {
				return $this->invalid( $path, "contains invalid email '{$email}'." );
			}
			$emails[] = $sanitized;
		}

		return implode( ',', array_values( array_unique( $emails ) ) );
	}

	/**
	 * Converts HTML/JSON numeric values to integers without accepting decimals.
	 */
	private function to_int( mixed $value ): ?int {
		if ( is_int( $value ) ) {
			return $value;
		}
		if ( is_string( $value ) && preg_match( '/^-?\d+$/', $value ) ) {
			return (int) $value;
		}

		return null;
	}

	/**
	 * Converts JSON and checkbox-style values to booleans.
	 */
	private function to_bool( mixed $value ): ?bool {
		if ( is_bool( $value ) ) {
			return $value;
		}
		if ( 0 === $value || '0' === $value || 'false' === $value ) {
			return false;
		}
		if ( 1 === $value || '1' === $value || 'true' === $value ) {
			return true;
		}

		return null;
	}
	/**
	 * Validates payment gateways configuration.
	 *
	 * @param array $values
	 * @return array|WP_Error
	 */
	private function validate_payment_gateways( array $values ): array|WP_Error {
		$allowed_gateways = apply_filters( 'codeclove_allowed_payment_gateways', [ 'gateway_order' ] );
		$error = $this->reject_unknown_keys( $values, $allowed_gateways, 'payment_gateways' );
		if ( $error ) {
			return $error;
		}

		$validated = [];

		if ( isset( $values['gateway_order'] ) ) {
			if ( ! is_array( $values['gateway_order'] ) ) {
				return $this->invalid( 'payment_gateways.gateway_order', 'must be an array.' );
			}
			$allowed_ids = apply_filters( 'codeclove_allowed_gateway_ids', [ 'paypal', 'stripe' ] );
			$order = [];
			foreach ( $values['gateway_order'] as $item ) {
				$clean = sanitize_key( (string) $item );
				if ( in_array( $clean, $allowed_ids, true ) && ! in_array( $clean, $order, true ) ) {
					$order[] = $clean;
				}
			}
			$validated['gateway_order'] = $order;
		}

		$validated = apply_filters( 'codeclove_validate_payment_gateways', $validated, $values );
		if ( $validated instanceof WP_Error ) {
			return $validated;
		}

		return $validated;
	}

	/**
	 * Validates counter/desk payment methods configuration.
	 *
	 * @param array $values
	 * @return array|WP_Error
	 */
	private function validate_payment_methods( array $values ): array|WP_Error {
		$allowed_methods = [ 'cash', 'bank_transfer', 'cheque', 'card', 'upi', 'other' ];
		$error           = $this->reject_unknown_keys( $values, $allowed_methods, 'payment_methods' );
		if ( $error ) {
			return $error;
		}

		$validated = [];
		foreach ( $allowed_methods as $method ) {
			if ( isset( $values[ $method ] ) ) {
				$validated[ $method ] = (bool) $values[ $method ];
			}
		}

		return $validated;
	}

	/**
	 * Validates finance settings.
	 *
	 * @param array $values Raw section values.
	 * @return array|WP_Error
	 */
	private function validate_finance( array $values ): array|WP_Error {
		$allowed_keys = [ 'allow_partial_payments', 'min_partial_amount' ];
		$error        = $this->reject_unknown_keys( $values, $allowed_keys, 'finance' );
		if ( $error ) {
			return $error;
		}

		$validated = [];

		if ( isset( $values['allow_partial_payments'] ) ) {
			$validated['allow_partial_payments'] = (bool) $values['allow_partial_payments'];
		}

		if ( isset( $values['min_partial_amount'] ) ) {
			$amount = (float) $values['min_partial_amount'];
			if ( $amount < 0.50 ) {
				return $this->invalid( 'finance.min_partial_amount', 'must be at least 0.50.' );
			}
			$validated['min_partial_amount'] = round( $amount, 2 );
		}

		return $validated;
	}

	/**
	 * Creates a consistent REST validation error.
	 */
	private function invalid( string $path, string $message ): WP_Error {
		return new WP_Error(
			'codeclove_invalid_settings',
			sprintf( 'Invalid setting "%s": %s', $path, $message ),
			[
				'status' => 400,
				'field'  => $path,
			]
		);
	}
}
