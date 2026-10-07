<?php
/**
 * Notifications service.
 *
 * Listens to school events and handles email delivery (wp_mail or custom SMTP).
 *
 * @package CodeClove\Modules\Notifications
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Notifications;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Modules\Settings\SettingsRepository;
use CodeClove\Database\Schema;
use CodeClove\Shared\AuditLogger;
use WP_Error;

/**
 * Class NotificationsService
 */
final class NotificationsService {

	/**
	 * Registers action hook listeners.
	 */
	public function init(): void {
		// Hook SMTP mailer customization.
		add_action( 'phpmailer_init', [ $this, 'configure_smtp' ] );

		// Hook sender identity.
		add_filter( 'wp_mail_from', [ $this, 'get_mail_from' ], 100 );
		add_filter( 'wp_mail_from_name', [ $this, 'get_mail_from_name' ], 100 );

		// Hook event listeners.
		add_action( 'codeclove_admission_received', [ $this, 'on_admission_created' ], 10, 2 );
		add_action( 'codeclove_admission_status_changed', [ $this, 'on_admission_status_changed' ], 10, 4 );
		add_action( 'codeclove_staff_application_received', [ $this, 'on_staff_application_received' ], 10, 3 );
		add_action( 'codeclove_payment_recorded', [ $this, 'on_payment_recorded' ], 10, 1 );
		add_action( 'codeclove_student_attendance_marked', [ $this, 'on_attendance_marked' ], 10, 3 );
		add_action( 'codeclove_invoice_issued', [ $this, 'on_invoice_issued' ], 10, 1 );
		add_action( 'codeclove_invoice_overdue', [ $this, 'on_invoice_overdue' ], 10, 1 );
		add_action( 'codeclove_payment_cancelled', [ $this, 'on_payment_cancelled' ], 10, 1 );

		// In-app notifications event listeners.
		add_action( 'codeclove_admission_received', [ $this, 'in_app_on_admission_created' ], 10, 2 );
		add_action( 'codeclove_admission_status_changed', [ $this, 'in_app_on_admission_status_changed' ], 10, 4 );
		add_action( 'codeclove_invoice_issued', [ $this, 'in_app_on_invoice_issued' ], 10, 1 );
		add_action( 'codeclove_payment_recorded', [ $this, 'in_app_on_payment_recorded' ], 10, 1 );
		add_action( 'codeclove_invoice_overdue', [ $this, 'in_app_on_invoice_overdue' ], 10, 1 );
		add_action( 'codeclove_attendance_saved', [ $this, 'in_app_on_attendance_saved' ], 10, 4 );
	}

	/**
	 * Configures PHPMailer for custom SMTP delivery if enabled in settings.
	 *
	 * @param object $phpmailer PHPMailer instance.
	 */
	public function configure_smtp( $phpmailer ): void {
		$settings      = ( new SettingsRepository() )->get_settings();
		$notifications = $settings['notifications'] ?? [];

		if ( ( $notifications['mail_driver'] ?? 'wp_mail' ) !== 'smtp' ) {
			return;
		}

		$phpmailer->isSMTP();
		$phpmailer->Host       = $notifications['smtp_host'] ?? '';
		$phpmailer->Port       = intval( $notifications['smtp_port'] ?? 587 );
		$phpmailer->SMTPAuth   = ! empty( $notifications['smtp_auth'] );
		$phpmailer->Username   = $notifications['smtp_username'] ?? '';
		$phpmailer->Password   = $notifications['smtp_password'] ?? '';
		
		$secure = $notifications['smtp_secure'] ?? 'tls';
		if ( 'none' === $secure ) {
			$phpmailer->SMTPSecure = '';
		} else {
			$phpmailer->SMTPSecure = $secure;
		}
	}

	/**
	 * Sets custom envelope sender email.
	 */
	public function get_mail_from( string $original_email ): string {
		$settings     = ( new SettingsRepository() )->get_settings();
		$sender_email = $settings['notifications']['sender_email'] ?? '';
		return is_email( $sender_email ) ? $sender_email : $original_email;
	}

	/**
	 * Sets custom envelope sender name.
	 */
	public function get_mail_from_name( string $original_name ): string {
		$settings    = ( new SettingsRepository() )->get_settings();
		$sender_name = $settings['notifications']['sender_name'] ?? '';
		return ! empty( $sender_name ) ? $sender_name : $original_name;
	}

	/**
	 * Send an email with placeholder substitutions.
	 */
	public function send( string $event, string $recipient_email, array $placeholders ): bool {
		$settings      = ( new SettingsRepository() )->get_settings();
		$notifications = $settings['notifications'] ?? [];
		$templates     = $notifications['templates'] ?? [];

		if ( empty( $templates[ $event ] ) ) {
			return false;
		}

		$template = $templates[ $event ];
		if ( empty( $template['enabled'] ) ) {
			return false;
		}

		$subject = $template['subject'] ?? '';
		$body    = $template['body'] ?? '';

		// Add global placeholders.
		$placeholders['{school_name}']  = $settings['school']['name'] ?? get_bloginfo( 'name' );
		$placeholders['{school_email}'] = $settings['school']['email'] ?? get_bloginfo( 'admin_email' );

		// Perform substitutions.
		$keys   = array_keys( $placeholders );
		$values = array_values( $placeholders );

		$final_subject = str_replace( $keys, $values, $subject );
		$final_body    = str_replace( $keys, $values, $body );

		$is_html = ( strpos( $final_body, '<' ) !== false && strpos( $final_body, '>' ) !== false ) || ! empty( $template['is_html'] );
		if ( $is_html ) {
			$headers = [ 'Content-Type: text/html; charset=UTF-8' ];
			if ( strpos( $final_body, '<html' ) === false ) {
				$final_body = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">' . nl2br( $final_body ) . '</body></html>';
			}
		} else {
			$headers = [ 'Content-Type: text/plain; charset=UTF-8' ];
		}

		$sent = wp_mail( $recipient_email, $final_subject, $final_body, $headers );

		if ( $sent ) {
			AuditLogger::log(
				'notification.sent',
				[
					'event'     => $event,
					'recipient' => $recipient_email,
				]
			);
		} else {
			AuditLogger::log(
				'notification.failed',
				[
					'event'     => $event,
					'recipient' => $recipient_email,
				]
			);
		}

		return $sent;
	}

	/**
	 * Triggers test email dispatch for diagnostics.
	 */
	public function send_test_email( string $recipient_email ): bool {
		$subject = 'CodeClove Test Email';
		$body    = "Hello,\n\nThis is a diagnostic test email from CodeClove. If you are reading this, your email delivery settings (WP Mail / SMTP) are working correctly.\n\nRegards,\nCodeClove School Management";
		$headers = [ 'Content-Type: text/plain; charset=UTF-8' ];

		return wp_mail( $recipient_email, $subject, $body, $headers );
	}

	/**
	 * Send an SMS with placeholder substitutions.
	 */
	public function send_sms( string $event, string $recipient_phone, array $placeholders ): bool {
		if ( empty( $recipient_phone ) ) {
			return false;
		}

		$settings      = ( new SettingsRepository() )->get_settings();
		$notifications = $settings['notifications'] ?? [];

		if ( empty( $notifications['sms_enabled'] ) ) {
			return false;
		}

		$templates = $notifications['sms_templates'] ?? [];
		if ( empty( $templates[ $event ] ) ) {
			return false;
		}

		$template = $templates[ $event ];
		if ( empty( $template['enabled'] ) ) {
			return false;
		}

		$body = $template['body'] ?? '';
		if ( empty( $body ) ) {
			return false;
		}

		// Add global placeholders.
		$placeholders['{school_name}']  = $settings['school']['name'] ?? get_bloginfo( 'name' );
		$placeholders['{school_email}'] = $settings['school']['email'] ?? get_bloginfo( 'admin_email' );

		// Perform substitutions.
		$keys   = array_keys( $placeholders );
		$values = array_values( $placeholders );
		$final_body = str_replace( $keys, $values, $body );

		// Limit/truncate SMS message body to 320 characters max (approx 2 segments)
		if ( mb_strlen( $final_body ) > 320 ) {
			$final_body = mb_substr( $final_body, 0, 317 ) . '...';
		}

		$driver = $this->get_sms_driver( $notifications );
		if ( ! $driver ) {
			AuditLogger::log(
				'notification.sms_failed',
				[
					'event'     => $event,
					'recipient' => $recipient_phone,
					'error'     => 'Unable to initialize SMS driver.',
				]
			);
			return false;
		}

		$sent = $driver->send( $recipient_phone, $final_body );

		if ( $sent ) {
			AuditLogger::log(
				'notification.sms_sent',
				[
					'event'     => $event,
					'recipient' => $recipient_phone,
				]
			);
		} else {
			AuditLogger::log(
				'notification.sms_failed',
				[
					'event'     => $event,
					'recipient' => $recipient_phone,
					'error'     => 'Driver send failed.',
				]
			);
		}

		return $sent;
	}

	/**
	 * Instantiates the selected SMS driver.
	 */
	private function get_sms_driver( array $notifications ): ?object {
		$provider = $notifications['sms_provider'] ?? 'none';
		return apply_filters( 'codeclove_sms_driver', null, $provider, $notifications );
	}

	/**
	 * Triggers test SMS dispatch for diagnostics.
	 */
	public function send_test_sms( string $recipient_phone ): bool {
		$settings      = ( new SettingsRepository() )->get_settings();
		$notifications = $settings['notifications'] ?? [];
		$driver        = $this->get_sms_driver( $notifications );

		if ( ! $driver ) {
			return false;
		}

		$message = 'CodeClove SMS Test: If you are reading this, your SMS configuration is working correctly.';
		return $driver->send( $recipient_phone, $message );
	}

	/**
	 * Send a WhatsApp notification with placeholder substitutions.
	 */
	public function send_whatsapp( string $event, string $recipient_phone, array $placeholders ): bool {
		if ( empty( $recipient_phone ) ) {
			return false;
		}

		$settings      = ( new SettingsRepository() )->get_settings();
		$notifications = $settings['notifications'] ?? [];

		if ( empty( $notifications['whatsapp_enabled'] ) ) {
			return false;
		}

		$templates = $notifications['whatsapp_templates'] ?? [];
		if ( empty( $templates[ $event ] ) ) {
			return false;
		}

		$template = $templates[ $event ];
		if ( empty( $template['enabled'] ) ) {
			return false;
		}

		$body = $template['body'] ?? '';
		if ( empty( $body ) ) {
			return false;
		}

		// Add global placeholders.
		$placeholders['{school_name}']  = $settings['school']['name'] ?? get_bloginfo( 'name' );
		$placeholders['{school_email}'] = $settings['school']['email'] ?? get_bloginfo( 'admin_email' );

		// Perform substitutions.
		$keys       = array_keys( $placeholders );
		$values     = array_values( $placeholders );
		$final_body = str_replace( $keys, $values, $body );

		// Truncate WhatsApp message body to 1024 characters max
		if ( mb_strlen( $final_body ) > 1024 ) {
			$final_body = mb_substr( $final_body, 0, 1021 ) . '...';
		}

		$driver = $this->get_whatsapp_driver( $notifications );
		if ( ! $driver ) {
			$provider = $notifications['whatsapp_provider'] ?? 'none';
			$err      = 'none' === $provider
				? 'WhatsApp notifications are disabled or no provider is selected.'
				: "Unable to initialize WhatsApp driver for '{$provider}'.";
			AuditLogger::log(
				'notification.whatsapp_failed',
				[
					'event'     => $event,
					'recipient' => $recipient_phone,
					'error'     => $err,
				]
			);
			set_transient( 'codeclove_last_whatsapp_error', $err, 60 );
			return false;
		}

		$context = [
			'event'         => $event,
			'template_name' => $template['template_name'] ?? '',
			'placeholders'  => $placeholders,
		];

		$sent = $driver->send( $recipient_phone, $final_body, $context );

		if ( $sent ) {
			AuditLogger::log(
				'notification.whatsapp_sent',
				[
					'event'     => $event,
					'recipient' => $recipient_phone,
				]
			);
		} else {
			AuditLogger::log(
				'notification.whatsapp_failed',
				[
					'event'     => $event,
					'recipient' => $recipient_phone,
					'error'     => 'Driver send failed.',
				]
			);
		}

		return $sent;
	}

	/**
	 * Instantiates the selected WhatsApp driver.
	 */
	private function get_whatsapp_driver( array $notifications ): ?object {
		$provider = $notifications['whatsapp_provider'] ?? 'none';
		return apply_filters( 'codeclove_whatsapp_driver', null, $provider, $notifications );
	}

	/**
	 * Dispatches SMS and WhatsApp notifications to guardian and/or student if configured.
	 *
	 * @param string               $event         Event key.
	 * @param array<string, mixed> $notifications Notifications configuration.
	 * @param array<string, mixed> $info          Student and guardian data containing phones.
	 * @param array<string, mixed> $placeholders  Replacement variables.
	 */
	private function dispatch_phone_notifications( string $event, array $notifications, array $info, array $placeholders ): void {
		$guardian_phone = $info['guardian_phone'] ?? '';
		$student_phone  = $info['student_phone'] ?? '';

		$sms = $notifications['sms_templates'][ $event ] ?? [];
		if ( ! empty( $sms['send_to_guardian'] ) && ! empty( $guardian_phone ) ) {
			$this->send_sms( $event, $guardian_phone, $placeholders );
		}
		if ( ! empty( $sms['send_to_student'] ) && ! empty( $student_phone ) ) {
			$this->send_sms( $event, $student_phone, $placeholders );
		}

		$wa = $notifications['whatsapp_templates'][ $event ] ?? [];
		if ( ! empty( $wa['send_to_guardian'] ) && ! empty( $guardian_phone ) ) {
			$this->send_whatsapp( $event, $guardian_phone, $placeholders );
		}
		if ( ! empty( $wa['send_to_student'] ) && ! empty( $student_phone ) ) {
			$this->send_whatsapp( $event, $student_phone, $placeholders );
		}
	}

	/**
	 * Triggers test WhatsApp dispatch for diagnostics.
	 */
	public function send_test_whatsapp( string $recipient_phone ): bool {
		$settings      = ( new SettingsRepository() )->get_settings();
		$notifications = $settings['notifications'] ?? [];
		$driver        = $this->get_whatsapp_driver( $notifications );

		if ( ! $driver ) {
			$provider = $notifications['whatsapp_provider'] ?? 'none';
			$err      = 'none' === $provider
				? __( 'WhatsApp notifications are disabled or no provider is selected. Please select a provider and save settings.', 'codeclove-school-management' )
				: sprintf( __( "Unable to initialize WhatsApp driver for '%s'. Please verify your credentials.", 'codeclove-school-management' ), $provider );
			AuditLogger::log(
				'notification.whatsapp_failed',
				[
					'event'     => 'test',
					'recipient' => $recipient_phone,
					'error'     => $err,
				]
			);
			set_transient( 'codeclove_last_whatsapp_error', $err, 60 );
			return false;
		}

		$school_name = $settings['school']['name'] ?? get_bloginfo( 'name' );
		$message     = "CodeClove WhatsApp Test: If you are reading this, your WhatsApp configuration is working correctly!\n— " . $school_name;
		return $driver->send( $recipient_phone, $message, [ 'event' => 'test' ] );
	}

	/**
	 * Callback for codeclove_admission_received hook.
	 */
	public function on_admission_created( $app_id, array $mapped_app = [] ): void {
		$settings      = ( new SettingsRepository() )->get_settings();
		$notifications = $settings['notifications'] ?? [];
		
		// Get recipient email configured in admissions settings (falls back to WP admin_email).
		$recipient_email = $settings['admissions']['notification_recipients'] ?? get_bloginfo( 'admin_email' );

		$student_name = trim( ( $mapped_app['student_first_name'] ?? '' ) . ' ' . ( $mapped_app['student_last_name'] ?? '' ) );

		$placeholders = [
			'{student_name}'     => $student_name,
			'{reference_number}' => $mapped_app['reference_number'] ?? '',
			'{guardian_name}'     => $mapped_app['guardian_name'] ?? '',
			'{guardian_email}'    => $mapped_app['guardian_email'] ?? '',
		];

		// Can be comma-separated list of emails.
		$emails = array_filter( array_map( 'trim', explode( ',', $recipient_email ) ) );
		foreach ( $emails as $email ) {
			if ( is_email( $email ) ) {
				$this->send( 'admission_received', $email, $placeholders );
			}
		}

		// Email template student / guardian routing
		$tpl = $notifications['templates']['admission_received'] ?? [];
		if ( ! empty( $tpl['send_to_guardian'] ) ) {
			$guardian_email = $mapped_app['guardian_email'] ?? '';
			if ( ! empty( $guardian_email ) && is_email( $guardian_email ) ) {
				$this->send( 'admission_received', $guardian_email, $placeholders );
			}
		}
		if ( ! empty( $tpl['send_to_student'] ) ) {
			$student_email = $mapped_app['student_email'] ?? '';
			if ( ! empty( $student_email ) && is_email( $student_email ) ) {
				$this->send( 'admission_received', $student_email, $placeholders );
			}
		}

		$this->dispatch_phone_notifications( 'admission_received', $notifications, $mapped_app, $placeholders );
	}
	/**
	 * Callback for codeclove_staff_application_received hook.
	 *
	 * Dispatches alert email to configured staff onboarding notification recipients.
	 *
	 * @param int    $app_id
	 * @param string $ref_number
	 * @param array  $app_data
	 */
	public function on_staff_application_received( int $app_id, string $ref_number, array $app_data = [] ): void {
		$settings       = ( new SettingsRepository() )->get_settings();
		$recipients_str = ! empty( $settings['staff_onboarding']['notification_recipients'] )
			? $settings['staff_onboarding']['notification_recipients']
			: get_bloginfo( 'admin_email' );

		$applicant   = trim( ( $app_data['first_name'] ?? '' ) . ' ' . ( $app_data['last_name'] ?? '' ) );
		$role        = $app_data['desired_role'] ?? 'Staff';
		$email       = $app_data['email'] ?? '';
		$school_name = $settings['school']['name'] ?? get_bloginfo( 'name' );

		/* translators: 1: application reference number */
		$subject = sprintf( __( 'New Staff Application Received — %s', 'codeclove-school-management' ), $ref_number );
		$body    = sprintf(
			/* translators: 1: school name, 2: applicant name, 3: reference number, 4: role, 5: email */
			__( "Dear %1\$s Team,\n\nA new staff employment application has been received.\n\nApplicant: %2\$s\nReference: %3\$s\nRole: %4\$s\nEmail: %5\$s\n\nPlease log in to review the application.\n\nRegards,\n%1\$s", 'codeclove-school-management' ),
			$school_name,
			$applicant,
			$ref_number,
			$role,
			$email
		);

		foreach ( array_filter( array_map( 'trim', explode( ',', $recipients_str ) ), 'is_email' ) as $target_email ) {
			wp_mail( $target_email, $subject, $body );
		}

		$this->notify_permission(
			'staff.view',
			__( 'New Staff Application Received', 'codeclove-school-management' ),
			sprintf( __( 'A new staff application has been submitted by %1$s for %2$s (Ref: %3$s).', 'codeclove-school-management' ), $applicant, $role, $ref_number ),
			'staff_application',
			'/staff'
		);
	}


	/**
	 * Callback for codeclove_admission_status_changed hook.
	 */
	public function on_admission_status_changed( int $id, string $to_status, string $from_status, array $mapped_app ): void {
		$student_name = trim( ( $mapped_app['student_first_name'] ?? '' ) . ' ' . ( $mapped_app['student_last_name'] ?? '' ) );

		$placeholders = [
			'{student_name}'     => $student_name,
			'{guardian_name}'     => $mapped_app['guardian_name'] ?? '',
			'{reference_number}' => $mapped_app['reference_number'] ?? '',
			'{status}'           => ucfirst( str_replace( '_', ' ', $to_status ) ),
		];

		$settings      = ( new SettingsRepository() )->get_settings();
		$notifications = $settings['notifications'] ?? [];

		// Email Configuration Check
		$tpl = $notifications['templates']['admission_status_changed'] ?? [];
		if ( ! empty( $tpl['send_to_guardian'] ) ) {
			$recipient_email = $mapped_app['guardian_email'] ?? '';
			if ( ! empty( $recipient_email ) && is_email( $recipient_email ) ) {
				$this->send( 'admission_status_changed', $recipient_email, $placeholders );
			}
		}
		if ( ! empty( $tpl['send_to_student'] ) ) {
			$student_email = $mapped_app['student_email'] ?? '';
			if ( ! empty( $student_email ) && is_email( $student_email ) ) {
				$this->send( 'admission_status_changed', $student_email, $placeholders );
			}
		}

		$this->dispatch_phone_notifications( 'admission_status_changed', $notifications, $mapped_app, $placeholders );
	}

	/**
	 * Callback for codeclove_payment_recorded hook.
	 */
	public function on_payment_recorded( array $payment ): void {
		$invoice_id = isset( $payment['invoice_id'] ) ? intval( $payment['invoice_id'] ) : 0;
		if ( ! $invoice_id ) {
			return;
		}

		// Load invoice to fetch snapshot of guardian billing details.
		$finance_service = new \CodeClove\Modules\Finance\FinanceService();
		$invoice         = $finance_service->get_invoice( $invoice_id );
		if ( ! $invoice || is_wp_error( $invoice ) ) {
			return;
		}

		$currency = $payment['currency'] ?? $invoice['currency'] ?? 'USD';
		$amount   = $currency . ' ' . number_format( ( $payment['amount_minor'] ?? 0 ) / 100, 2 );
		$balance  = $invoice['currency'] . ' ' . number_format( ( $invoice['balance_minor'] ?? 0 ) / 100, 2 );

		$placeholders = [
			'{invoice_number}'    => $invoice['invoice_number'] ?? '',
			'{amount}'            => $amount,
			'{payment_date}'      => $payment['paid_on'] ?? '',
			'{payment_method}'    => ucfirst( str_replace( '_', ' ', $payment['method'] ?? 'manual' ) ),
			'{payment_reference}' => $payment['reference'] ?? '—',
			'{balance}'           => $balance,
			'{guardian_name}'     => $invoice['guardian_name'] ?? '',
		];

		$settings      = ( new SettingsRepository() )->get_settings();
		$notifications = $settings['notifications'] ?? [];

		$tpl = $notifications['templates']['payment_recorded'] ?? [];

		// Guardian email
		if ( ! empty( $tpl['send_to_guardian'] ) ) {
			$recipient_email = $invoice['guardian_email'] ?? '';
			if ( ! empty( $recipient_email ) && is_email( $recipient_email ) ) {
				$this->send( 'payment_recorded', $recipient_email, $placeholders );
			}
		}

		$student_id = isset( $invoice['student_id'] ) ? intval( $invoice['student_id'] ) : 0;
		if ( $student_id ) {
			$info = $this->get_student_and_guardian( $student_id );

			// Student email
			if ( ! empty( $tpl['send_to_student'] ) && ! empty( $info['student_email'] ) && is_email( $info['student_email'] ) ) {
				$this->send( 'payment_recorded', $info['student_email'], $placeholders );
			}

			$this->dispatch_phone_notifications( 'payment_recorded', $notifications, $info, $placeholders );
		}
	}

	/**
	 * Callback for codeclove_student_attendance_marked hook.
	 */
	public function on_attendance_marked( int $student_id, string $date, string $status ): void {
		$settings      = ( new SettingsRepository() )->get_settings();
		$notifications = $settings['notifications'] ?? [];

		$tpl = $notifications['templates']['attendance_alert'] ?? [];

		$info = $this->get_student_and_guardian( $student_id );

		$placeholders = [
			'{student_name}'  => $info['student_name'],
			'{guardian_name}' => $info['guardian_name'],
			'{status}'        => $status,
			'{date}'          => date_i18n( get_option( 'date_format' ), strtotime( $date ) ),
		];

		// Guardian email
		if ( ! empty( $tpl['send_to_guardian'] ) && ! empty( $info['guardian_email'] ) && is_email( $info['guardian_email'] ) ) {
			$this->send( 'attendance_alert', $info['guardian_email'], $placeholders );
		}

		// Student email
		if ( ! empty( $tpl['send_to_student'] ) && ! empty( $info['student_email'] ) && is_email( $info['student_email'] ) ) {
			$this->send( 'attendance_alert', $info['student_email'], $placeholders );
		}

		$this->dispatch_phone_notifications( 'attendance_alert', $notifications, $info, $placeholders );

		if ( $status === 'absent' || $status === 'late' ) {
			$this->create_portal_notification(
				$student_id,
				__( 'Attendance Alert', 'codeclove-school-management' ),
				// translators: 1: attendance status, 2: formatted date.
				sprintf( __( 'You were marked %1$s on %2$s.', 'codeclove-school-management' ), ucfirst( $status ), date_i18n( get_option( 'date_format' ), strtotime( $date ) ) ),
				'attendance_alert',
				'/attendance'
			);
		}
	}

	/**
	 * Sends a manual fee reminder for an outstanding invoice.
	 */
	public function send_fee_reminder( int $invoice_id ): bool {
		$finance_service = new \CodeClove\Modules\Finance\FinanceService();
		$invoice         = $finance_service->get_invoice( $invoice_id );
		if ( ! $invoice ) {
			return false;
		}

		$amount  = $invoice['currency'] . ' ' . number_format( ( $invoice['total_minor'] ?? 0 ) / 100, 2 );
		$balance = $invoice['currency'] . ' ' . number_format( ( $invoice['balance_minor'] ?? 0 ) / 100, 2 );

		$placeholders = [
			'{invoice_number}' => $invoice['invoice_number'] ?? '',
			'{amount}'         => $amount,
			'{due_date}'       => date_i18n( get_option( 'date_format' ), strtotime( $invoice['due_date'] ?? '' ) ),
			'{balance}'        => $balance,
			'{guardian_name}'  => $invoice['guardian_name'] ?? '',
		];

		$settings      = ( new SettingsRepository() )->get_settings();
		$notifications = $settings['notifications'] ?? [];

		$tpl     = $notifications['templates']['fee_reminder'] ?? [];
$sms_tpl = $notifications['sms_templates']['fee_reminder'] ?? [];
$wa_tpl  = $notifications['whatsapp_templates']['fee_reminder'] ?? [];

		$email_sent = false;
		$student_id = isset( $invoice['student_id'] ) ? intval( $invoice['student_id'] ) : 0;
		$info       = $student_id ? $this->get_student_and_guardian( $student_id ) : null;

		// Guardian email
		if ( ! empty( $tpl['send_to_guardian'] ) ) {
			$recipient_email = $invoice['guardian_email'] ?? '';
			if ( ! empty( $recipient_email ) && is_email( $recipient_email ) ) {
				$email_sent = $this->send( 'fee_reminder', $recipient_email, $placeholders ) || $email_sent;
			}
		}

		// Student email
		if ( ! empty( $tpl['send_to_student'] ) && $info && ! empty( $info['student_email'] ) && is_email( $info['student_email'] ) ) {
			$email_sent = $this->send( 'fee_reminder', $info['student_email'], $placeholders ) || $email_sent;
		}

		$sms_sent = false;
		$wa_sent  = false;
		if ( $info ) {
			// Guardian SMS
			if ( ! empty( $sms_tpl['send_to_guardian'] ) && ! empty( $info['guardian_phone'] ) ) {
				$sms_sent = $this->send_sms( 'fee_reminder', $info['guardian_phone'], $placeholders ) || $sms_sent;
			}

			// Student SMS
			if ( ! empty( $sms_tpl['send_to_student'] ) && ! empty( $info['student_phone'] ) ) {
				$sms_sent = $this->send_sms( 'fee_reminder', $info['student_phone'], $placeholders ) || $sms_sent;
			}

			// Guardian WhatsApp
			if ( ! empty( $wa_tpl['send_to_guardian'] ) && ! empty( $info['guardian_phone'] ) ) {
				$wa_sent = $this->send_whatsapp( 'fee_reminder', $info['guardian_phone'], $placeholders ) || $wa_sent;
			}

			// Student WhatsApp
			if ( ! empty( $wa_tpl['send_to_student'] ) && ! empty( $info['student_phone'] ) ) {
				$wa_sent = $this->send_whatsapp( 'fee_reminder', $info['student_phone'], $placeholders ) || $wa_sent;
			}
		}

		return $email_sent || $sms_sent || $wa_sent;
	}

	/**
	 * Queries student name and their primary guardian name & email.
	 */
	private function get_student_and_guardian( int $student_id ): array {
		global $wpdb;
		$students_table          = Schema::students();
		$student_guardians_table = Schema::student_guardians();
		$guardians_table         = Schema::guardians();

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Student lookup for notification.
		$student = $wpdb->get_row( $wpdb->prepare( 'SELECT first_name, last_name, email, phone FROM %i WHERE id = %d LIMIT 1', Schema::students(), $student_id ), ARRAY_A );

		if ( ! $student ) {
			return [
				'student_name'   => '',
				'student_email'  => '',
				'student_phone'  => '',
				'guardian_name'  => '',
				'guardian_email' => '',
				'guardian_phone' => '',
			];
		}
		$student_name  = trim( ( $student['first_name'] ?? '' ) . ' ' . ( $student['last_name'] ?? '' ) );
		$student_email = $student['email'] ?? '';
		$student_phone = $student['phone'] ?? '';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Guardian lookup for notification.
		$guardian = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT g.first_name, g.last_name, g.email, g.phone
				FROM %i g
				INNER JOIN %i sg ON sg.guardian_id = g.id
				WHERE sg.student_id = %d AND g.deleted_at IS NULL
				ORDER BY sg.is_primary DESC, sg.sort_order ASC LIMIT 1',
				Schema::guardians(),
				Schema::student_guardians(),
				$student_id
			),
			ARRAY_A
		);

		if ( ! $guardian ) {
			return [
				'student_name'   => $student_name,
				'student_email'  => $student_email,
				'student_phone'  => $student_phone,
				'guardian_name'  => '',
				'guardian_email' => '',
				'guardian_phone' => '',
			];
		}

		$guardian_name = trim( ( $guardian['first_name'] ?? '' ) . ' ' . ( $guardian['last_name'] ?? '' ) );
		return [
			'student_name'   => $student_name,
			'student_email'  => $student_email,
			'student_phone'  => $student_phone,
			'guardian_name'  => $guardian_name,
			'guardian_email' => $guardian['email'] ?? '',
			'guardian_phone' => $guardian['phone'] ?? '',
		];
	}

	/**
	 * Callback for codeclove_invoice_issued hook.
	 */
	public function on_invoice_issued( array $invoice ): void {
		if ( empty( $invoice ) || is_wp_error( $invoice ) || empty( $invoice['id'] ) ) {
			return;
		}

		$amount = $invoice['currency'] . ' ' . number_format( ( $invoice['total_minor'] ?? 0 ) / 100, 2 );

		$placeholders = [
			'{invoice_number}' => $invoice['invoice_number'] ?? '',
			'{amount}'         => $amount,
			'{due_date}'       => date_i18n( get_option( 'date_format' ), strtotime( $invoice['due_date'] ?? '' ) ),
			'{guardian_name}'  => $invoice['guardian_name'] ?? '',
		];

		$settings      = ( new SettingsRepository() )->get_settings();
		$notifications = $settings['notifications'] ?? [];

		$tpl = isset( $notifications['templates']['invoice_issued'] ) ? $notifications['templates']['invoice_issued'] : [];

		// Guardian email
		if ( ! empty( $tpl['send_to_guardian'] ) ) {
			$recipient_email = $invoice['guardian_email'] ?? '';
			if ( ! empty( $recipient_email ) && is_email( $recipient_email ) ) {
				$this->send( 'invoice_issued', $recipient_email, $placeholders );
			}
		}

		$student_id = isset( $invoice['student_id'] ) ? intval( $invoice['student_id'] ) : 0;
		if ( $student_id ) {
			$info = $this->get_student_and_guardian( $student_id );

			// Student email
			if ( ! empty( $tpl['send_to_student'] ) && ! empty( $info['student_email'] ) && is_email( $info['student_email'] ) ) {
				$this->send( 'invoice_issued', $info['student_email'], $placeholders );
			}

			$this->dispatch_phone_notifications( 'invoice_issued', $notifications, $info, $placeholders );
		}
	}

	/**
	 * Callback for codeclove_invoice_overdue hook.
	 */
	public function on_invoice_overdue( int $invoice_id ): void {
		$finance_service = new \CodeClove\Modules\Finance\FinanceService();
		$invoice         = $finance_service->get_invoice( $invoice_id );
		if ( ! $invoice || is_wp_error( $invoice ) ) {
			return;
		}

		$balance = $invoice['currency'] . ' ' . number_format( ( $invoice['balance_minor'] ?? 0 ) / 100, 2 );

		$placeholders = [
			'{invoice_number}' => $invoice['invoice_number'] ?? '',
			'{balance}'        => $balance,
			'{due_date}'       => date_i18n( get_option( 'date_format' ), strtotime( $invoice['due_date'] ?? '' ) ),
			'{guardian_name}'  => $invoice['guardian_name'] ?? '',
		];

		$settings      = ( new SettingsRepository() )->get_settings();
		$notifications = $settings['notifications'] ?? [];

		$tpl = isset( $notifications['templates']['invoice_overdue'] ) ? $notifications['templates']['invoice_overdue'] : [];

		// Guardian email
		if ( ! empty( $tpl['send_to_guardian'] ) ) {
			$recipient_email = $invoice['guardian_email'] ?? '';
			if ( ! empty( $recipient_email ) && is_email( $recipient_email ) ) {
				$this->send( 'invoice_overdue', $recipient_email, $placeholders );
			}
		}

		$student_id = isset( $invoice['student_id'] ) ? intval( $invoice['student_id'] ) : 0;
		if ( $student_id ) {
			$info = $this->get_student_and_guardian( $student_id );

			// Student email
			if ( ! empty( $tpl['send_to_student'] ) && ! empty( $info['student_email'] ) && is_email( $info['student_email'] ) ) {
				$this->send( 'invoice_overdue', $info['student_email'], $placeholders );
			}

			$this->dispatch_phone_notifications( 'invoice_overdue', $notifications, $info, $placeholders );
		}
	}

	/**
	 * Callback for codeclove_payment_cancelled hook.
	 */
	public function on_payment_cancelled( int $payment_id ): void {
		$finance_service = new \CodeClove\Modules\Finance\FinanceService();
		
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Payment lookup for cancellation notification.
		$payment = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM %i WHERE id = %d LIMIT 1', Schema::payments(), $payment_id ), ARRAY_A );
		if ( ! $payment ) {
			return;
		}

		$invoice_id = isset( $payment['invoice_id'] ) ? intval( $payment['invoice_id'] ) : 0;
		$invoice    = $finance_service->get_invoice( $invoice_id );
		if ( ! $invoice || is_wp_error( $invoice ) ) {
			return;
		}

		$amount = $payment['currency'] . ' ' . number_format( ( $payment['amount_minor'] ?? 0 ) / 100, 2 );

		$placeholders = [
			'{payment_number}' => $payment['payment_number'] ?? '',
			'{amount}'         => $amount,
			'{invoice_number}' => $payment['invoice_number'] ?? $invoice['invoice_number'] ?? '',
			'{guardian_name}'  => $invoice['guardian_name'] ?? '',
		];

		$settings      = ( new SettingsRepository() )->get_settings();
		$notifications = $settings['notifications'] ?? [];

		$tpl = isset( $notifications['templates']['payment_reversed'] ) ? $notifications['templates']['payment_reversed'] : [];

		// Guardian email
		if ( ! empty( $tpl['send_to_guardian'] ) ) {
			$recipient_email = $invoice['guardian_email'] ?? '';
			if ( ! empty( $recipient_email ) && is_email( $recipient_email ) ) {
				$this->send( 'payment_reversed', $recipient_email, $placeholders );
			}
		}

		$student_id = isset( $invoice['student_id'] ) ? intval( $invoice['student_id'] ) : 0;
		if ( $student_id ) {
			$info = $this->get_student_and_guardian( $student_id );

			// Student email
			if ( ! empty( $tpl['send_to_student'] ) && ! empty( $info['student_email'] ) && is_email( $info['student_email'] ) ) {
				$this->send( 'payment_reversed', $info['student_email'], $placeholders );
			}

			$this->dispatch_phone_notifications( 'payment_reversed', $notifications, $info, $placeholders );
		}
	}

	// ─── In-App Notifications Logic ──────────────────────────────────────────

	/**
	 * Creates a notification record for a specific user.
	 */
	public function create_notification( int $user_id, string $title, string $content, string $event_type, ?string $url = null ): void {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->insert(
			Schema::notifications(),
			[
				'user_id'    => $user_id,
				'audience'   => 'staff',
				'title'      => $title,
				'content'    => $content,
				'event_type' => $event_type,
				'is_read'    => 0,
				'url'        => $url,
				'created_at' => current_time( 'mysql' ),
			],
			[ '%d', '%s', '%s', '%s', '%s', '%d', '%s', '%s' ]
		);
	}

	// ponytail: direct insert for student in-app portal notice
	public function create_portal_notification( int $student_id, string $title, string $content, string $event_type, ?string $url = null ): void {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->insert(
			Schema::notifications(),
			[
				'user_id'    => 0,
				'student_id' => $student_id,
				'audience'   => 'portal',
				'title'      => $title,
				'content'    => $content,
				'event_type' => $event_type,
				'is_read'    => 0,
				'url'        => $url,
				'created_at' => current_time( 'mysql' ),
			],
			[ '%d', '%d', '%s', '%s', '%s', '%s', '%d', '%s', '%s' ]
		);
	}

	/**
	 * Broadcasts a notification to administrators and staff with matching permission.
	 */
	public function notify_permission( string $permission_key, string $title, string $content, string $event_type, ?string $url = null ): void {
		// 1. Get all admins (manage_options)
		$admins = get_users( [
			'capability' => 'manage_options',
			'fields'     => 'ID',
		] );
		$recipients = array_map( 'intval', $admins );

		// 2. Get all staff users with this permission key
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Staff users with permission lookup.
		$staff_ids = $wpdb->get_col( $wpdb->prepare(
			'SELECT DISTINCT ur.user_id 
			 FROM %i ur
			 INNER JOIN %i rp ON ur.role_id = rp.role_id
			 WHERE (rp.permission_key = %s OR rp.permission_key = %s) AND rp.allowed = 1',
			Schema::user_roles(),
			Schema::role_permissions(),
			$permission_key,
			'*'
		) );

		if ( ! empty( $staff_ids ) ) {
			$recipients = array_merge( $recipients, array_map( 'intval', $staff_ids ) );
		}

		$recipients = array_unique( $recipients );

		// 3. Check settings toggles
		$settings = ( new SettingsRepository() )->get_settings();
		$in_app_settings = $settings['notifications']['in_app_events'] ?? [];
		$event_setting_key = 'notify_' . $event_type;

		// If setting is defined and explicitly false, skip sending
		if ( isset( $in_app_settings[ $event_setting_key ] ) && ! $in_app_settings[ $event_setting_key ] ) {
			return;
		}

		$actor_id = get_current_user_id();

		// 4. Create notification records
		foreach ( $recipients as $recipient_id ) {
			// Don't notify the actor who triggered the action (unless it is a system-generated alert like invoice_overdue)
			if ( $recipient_id === $actor_id && $event_type !== 'invoice_overdue' ) {
				continue;
			}
			// Verify user preference (if defined and set to false, skip)
			$user_prefs = get_user_meta( $recipient_id, '_codeclove_notification_preferences', true );
			if ( is_array( $user_prefs ) && isset( $user_prefs[ $event_setting_key ] ) && ! $user_prefs[ $event_setting_key ] ) {
				continue;
			}
			$this->create_notification( $recipient_id, $title, $content, $event_type, $url );
		}
	}

	/**
	 * Gets paginated notifications for the given user.
	 *
	 * @return array{items: array, unread_count: int, total: int}
	 */
	public function get_user_notifications( int $user_id, array $params ): array {
		global $wpdb;

		$page     = isset( $params['page'] ) ? max( 1, (int) $params['page'] ) : 1;
		$per_page = isset( $params['per_page'] ) ? max( 1, min( 100, (int) $params['per_page'] ) ) : 20;
		$offset   = ( $page - 1 ) * $per_page;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- User unread notifications count query.
		$unread_count = (int) $wpdb->get_var( $wpdb->prepare(
			'SELECT COUNT(*) FROM %i WHERE user_id = %d AND is_read = 0',
			Schema::notifications(),
			$user_id
		) );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- User total notifications count query.
		$total = (int) $wpdb->get_var( $wpdb->prepare(
			'SELECT COUNT(*) FROM %i WHERE user_id = %d',
			Schema::notifications(),
			$user_id
		) );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- User notifications list query.
		$rows = $wpdb->get_results( $wpdb->prepare(
			'SELECT id, title, content, event_type, is_read, url, created_at
			 FROM %i
			 WHERE user_id = %d
			 ORDER BY created_at DESC
			 LIMIT %d OFFSET %d',
			Schema::notifications(),
			$user_id,
			$per_page,
			$offset
		), ARRAY_A );

		$items = array_map( function( $r ) {
			return [
				'id'         => (int) $r['id'],
				'title'      => $r['title'],
				'content'    => $r['content'],
				'event_type' => $r['event_type'],
				'is_read'    => (bool) $r['is_read'],
				'url'        => $r['url'],
				'created_at' => $r['created_at'],
			];
		}, (array) $rows );

		return [
			'items'        => $items,
			'unread_count' => $unread_count,
			'total'        => $total,
		];
	}

	/**
	 * Marks a single notification as read if it belongs to the user.
	 */
	public function mark_as_read( int $user_id, int $id ): bool {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$updated = $wpdb->update(
			Schema::notifications(),
			[
				'is_read' => 1,
				'read_at' => current_time( 'mysql' ),
			],
			[
				'id'      => $id,
				'user_id' => $user_id,
			],
			[ '%d', '%s' ],
			[ '%d', '%d' ]
		);
		return $updated !== false;
	}

	/**
	 * Marks all notifications for a user as read.
	 */
	public function mark_all_read( int $user_id ): bool {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$updated = $wpdb->update(
			Schema::notifications(),
			[
				'is_read' => 1,
				'read_at' => current_time( 'mysql' ),
			],
			[
				'user_id' => $user_id,
				'is_read' => 0,
			],
			[ '%d', '%s' ],
			[ '%d', '%d' ]
		);
		return $updated !== false;
	}

	// ─── Event Callbacks ─────────────────────────────────────────────────────

	public function in_app_on_admission_created( $app_id, array $mapped_app = [] ): void {
		$student_name = trim( ( $mapped_app['student_first_name'] ?? '' ) . ' ' . ( $mapped_app['student_last_name'] ?? '' ) );
		$ref = $mapped_app['reference_number'] ?? '';
		
		$this->notify_permission(
			'admissions.view',
			'New Admission Submitted',
			"A new application has been submitted for {$student_name} (Ref: {$ref}).",
			'admission_received',
			'/students/admissions/' . $app_id
		);
	}

	public function in_app_on_admission_status_changed( $id, $to_status, $from_status, array $mapped_app = [] ): void {
		$student_name = trim( ( $mapped_app['student_first_name'] ?? '' ) . ' ' . ( $mapped_app['student_last_name'] ?? '' ) );

		$this->notify_permission(
			'admissions.view',
			'Admission Application Updated',
			"Application status for {$student_name} updated to " . str_replace( '_', ' ', $to_status ) . ".",
			'admission_status',
			'/students/admissions/' . $id
		);
	}

	public function in_app_on_invoice_issued( $invoice ): void {
		$inv = (array) $invoice;
		$student_name = $inv['student_name'] ?? 'Student';
		$inv_no = $inv['invoice_number'] ?? '';
		$amount = ($inv['currency'] ?? 'USD') . ' ' . number_format( ( $inv['total_minor'] ?? 0 ) / 100, 2 );

		$this->notify_permission(
			'finance.view',
			'New Invoice Issued',
			"Invoice {$inv_no} generated for {$student_name} ({$amount}).",
			'invoice_issued',
			'/finance/invoices/' . ( $inv['id'] ?? '' )
		);

		if ( ! empty( $inv['student_id'] ) ) {
			$this->create_portal_notification(
				(int) $inv['student_id'],
				__( 'New Fee Invoice Issued', 'codeclove-school-management' ),
				// translators: 1: invoice number, 2: invoice amount.
				sprintf( __( 'Invoice %1$s for %2$s has been issued.', 'codeclove-school-management' ), $inv_no, $amount ),
				'invoice_issued',
				'/finance'
			);
		}
	}

	public function in_app_on_payment_recorded( $payment ): void {
		global $wpdb;
		$pay        = (array) $payment;
		$inv_id     = ! empty( $pay['invoice_id'] ) ? (int) $pay['invoice_id'] : 0;
		$inv_no     = (string) ( $pay['invoice_number'] ?? '' );
		$student_id = ! empty( $pay['student_id'] ) ? (int) $pay['student_id'] : 0;

		if ( $inv_id > 0 && ( empty( $inv_no ) || ! $student_id ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Payment invoice details query.
			$inv_row = $wpdb->get_row( $wpdb->prepare(
				'SELECT invoice_number, student_id FROM %i WHERE id = %d',
				Schema::invoices(),
				$inv_id
			), ARRAY_A );
			if ( $inv_row ) {
				$inv_no     = $inv_no ?: (string) ( $inv_row['invoice_number'] ?? '' );
				$student_id = $student_id ?: (int) ( $inv_row['student_id'] ?? 0 );
			}
		}

		$amount     = ( $pay['currency'] ?? 'USD' ) . ' ' . number_format( ( $pay['amount_minor'] ?? 0 ) / 100, 2 );
		$inv_suffix = ! empty( $inv_no )
			? sprintf( /* translators: %s: invoice number */ __( ' against Invoice %s', 'codeclove-school-management' ), $inv_no )
			: '';

		$this->notify_permission(
			'finance.view',
			'Payment Received',
			"Payment of {$amount} recorded{$inv_suffix}.",
			'payment_recorded',
			'/finance/invoices/' . $inv_id
		);

		if ( $student_id > 0 ) {
			$this->create_portal_notification(
				$student_id,
				__( 'Payment Received', 'codeclove-school-management' ),
				sprintf(
					/* translators: 1: formatted amount, 2: invoice suffix */
					__( 'Payment of %1$s recorded%2$s.', 'codeclove-school-management' ),
					$amount,
					$inv_suffix
				),
				'payment_recorded',
				'/finance'
			);
		}
	}

	public function in_app_on_invoice_overdue( $invoice_id ): void {
		global $wpdb;
		// Fetch invoice details
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Overdue invoice query.
		$inv = $wpdb->get_row( $wpdb->prepare(
			'SELECT invoice_number, balance_minor, currency, student_id FROM %i WHERE id = %d',
			Schema::invoices(),
			$invoice_id
		), ARRAY_A );

		if ( ! $inv ) {
			return;
		}

		$inv_no = $inv['invoice_number'];
		$amount = $inv['currency'] . ' ' . number_format( ( $inv['balance_minor'] ?? 0 ) / 100, 2 );

		$this->notify_permission(
			'finance.view',
			'Invoice Overdue',
			"Invoice {$inv_no} has passed its due date with balance {$amount}.",
			'invoice_overdue',
			'/finance/invoices/' . $invoice_id
		);

		if ( ! empty( $inv['student_id'] ) ) {
			$this->create_portal_notification(
				(int) $inv['student_id'],
				__( 'Invoice Overdue', 'codeclove-school-management' ),
				// translators: 1: invoice number, 2: invoice balance.
				sprintf( __( 'Invoice %1$s has passed its due date with balance %2$s.', 'codeclove-school-management' ), $inv_no, $amount ),
				'invoice_overdue',
				'/finance'
			);
		}
	}

	public function in_app_on_attendance_saved( $unit_id, $group_id, $date, $user_id ): void {
		global $wpdb;
		// Fetch unit name
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Unit name query for notification.
		$unit_name = $wpdb->get_var( $wpdb->prepare(
			'SELECT name FROM %i WHERE id = %d',
			Schema::units(),
			$unit_id
		) );

		if ( ! $unit_name ) {
			return;
		}

		$by_user = wp_get_current_user()->display_name;

		$this->notify_permission(
			'attendance.view',
			'Attendance Saved',
			"Attendance records for {$unit_name} have been updated by {$by_user}.",
			'attendance_taken',
			'/attendance'
		);
	}

	// ─── Announcement / Noticeboard CRUD ─────────────────────────────────────

	/**
	 * Retrieves announcements for the Noticeboard with pagination and filters.
	 *
	 * @param array $params Query parameters (page, per_page, search, audience, event_type).
	 * @return array
	 */
	public function get_announcements( array $params = [] ): array {
		global $wpdb;
		$table = Schema::notifications();

		$page       = max( 1, (int) ( $params['page'] ?? 1 ) );
		$per_page   = min( 100, max( 1, (int) ( $params['per_page'] ?? 20 ) ) );
		$offset     = ( $page - 1 ) * $per_page;
		$search     = isset( $params['search'] ) ? trim( sanitize_text_field( $params['search'] ) ) : '';
		$audience   = isset( $params['audience'] ) ? sanitize_text_field( $params['audience'] ) : '';
		$event_type = isset( $params['event_type'] ) ? sanitize_text_field( $params['event_type'] ) : '';

		$where = [];
		$args  = [];

		$where[] = 'n.student_id IS NULL';

		if ( ! empty( $event_type ) && 'all' !== $event_type ) {
			$where[] = 'n.event_type = %s';
			$args[]  = $event_type;
		} else {
			$where[] = "n.event_type IN ('announcement', 'notice', 'urgent', 'event', 'holiday', 'circular')";
		}

		if ( ! empty( $audience ) && 'all' !== $audience ) {
			$where[] = '(n.audience = %s OR n.audience = %s)';
			$args[]  = $audience;
			$args[]  = 'all';
		}

		if ( ! empty( $search ) ) {
			$like    = '%' . $wpdb->esc_like( $search ) . '%';
			$where[] = '(n.title LIKE %s OR n.content LIKE %s)';
			$args[]  = $like;
			$args[]  = $like;
		}

		$where_clause = ! empty( $where ) ? 'WHERE ' . implode( ' AND ', $where ) : '';

		$count_sql = 'SELECT COUNT(*) FROM %i n ' . $where_clause;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
		$total = (int) $wpdb->get_var( $wpdb->prepare( $count_sql, array_merge( [ $table ], $args ) ) );

		$sql = 'SELECT n.id, n.user_id, n.audience, n.title, n.content, n.event_type, n.url, n.created_at, n.is_read
		        FROM %i n
		        ' . $where_clause . '
		        ORDER BY n.created_at DESC, n.id DESC
		        LIMIT %d OFFSET %d';

		$query_args = array_merge( [ $table ], $args, [ $per_page, $offset ] );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $query_args ), ARRAY_A ) ?: [];

		$items = array_map( static fn( array $r ): array => [
			'id'         => (int) $r['id'],
			'title'      => (string) $r['title'],
			'content'    => (string) $r['content'],
			'audience'   => (string) $r['audience'],
			'event_type' => (string) $r['event_type'],
			'url'        => $r['url'] ? (string) $r['url'] : null,
			'created_at' => (string) $r['created_at'],
			'is_read'    => (bool) $r['is_read'],
		], $rows );

		return [
			'items' => $items,
			'total' => $total,
		];
	}

	/**
	 * Creates an announcement record.
	 *
	 * @param array $data Announcement data.
	 * @return int|WP_Error Inserted ID or error.
	 */
	public function create_announcement( array $data ): int|WP_Error {
		global $wpdb;

		$title = isset( $data['title'] ) ? sanitize_text_field( trim( (string) $data['title'] ) ) : '';
		if ( empty( $title ) ) {
			return new WP_Error( 'missing_title', __( 'Announcement title is required.', 'codeclove-school-management' ), [ 'status' => 400 ] );
		}
		if ( mb_strlen( $title ) > 160 ) {
			return new WP_Error( 'title_too_long', __( 'Title must be 160 characters or less.', 'codeclove-school-management' ), [ 'status' => 400 ] );
		}

		$content = isset( $data['content'] ) ? wp_kses_post( trim( (string) $data['content'] ) ) : '';
		if ( empty( $content ) ) {
			return new WP_Error( 'missing_content', __( 'Announcement content is required.', 'codeclove-school-management' ), [ 'status' => 400 ] );
		}

		$audience   = isset( $data['audience'] ) ? sanitize_text_field( (string) $data['audience'] ) : 'portal';
		$event_type = isset( $data['event_type'] ) ? sanitize_text_field( (string) $data['event_type'] ) : 'announcement';
		$url        = ! empty( $data['url'] ) ? esc_url_raw( (string) $data['url'] ) : null;

		$inserted = $wpdb->insert( Schema::notifications(), [
			'user_id'    => 0,
			'student_id' => null,
			'audience'   => $audience,
			'title'      => $title,
			'content'    => $content,
			'event_type' => $event_type,
			'is_read'    => 0,
			'url'        => $url,
			'created_at' => current_time( 'mysql' ),
		] );

		return $inserted ? (int) $wpdb->insert_id : new WP_Error( 'db_error', __( 'Failed to save announcement.', 'codeclove-school-management' ), [ 'status' => 500 ] );
	}

	/**
	 * Updates an announcement record.
	 *
	 * @param int   $id   Notification ID.
	 * @param array $data Fields to update.
	 * @return bool|WP_Error True on success or WP_Error.
	 */
	public function update_announcement( int $id, array $data ): bool|WP_Error {
		global $wpdb;
		$table = Schema::notifications();

		$update = [];
		if ( isset( $data['title'] ) ) {
			$title = sanitize_text_field( trim( (string) $data['title'] ) );
			if ( empty( $title ) ) {
				return new WP_Error( 'missing_title', __( 'Title cannot be empty.', 'codeclove-school-management' ), [ 'status' => 400 ] );
			}
			$update['title'] = $title;
		}

		if ( isset( $data['content'] ) ) {
			$content = wp_kses_post( trim( (string) $data['content'] ) );
			if ( empty( $content ) ) {
				return new WP_Error( 'missing_content', __( 'Content cannot be empty.', 'codeclove-school-management' ), [ 'status' => 400 ] );
			}
			$update['content'] = $content;
		}

		if ( isset( $data['event_type'] ) ) {
			$update['event_type'] = sanitize_text_field( (string) $data['event_type'] );
		}

		if ( isset( $data['audience'] ) ) {
			$update['audience'] = sanitize_text_field( (string) $data['audience'] );
		}

		if ( array_key_exists( 'url', $data ) ) {
			$update['url'] = ! empty( $data['url'] ) ? esc_url_raw( (string) $data['url'] ) : null;
		}

		if ( empty( $update ) ) {
			return true;
		}

		$updated = $wpdb->update( $table, $update, [ 'id' => $id ] );
		return false !== $updated;
	}

	/**
	 * Deletes an announcement record.
	 *
	 * @param int $id Notification ID.
	 * @return bool True if deleted.
	 */
	public function delete_announcement( int $id ): bool {
		global $wpdb;
		return (bool) $wpdb->delete( Schema::notifications(), [ 'id' => $id ], [ '%d' ] );
	}
}

