<?php
/**
 * Public Shortcodes handler for Admissions, Inquiries, Careers and Status Lookups.
 *
 * Provides responsive, standalone public-facing shortcodes for:
 *   - [nexora_admission_form]
 *   - [nexora_inquiry_form]
 *   - [nexora_application_status]
 *   - [nexora_staff_application_form]
 *   - [nexora_staff_application_status]
 *
 * @package Nexora\Modules\Admissions
 */

declare( strict_types=1 );

namespace Nexora\Modules\Admissions;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Nexora\Database\Schema;
use Nexora\Modules\Settings\SettingsRepository;

/**
 * Class Shortcodes
 */
final class Shortcodes {

	/**
	 * Registers all public WordPress shortcodes.
	 */
	public static function register(): void {
		add_shortcode( 'nexora_admission_form', [ __CLASS__, 'render_admission_form' ] );
		add_shortcode( 'nexora_inquiry_form', [ __CLASS__, 'render_inquiry_form' ] );
		add_shortcode( 'nexora_application_status', [ __CLASS__, 'render_status_lookup' ] );
		add_shortcode( 'nexora_staff_application_form', [ __CLASS__, 'render_staff_application_form' ] );
		add_shortcode( 'nexora_staff_application_status', [ __CLASS__, 'render_staff_status_lookup' ] );
	}

	/**
	 * Helper to fetch active academic units (classes/grades).
	 *
	 * @return array<int, array{id: int, name: string}>
	 */
	private static function get_academic_units(): array {
		global $wpdb;
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$units = $wpdb->get_results(
			'SELECT u.id, u.name FROM ' . Schema::units() . " u
			WHERE u.status = 'active'
			  AND (
			    u.academic_session_id = (SELECT id FROM " . Schema::sessions() . " WHERE status = 'active' ORDER BY id DESC LIMIT 1)
			    OR NOT EXISTS (SELECT 1 FROM " . Schema::sessions() . " WHERE status = 'active')
			  )
			ORDER BY u.id ASC",
			ARRAY_A
		);
		return $units ?: [];
		// phpcs:enable
	}

	/**
	 * Returns sanitized container width style attribute from shortcode attributes.
	 *
	 * @param array<string, mixed> $atts Shortcode attributes.
	 */
	private static function get_width_style( array $atts = [] ): string {
		$w = strtolower( trim( (string) ( $atts['width'] ?? $atts['max_width'] ?? '' ) ) );
		if ( '' === $w || '680px' === $w ) {
			return '';
		}
		$val = match ( $w ) {
			'full', '100%' => '100%',
			'wide'         => '840px',
			'compact'      => '520px',
			default        => is_numeric( $w ) ? "{$w}px" : sanitize_text_field( $w ),
		};
		return "width: {$val}; max-width: 100%;";
	}

	/**
	 * Enqueues shared public stylesheets and scripts.
	 */
	private static function enqueue_public_assets(): void {
		static $enqueued = false;
		if ( $enqueued ) {
			return;
		}
		$enqueued = true;

		wp_enqueue_style(
			'nexora-public-admissions',
			NEXORA_URL . 'assets/css/public-admissions.css',
			[],
			NEXORA_VERSION
		);

		$colors = [
			'classic_indigo' => '#4f46e5',
			'sky_blue'       => '#2563eb',
			'sunset_orange'  => '#ea580c',
			'sunny_gold'     => '#d97706',
			'fresh_mint'     => '#16a34a',
			'playful_violet' => '#7c3aed',
			'fun_pink'       => '#db2777',
		];
		$color  = ( new SettingsRepository() )->get_settings()['appearance']['theme_color'] ?? 'classic_indigo';
		$brand  = $colors[ $color ] ?? '#4f46e5';

		$custom_css = sprintf(
			':root { --nexora-brand: %1$s; --nexora-brand-hover: color-mix(in srgb, %1$s 85%%, #000); --nexora-brand-light: color-mix(in srgb, %1$s 8%%, #fff); --nexora-brand-ring: color-mix(in srgb, %1$s 18%%, transparent); }',
			esc_attr( $brand )
		);
		wp_add_inline_style( 'nexora-public-admissions', $custom_css );

		wp_enqueue_script(
			'nexora-public-admissions',
			NEXORA_URL . 'assets/js/public-admissions.js',
			[],
			NEXORA_VERSION,
			true
		);
	}

	/**
	 * Renders the admission application form or lightweight inquiry form.
	 *
	 * @param array $atts Shortcode attributes.
	 */
	public static function render_admission_form( array $atts = [] ): string {
		$repo     = new SettingsRepository();
		$settings = $repo->get_settings();
		$enabled  = (bool) ( $settings['admissions']['enable_public_form'] ?? true );

		if ( ! $enabled ) {
			return '<div class="nexora-shortcode-msg nexora-warning"><p>' . esc_html__( 'Public admissions submissions are currently closed.', 'nexora-school-management' ) . '</p></div>';
		}

		$is_inquiry = ! empty( $atts['inquiry'] );
		$units      = self::get_academic_units();
		$post_url   = esc_url( rest_url( 'nexora/v1/public/admissions' ) );
		$form_id    = $is_inquiry ? 'nexora-inquiry-form' : 'nexora-admission-form';
		$btn_id     = $is_inquiry ? 'nexora-inquiry-btn' : 'nexora-admission-btn';
		$msg_id     = $is_inquiry ? 'nexora-inquiry-response' : 'nexora-admission-response';
		ob_start();
		self::enqueue_public_assets();
		$width_css = self::get_width_style( $atts );
		?>
		<div class="nexora-public-wrap"<?php if ( '' !== $width_css ) : ?> style="<?php echo esc_attr( $width_css ); ?>"<?php endif; ?>>
			<div class="nexora-header">
				<h3><?php echo esc_html( $is_inquiry ? __( 'Admission Inquiry', 'nexora-school-management' ) : __( 'Admission Application', 'nexora-school-management' ) ); ?></h3>
				<p class="desc"><?php echo esc_html( $is_inquiry ? __( 'Have questions about admissions? Submit your inquiry below and our team will get in touch.', 'nexora-school-management' ) : __( 'Please complete the application form below to submit your admission request.', 'nexora-school-management' ) ); ?></p>
			</div>

			<form id="<?php echo esc_attr( $form_id ); ?>" action="#">
				<input type="hidden" name="status" value="<?php echo esc_attr( $is_inquiry ? 'inquiry' : 'submitted' ); ?>">
				<input type="hidden" name="source" value="<?php echo esc_attr( $is_inquiry ? 'inquiry_form' : 'public_form' ); ?>">

				<div class="nexora-section-title"><?php esc_html_e( 'Student Details', 'nexora-school-management' ); ?></div>
				<div class="nexora-form-grid">
					<div class="nexora-field">
						<label for="<?php echo esc_attr( $form_id ); ?>_first_name"><?php esc_html_e( 'Student First Name', 'nexora-school-management' ); ?> <span class="req">*</span></label>
						<input type="text" id="<?php echo esc_attr( $form_id ); ?>_first_name" name="student_first_name" required placeholder="<?php esc_attr_e( 'First name', 'nexora-school-management' ); ?>">
					</div>
					<div class="nexora-field">
						<label for="<?php echo esc_attr( $form_id ); ?>_last_name"><?php esc_html_e( 'Student Last Name', 'nexora-school-management' ); ?> <span class="req">*</span></label>
						<input type="text" id="<?php echo esc_attr( $form_id ); ?>_last_name" name="student_last_name" required placeholder="<?php esc_attr_e( 'Last name', 'nexora-school-management' ); ?>">
					</div>
					<div class="nexora-field">
						<label for="<?php echo esc_attr( $form_id ); ?>_dob"><?php esc_html_e( 'Date of Birth', 'nexora-school-management' ); ?></label>
						<input type="date" id="<?php echo esc_attr( $form_id ); ?>_dob" name="student_date_of_birth">
					</div>
					<?php if ( ! $is_inquiry ) : ?>
						<div class="nexora-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_gender"><?php esc_html_e( 'Gender', 'nexora-school-management' ); ?></label>
							<select id="<?php echo esc_attr( $form_id ); ?>_gender" name="student_gender">
								<option value="male"><?php esc_html_e( 'Male', 'nexora-school-management' ); ?></option>
								<option value="female"><?php esc_html_e( 'Female', 'nexora-school-management' ); ?></option>
								<option value="non_binary"><?php esc_html_e( 'Non-binary', 'nexora-school-management' ); ?></option>
								<option value="prefer_not_to_say"><?php esc_html_e( 'Prefer not to say', 'nexora-school-management' ); ?></option>
							</select>
						</div>
					<?php endif; ?>
					<div class="nexora-field<?php echo $is_inquiry ? '' : ' full'; ?>">
						<label for="<?php echo esc_attr( $form_id ); ?>_unit"><?php esc_html_e( 'Class / Grade Applying For', 'nexora-school-management' ); ?> <span class="req">*</span></label>
						<select id="<?php echo esc_attr( $form_id ); ?>_unit" name="academic_unit_id" required>
							<option value=""><?php esc_html_e( 'Select Grade / Class', 'nexora-school-management' ); ?></option>
							<?php foreach ( $units as $u ) : ?>
								<option value="<?php echo esc_attr( (string) $u['id'] ); ?>"><?php echo esc_html( (string) $u['name'] ); ?></option>
							<?php endforeach; ?>
						</select>
					</div>
					<?php if ( ! $is_inquiry ) : ?>
						<div class="nexora-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_prev_school"><?php esc_html_e( 'Previous School Attended', 'nexora-school-management' ); ?></label>
							<input type="text" id="<?php echo esc_attr( $form_id ); ?>_prev_school" name="previous_school_name" placeholder="<?php esc_attr_e( 'School name', 'nexora-school-management' ); ?>">
						</div>
						<div class="nexora-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_prev_grade"><?php esc_html_e( 'Last Grade Completed', 'nexora-school-management' ); ?></label>
							<input type="text" id="<?php echo esc_attr( $form_id ); ?>_prev_grade" name="previous_grade_completed" placeholder="<?php esc_attr_e( 'e.g. Grade 4', 'nexora-school-management' ); ?>">
						</div>
					<?php endif; ?>
				</div>

				<div class="nexora-section-title"><?php esc_html_e( 'Parent & Contact Details', 'nexora-school-management' ); ?></div>
				<div class="nexora-form-grid">
					<div class="nexora-field full">
						<label for="<?php echo esc_attr( $form_id ); ?>_parent_name"><?php echo esc_html( $is_inquiry ? __( 'Parent / Guardian Full Name', 'nexora-school-management' ) : __( 'Father Full Name', 'nexora-school-management' ) ); ?> <span class="req">*</span></label>
						<input type="text" id="<?php echo esc_attr( $form_id ); ?>_parent_name" name="father_name" required placeholder="<?php esc_attr_e( 'Full name', 'nexora-school-management' ); ?>">
					</div>
					<div class="nexora-field">
						<label for="<?php echo esc_attr( $form_id ); ?>_parent_phone"><?php esc_html_e( 'Mobile Phone', 'nexora-school-management' ); ?> <span class="req">*</span></label>
						<input type="tel" id="<?php echo esc_attr( $form_id ); ?>_parent_phone" name="father_phone" required placeholder="+1 (555) 000-0000">
					</div>
					<div class="nexora-field">
						<label for="<?php echo esc_attr( $form_id ); ?>_parent_email"><?php esc_html_e( 'Email Address', 'nexora-school-management' ); ?> <span class="req">*</span></label>
						<input type="email" id="<?php echo esc_attr( $form_id ); ?>_parent_email" name="father_email" required placeholder="parent@example.com">
					</div>
					<?php if ( ! $is_inquiry ) : ?>
						<div class="nexora-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_father_occ"><?php esc_html_e( 'Father Occupation', 'nexora-school-management' ); ?></label>
							<input type="text" id="<?php echo esc_attr( $form_id ); ?>_father_occ" name="father_occupation" placeholder="<?php esc_attr_e( 'Occupation', 'nexora-school-management' ); ?>">
						</div>
						<div class="nexora-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_mother_name"><?php esc_html_e( 'Mother Full Name', 'nexora-school-management' ); ?></label>
							<input type="text" id="<?php echo esc_attr( $form_id ); ?>_mother_name" name="mother_name" placeholder="<?php esc_attr_e( 'Mother name', 'nexora-school-management' ); ?>">
						</div>
						<div class="nexora-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_mother_phone"><?php esc_html_e( 'Mother Mobile Number', 'nexora-school-management' ); ?></label>
							<input type="tel" id="<?php echo esc_attr( $form_id ); ?>_mother_phone" name="mother_phone" placeholder="+1 (555) 000-0000">
						</div>
						<div class="nexora-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_mother_email"><?php esc_html_e( 'Mother Email Address', 'nexora-school-management' ); ?></label>
							<input type="email" id="<?php echo esc_attr( $form_id ); ?>_mother_email" name="mother_email" placeholder="mother@example.com">
						</div>
					<?php endif; ?>
				</div>
				<div class="nexora-section-title"><?php echo esc_html( $is_inquiry ? __( 'Inquiry Details', 'nexora-school-management' ) : __( 'Address & Remarks', 'nexora-school-management' ) ); ?></div>
				<div class="nexora-form-grid">
					<?php if ( ! $is_inquiry ) : ?>
						<div class="nexora-field full">
							<label for="<?php echo esc_attr( $form_id ); ?>_address"><?php esc_html_e( 'Street Address', 'nexora-school-management' ); ?></label>
							<input type="text" id="<?php echo esc_attr( $form_id ); ?>_address" name="street_address" placeholder="<?php esc_attr_e( 'House / Building / Street', 'nexora-school-management' ); ?>">
						</div>
						<div class="nexora-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_city"><?php esc_html_e( 'City', 'nexora-school-management' ); ?></label>
							<input type="text" id="<?php echo esc_attr( $form_id ); ?>_city" name="city" placeholder="<?php esc_attr_e( 'City', 'nexora-school-management' ); ?>">
						</div>
						<div class="nexora-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_state"><?php esc_html_e( 'State / Province', 'nexora-school-management' ); ?></label>
							<input type="text" id="<?php echo esc_attr( $form_id ); ?>_state" name="state" placeholder="<?php esc_attr_e( 'State', 'nexora-school-management' ); ?>">
						</div>
					<?php endif; ?>
					<div class="nexora-field full">
						<label for="<?php echo esc_attr( $form_id ); ?>_remarks"><?php echo esc_html( $is_inquiry ? __( 'Inquiry Message / Questions', 'nexora-school-management' ) : __( 'Additional Notes / Message', 'nexora-school-management' ) ); ?><?php echo $is_inquiry ? ' <span class="req">*</span>' : ''; ?></label>
						<textarea id="<?php echo esc_attr( $form_id ); ?>_remarks" name="remarks" rows="<?php echo $is_inquiry ? '4' : '3'; ?>"<?php echo $is_inquiry ? ' required' : ''; ?> placeholder="<?php echo esc_attr( $is_inquiry ? __( 'Ask about curriculum, fees, tours, or enrollment...', 'nexora-school-management' ) : __( 'Special requirements, medical notes, or questions...', 'nexora-school-management' ) ); ?>"></textarea>
					</div>
				</div>

				<button type="submit" class="nexora-submit-btn" id="<?php echo esc_attr( $btn_id ); ?>"><?php echo esc_html( $is_inquiry ? __( 'Send Inquiry', 'nexora-school-management' ) : __( 'Submit Application', 'nexora-school-management' ) ); ?></button>
			</form>

			<div id="<?php echo esc_attr( $msg_id ); ?>" class="nexora-response-msg"></div>
			<?php
			$success_msg  = '<strong>' . ( $is_inquiry ? __( 'Inquiry Sent!', 'nexora-school-management' ) : __( 'Application Received!', 'nexora-school-management' ) ) . '</strong> ' . __( 'Your reference number is', 'nexora-school-management' ) . ' <strong>{ref}</strong>.';
			$i18n_strings = [
				'submitting'   => __( 'Submitting...', 'nexora-school-management' ),
				'failed'       => __( 'Submission failed. Please verify required fields.', 'nexora-school-management' ),
				'networkError' => __( 'Network error occurred. Please try again.', 'nexora-school-management' ),
			];
			wp_add_inline_script(
				'nexora-public-admissions',
				sprintf(
					'window.nexoraSubmitForm(%s, %s, %s, %s, %s, %s);',
					wp_json_encode( $form_id ),
					wp_json_encode( $btn_id ),
					wp_json_encode( $msg_id ),
					wp_json_encode( $post_url ),
					wp_json_encode( $success_msg ),
					wp_json_encode( $i18n_strings )
				)
			);
			?>
		</div>
		<?php
		return (string) ob_get_clean();
	}

	/**
	 * Renders the lightweight admission inquiry form [nexora_inquiry_form].
	 */
	public static function render_inquiry_form( array $atts = [] ): string {
		return self::render_admission_form( array_merge( $atts, [ 'inquiry' => true ] ) );
	}

	/**
	 * Renders the public careers / staff application form [nexora_staff_application_form].
	 */
	public static function render_staff_application_form( array $atts = [] ): string {
		$post_url  = esc_url( rest_url( 'nexora/v1/public/staff-applications' ) );
		$width_css = self::get_width_style( $atts );
		ob_start();
		self::enqueue_public_assets();
		?>
		<div class="nexora-public-wrap"<?php if ( '' !== $width_css ) : ?> style="<?php echo esc_attr( $width_css ); ?>"<?php endif; ?>>
			<div class="nexora-header">
				<h3><?php esc_html_e( 'Staff Application', 'nexora-school-management' ); ?></h3>
				<p class="desc"><?php esc_html_e( 'Submit your employment application below.', 'nexora-school-management' ); ?></p>
			</div>

			<form id="nexora-staff-app-form" action="#">
				<div class="nexora-section-title"><?php esc_html_e( 'Applicant Details', 'nexora-school-management' ); ?></div>
				<div class="nexora-form-grid">
					<div class="nexora-field">
						<label for="staff_first_name"><?php esc_html_e( 'First Name', 'nexora-school-management' ); ?> <span class="req">*</span></label>
						<input type="text" id="staff_first_name" name="first_name" required placeholder="<?php esc_attr_e( 'First name', 'nexora-school-management' ); ?>">
					</div>
					<div class="nexora-field">
						<label for="staff_last_name"><?php esc_html_e( 'Last Name', 'nexora-school-management' ); ?> <span class="req">*</span></label>
						<input type="text" id="staff_last_name" name="last_name" required placeholder="<?php esc_attr_e( 'Last name', 'nexora-school-management' ); ?>">
					</div>
					<div class="nexora-field">
						<label for="staff_email"><?php esc_html_e( 'Email Address', 'nexora-school-management' ); ?> <span class="req">*</span></label>
						<input type="email" id="staff_email" name="email" required placeholder="applicant@example.com">
					</div>
					<div class="nexora-field">
						<label for="staff_phone"><?php esc_html_e( 'Phone Number', 'nexora-school-management' ); ?> <span class="req">*</span></label>
						<input type="tel" id="staff_phone" name="phone" required placeholder="+1 (555) 000-0000">
					</div>
					<div class="nexora-field">
						<label for="staff_dob"><?php esc_html_e( 'Date of Birth (Optional)', 'nexora-school-management' ); ?></label>
						<input type="date" id="staff_dob" name="date_of_birth">
					</div>
					<div class="nexora-field">
						<label for="staff_city"><?php esc_html_e( 'City / Location', 'nexora-school-management' ); ?></label>
						<input type="text" id="staff_city" name="city" placeholder="<?php esc_attr_e( 'City', 'nexora-school-management' ); ?>">
					</div>
				</div>

				<div class="nexora-section-title"><?php esc_html_e( 'Position & Qualifications', 'nexora-school-management' ); ?></div>
				<div class="nexora-form-grid">
					<div class="nexora-field">
						<label for="desired_role"><?php esc_html_e( 'Position / Role Applied For', 'nexora-school-management' ); ?> <span class="req">*</span></label>
						<input type="text" id="desired_role" name="desired_role" required placeholder="<?php esc_attr_e( 'e.g. Science Teacher, Counselor', 'nexora-school-management' ); ?>">
					</div>
					<div class="nexora-field">
						<label for="department"><?php esc_html_e( 'Department / Subject', 'nexora-school-management' ); ?></label>
						<input type="text" id="department" name="department" placeholder="<?php esc_attr_e( 'e.g. Science, Mathematics', 'nexora-school-management' ); ?>">
					</div>
					<div class="nexora-field">
						<label for="qualification"><?php esc_html_e( 'Highest Qualification', 'nexora-school-management' ); ?></label>
						<input type="text" id="qualification" name="qualification" placeholder="<?php esc_attr_e( 'e.g. M.Sc. Physics, B.Ed', 'nexora-school-management' ); ?>">
					</div>
					<div class="nexora-field">
						<label for="experience_years"><?php esc_html_e( 'Years of Relevant Experience', 'nexora-school-management' ); ?></label>
						<input type="text" id="experience_years" name="experience_years" placeholder="<?php esc_attr_e( 'e.g. 5 Years', 'nexora-school-management' ); ?>">
					</div>
					<div class="nexora-field full">
						<label for="experience_details"><?php esc_html_e( 'Work History & Previous Schools', 'nexora-school-management' ); ?></label>
						<textarea id="experience_details" name="experience_details" rows="3" placeholder="<?php esc_attr_e( 'Summary of previous positions held...', 'nexora-school-management' ); ?>"></textarea>
					</div>
					<div class="nexora-field full">
						<label for="cover_letter"><?php esc_html_e( 'Cover Letter & Teaching Philosophy', 'nexora-school-management' ); ?></label>
						<textarea id="cover_letter" name="cover_letter" rows="4" placeholder="<?php esc_attr_e( 'Tell us about your background and methodology...', 'nexora-school-management' ); ?>"></textarea>
					</div>
				</div>

				<button type="submit" class="nexora-submit-btn" id="nexora-staff-btn"><?php esc_html_e( 'Submit Staff Application', 'nexora-school-management' ); ?></button>
			</form>

			<div id="nexora-staff-response" class="nexora-response-msg"></div>
			<?php
			$staff_success_msg = '<strong>' . __( 'Application Received!', 'nexora-school-management' ) . '</strong> ' . __( 'Your reference number is', 'nexora-school-management' ) . ' <strong>{ref}</strong>.';
			$staff_i18n        = [
				'submitting'   => __( 'Submitting...', 'nexora-school-management' ),
				'failed'       => __( 'Submission failed. Please verify required fields.', 'nexora-school-management' ),
				'networkError' => __( 'Network error occurred. Please try again.', 'nexora-school-management' ),
			];
			wp_add_inline_script(
				'nexora-public-admissions',
				sprintf(
					'window.nexoraSubmitForm(%s, %s, %s, %s, %s, %s);',
					wp_json_encode( 'nexora-staff-app-form' ),
					wp_json_encode( 'nexora-staff-btn' ),
					wp_json_encode( 'nexora-staff-response' ),
					wp_json_encode( $post_url ),
					wp_json_encode( $staff_success_msg ),
					wp_json_encode( $staff_i18n )
				)
			);
			?>
		</div>
		<?php
		return (string) ob_get_clean();
	}

	/**
	 * Unified renderer for student and staff status lookup trackers.
	 *
	 * @param string $type Tracker type ('admission' or 'staff').
	 */
	private static function render_status_tracker( string $type = 'admission', array $atts = [] ): string {
		$is_staff = 'staff' === $type;
		$repo     = new SettingsRepository();
		$settings = $repo->get_settings();
		$enabled  = (bool) ( $settings['admissions']['enable_status_lookup'] ?? true );

		if ( ! $is_staff && ! $enabled ) {
			return '<div class="nexora-shortcode-msg nexora-warning"><p>' . esc_html__( 'Status lookup service is currently unavailable.', 'nexora-school-management' ) . '</p></div>';
		}
		$status_url = esc_url( rest_url( $is_staff ? 'nexora/v1/public/staff-applications/status' : 'nexora/v1/public/admissions/status' ) );
		$form_id    = $is_staff ? 'nexora-staff-status-form' : 'nexora-status-form';
		$btn_id     = $is_staff ? 'nexora-staff-status-btn' : 'nexora-status-btn';
		$out_id     = $is_staff ? 'nexora-staff-status-output' : 'nexora-status-output';
		$ref_id    = $is_staff ? 'staff_lookup_ref' : 'lookup_ref';
		$second_id = $is_staff ? 'staff_lookup_email' : 'lookup_dob';

		self::enqueue_public_assets();
		$width_css = self::get_width_style( $atts );
		ob_start();
		?>
		<div class="nexora-public-wrap nexora-lookup-wrap"<?php if ( '' !== $width_css ) : ?> style="<?php echo esc_attr( $width_css ); ?>"<?php endif; ?>>
			<div class="nexora-header">
				<h3><?php echo esc_html( $is_staff ? __( 'Staff Application Status Lookup', 'nexora-school-management' ) : __( 'Admission Status Lookup', 'nexora-school-management' ) ); ?></h3>
				<p class="desc"><?php echo esc_html( $is_staff ? __( 'Track your employment application with your reference number and email address.', 'nexora-school-management' ) : __( 'Enter your application reference number to track your admission status.', 'nexora-school-management' ) ); ?></p>
			</div>

			<form id="<?php echo esc_attr( $form_id ); ?>" action="#">
				<div class="nexora-form-grid">
					<div class="nexora-field">
						<label for="<?php echo esc_attr( $ref_id ); ?>"><?php esc_html_e( 'Reference Number', 'nexora-school-management' ); ?> <span class="req">*</span></label>
						<input type="text" id="<?php echo esc_attr( $ref_id ); ?>" name="reference_number" required placeholder="<?php echo esc_attr( $is_staff ? 'e.g. STFAPP20260001' : 'e.g. APP20260001' ); ?>">
					</div>
					<div class="nexora-field">
						<?php if ( $is_staff ) : ?>
							<label for="<?php echo esc_attr( $second_id ); ?>"><?php esc_html_e( 'Email Address', 'nexora-school-management' ); ?> <span class="req">*</span></label>
							<input type="email" id="<?php echo esc_attr( $second_id ); ?>" name="email" required placeholder="applicant@example.com">
						<?php else : ?>
							<label for="<?php echo esc_attr( $second_id ); ?>"><?php esc_html_e( 'Student Date of Birth', 'nexora-school-management' ); ?> <span class="req">*</span></label>
							<input type="date" id="<?php echo esc_attr( $second_id ); ?>" name="student_date_of_birth" required>
						<?php endif; ?>
					</div>
				</div>
				<button type="submit" class="nexora-submit-btn" id="<?php echo esc_attr( $btn_id ); ?>"><?php esc_html_e( 'Check Status', 'nexora-school-management' ); ?></button>
			</form>

			<div id="<?php echo esc_attr( $out_id ); ?>" class="nexora-tracker-card"></div>

			<?php
			$tracker_i18n = [
				'checking'             => __( 'Checking...', 'nexora-school-management' ),
				'check_status'         => __( 'Check Status', 'nexora-school-management' ),
				'app_received'         => __( 'Application received and logged in our system.', 'nexora-school-management' ),
				'submitted'            => __( 'Submitted', 'nexora-school-management' ),
				'under_review'         => __( 'Under Review', 'nexora-school-management' ),
				'staff_review_note'    => __( 'Your qualifications are currently being reviewed by the hiring department.', 'nexora-school-management' ),
				'adm_review_note'      => __( 'Your application is currently being reviewed by the admissions board.', 'nexora-school-management' ),
				'shortlisted'          => __( 'Shortlisted', 'nexora-school-management' ),
				'shortlisted_note'     => __( 'You have been shortlisted! Our HR department will contact you regarding interview scheduling.', 'nexora-school-management' ),
				'offer_extended'       => __( 'Offer Extended', 'nexora-school-management' ),
				'offer_extended_note'  => __( 'Congratulations! An employment offer has been extended. Please check your email.', 'nexora-school-management' ),
				'closed'               => __( 'Closed', 'nexora-school-management' ),
				'closed_note'          => __( 'Thank you for your interest. We have decided to proceed with other candidates for this role.', 'nexora-school-management' ),
				'assessment'           => __( 'Assessment', 'nexora-school-management' ),
				'assessment_note'      => __( 'An interview or assessment has been scheduled. Please check your email for details.', 'nexora-school-management' ),
				'approved'             => __( 'Approved', 'nexora-school-management' ),
				'approved_note'        => __( 'Congratulations! Your admission application has been approved.', 'nexora-school-management' ),
				'enrolled'             => __( 'Enrolled', 'nexora-school-management' ),
				'enrolled_note'        => __( 'Student enrollment is complete. Welcome to our school!', 'nexora-school-management' ),
				'decision_issued'      => __( 'Decision Issued', 'nexora-school-management' ),
				'decision_issued_note' => __( 'We regret that your application was not selected for admission in this academic session.', 'nexora-school-management' ),
				'current_status'       => __( 'Current Status:', 'nexora-school-management' ),
				'not_found'            => __( 'No application found with those verification details.', 'nexora-school-management' ),
				'lookup_error'         => __( 'Error looking up status. Please try again.', 'nexora-school-management' ),
				'ref_prefix'           => __( 'Ref:', 'nexora-school-management' ),
				'role_prefix'          => __( 'Role:', 'nexora-school-management' ),
				'class_prefix'         => __( 'Class:', 'nexora-school-management' ),
				'staff_default'        => __( 'Staff', 'nexora-school-management' ),
				'na_default'           => __( 'N/A', 'nexora-school-management' ),
				'step_received'        => __( 'Received', 'nexora-school-management' ),
				'step_screening'       => __( 'Screening', 'nexora-school-management' ),
				'step_interview'       => __( 'Interview', 'nexora-school-management' ),
				'step_decision'        => __( 'Decision', 'nexora-school-management' ),
				'step_review'          => __( 'Review', 'nexora-school-management' ),
				'step_assessment'      => __( 'Assessment', 'nexora-school-management' ),
			];
			$tracker_opts = [
				'formId'    => $form_id,
				'btnId'     => $btn_id,
				'outId'     => $out_id,
				'refId'     => $ref_id,
				'secondId'  => $second_id,
				'statusUrl' => $status_url,
				'isStaff'   => $is_staff,
				'i18n'      => $tracker_i18n,
			];
			wp_add_inline_script(
				'nexora-public-admissions',
				sprintf( 'window.nexoraInitStatusTracker(%s);', wp_json_encode( $tracker_opts ) )
			);
			?>
		</div>
		<?php
		return (string) ob_get_clean();
	}

	/**
	 * Renders the public application status lookup shortcode [nexora_application_status].
	 */
	public static function render_status_lookup( array $atts = [] ): string {
		return self::render_status_tracker( 'admission', $atts );
	}

	/**
	 * Renders the public staff application status lookup shortcode [nexora_staff_application_status].
	 *
	 * @param array $atts Shortcode attributes.
	 */
	public static function render_staff_status_lookup( array $atts = [] ): string {
		return self::render_status_tracker( 'staff', $atts );
	}

}
