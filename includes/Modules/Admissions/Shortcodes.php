<?php
/**
 * Public Shortcodes handler for Admissions, Inquiries, Careers and Status Lookups.
 *
 * Provides responsive, standalone public-facing shortcodes for:
 *   - [codeclove_admission_form]
 *   - [codeclove_inquiry_form]
 *   - [codeclove_application_status]
 *   - [codeclove_staff_application_form]
 *   - [codeclove_staff_application_status]
 *
 * @package CodeClove\Modules\Admissions
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Admissions;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Database\Schema;
use CodeClove\Modules\Settings\SettingsRepository;

/**
 * Class Shortcodes
 */
final class Shortcodes {

	/**
	 * Registers all public WordPress shortcodes.
	 */
	public static function register(): void {
		add_shortcode( 'codeclove_admission_form', [ __CLASS__, 'render_admission_form' ] );
		add_shortcode( 'codeclove_inquiry_form', [ __CLASS__, 'render_inquiry_form' ] );
		add_shortcode( 'codeclove_application_status', [ __CLASS__, 'render_status_lookup' ] );
		add_shortcode( 'codeclove_staff_application_form', [ __CLASS__, 'render_staff_application_form' ] );
		add_shortcode( 'codeclove_staff_application_status', [ __CLASS__, 'render_staff_status_lookup' ] );

	}

	/**
	 * Helper to fetch active academic units (classes/grades).
	 *
	 * @return array<int, array{id: int, name: string}>
	 */
	private static function get_academic_units(): array {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Shortcode academic units query.
		$units = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT u.id, u.name FROM %i u
				WHERE u.status = %s
				  AND (
				    u.academic_session_id = (SELECT id FROM %i WHERE status = %s ORDER BY id DESC LIMIT %d)
				    OR NOT EXISTS (SELECT 1 FROM %i WHERE status = %s)
				  )
				ORDER BY u.id ASC',
				Schema::units(),
				'active',
				Schema::sessions(),
				'active',
				1,
				Schema::sessions(),
				'active'
			),
			ARRAY_A
		);
		return $units ?: [];
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

		$named = [
			'full'    => '100%',
			'100%'    => '100%',
			'wide'    => '840px',
			'compact' => '520px',
		];

		if ( isset( $named[ $w ] ) ) {
			return 'width: ' . $named[ $w ] . '; max-width: 100%;';
		}

		$int_val = absint( preg_replace( '/[^0-9]/', '', $w ) );
		if ( $int_val >= 200 && $int_val <= 2000 ) {
			return 'width: ' . $int_val . 'px; max-width: 100%;';
		}

		return '';
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
			'codeclove-public-admissions',
			CODECLOVE_URL . 'assets/css/public-admissions.css',
			[],
			CODECLOVE_VERSION
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
			':root { --codeclove-brand: %1$s; --codeclove-brand-hover: color-mix(in srgb, %1$s 85%%, #000); --codeclove-brand-light: color-mix(in srgb, %1$s 8%%, #fff); --codeclove-brand-ring: color-mix(in srgb, %1$s 18%%, transparent); }',
			esc_attr( $brand )
		);
		wp_add_inline_style( 'codeclove-public-admissions', $custom_css );

		wp_enqueue_script(
			'codeclove-public-admissions',
			CODECLOVE_URL . 'assets/js/public-admissions.js',
			[],
			CODECLOVE_VERSION,
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
			return '<div class="codeclove-shortcode-msg codeclove-warning"><p>' . esc_html__( 'Public admissions submissions are currently closed.', 'codeclove-school-management' ) . '</p></div>';
		}

		$is_inquiry = ! empty( $atts['inquiry'] );
		$units      = self::get_academic_units();
		$post_url   = esc_url( rest_url( 'codeclove/v1/public/admissions' ) );
		$form_id    = $is_inquiry ? 'codeclove-inquiry-form' : 'codeclove-admission-form';
		$btn_id     = $is_inquiry ? 'codeclove-inquiry-btn' : 'codeclove-admission-btn';
		$msg_id     = $is_inquiry ? 'codeclove-inquiry-response' : 'codeclove-admission-response';
		ob_start();
		self::enqueue_public_assets();
		$width_css = self::get_width_style( $atts );
		?>
		<div class="codeclove-public-wrap"<?php if ( '' !== $width_css ) : ?> style="<?php echo esc_attr( $width_css ); ?>"<?php endif; ?>>
			<div class="codeclove-header">
				<h3><?php echo esc_html( $is_inquiry ? __( 'Admission Inquiry', 'codeclove-school-management' ) : __( 'Admission Application', 'codeclove-school-management' ) ); ?></h3>
				<p class="desc"><?php echo esc_html( $is_inquiry ? __( 'Have questions about admissions? Submit your inquiry below and our team will get in touch.', 'codeclove-school-management' ) : __( 'Please complete the application form below to submit your admission request.', 'codeclove-school-management' ) ); ?></p>
			</div>

			<form id="<?php echo esc_attr( $form_id ); ?>" action="#">
				<input type="hidden" name="status" value="<?php echo esc_attr( $is_inquiry ? 'inquiry' : 'submitted' ); ?>">
				<input type="hidden" name="source" value="<?php echo esc_attr( $is_inquiry ? 'inquiry_form' : 'public_form' ); ?>">

				<div class="codeclove-section-title"><?php esc_html_e( 'Student Details', 'codeclove-school-management' ); ?></div>
				<div class="codeclove-form-grid">
					<div class="codeclove-field">
						<label for="<?php echo esc_attr( $form_id ); ?>_first_name"><?php esc_html_e( 'Student First Name', 'codeclove-school-management' ); ?> <span class="req">*</span></label>
						<input type="text" id="<?php echo esc_attr( $form_id ); ?>_first_name" name="student_first_name" required placeholder="<?php esc_attr_e( 'First name', 'codeclove-school-management' ); ?>">
					</div>
					<div class="codeclove-field">
						<label for="<?php echo esc_attr( $form_id ); ?>_last_name"><?php esc_html_e( 'Student Last Name', 'codeclove-school-management' ); ?> <span class="req">*</span></label>
						<input type="text" id="<?php echo esc_attr( $form_id ); ?>_last_name" name="student_last_name" required placeholder="<?php esc_attr_e( 'Last name', 'codeclove-school-management' ); ?>">
					</div>
					<div class="codeclove-field">
						<label for="<?php echo esc_attr( $form_id ); ?>_dob"><?php esc_html_e( 'Date of Birth', 'codeclove-school-management' ); ?></label>
						<input type="date" id="<?php echo esc_attr( $form_id ); ?>_dob" name="student_date_of_birth">
					</div>
					<?php if ( ! $is_inquiry ) : ?>
						<div class="codeclove-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_gender"><?php esc_html_e( 'Gender', 'codeclove-school-management' ); ?></label>
							<select id="<?php echo esc_attr( $form_id ); ?>_gender" name="student_gender">
								<option value="male"><?php esc_html_e( 'Male', 'codeclove-school-management' ); ?></option>
								<option value="female"><?php esc_html_e( 'Female', 'codeclove-school-management' ); ?></option>
								<option value="non_binary"><?php esc_html_e( 'Non-binary', 'codeclove-school-management' ); ?></option>
								<option value="prefer_not_to_say"><?php esc_html_e( 'Prefer not to say', 'codeclove-school-management' ); ?></option>
							</select>
						</div>
					<?php endif; ?>
					<div class="codeclove-field<?php echo $is_inquiry ? '' : ' full'; ?>">
						<label for="<?php echo esc_attr( $form_id ); ?>_unit"><?php esc_html_e( 'Class / Grade Applying For', 'codeclove-school-management' ); ?> <span class="req">*</span></label>
						<select id="<?php echo esc_attr( $form_id ); ?>_unit" name="academic_unit_id" required>
							<option value=""><?php esc_html_e( 'Select Grade / Class', 'codeclove-school-management' ); ?></option>
							<?php foreach ( $units as $u ) : ?>
								<option value="<?php echo esc_attr( (string) $u['id'] ); ?>"><?php echo esc_html( (string) $u['name'] ); ?></option>
							<?php endforeach; ?>
						</select>
					</div>
					<?php if ( ! $is_inquiry ) : ?>
						<div class="codeclove-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_prev_school"><?php esc_html_e( 'Previous School Attended', 'codeclove-school-management' ); ?></label>
							<input type="text" id="<?php echo esc_attr( $form_id ); ?>_prev_school" name="previous_school_name" placeholder="<?php esc_attr_e( 'School name', 'codeclove-school-management' ); ?>">
						</div>
						<div class="codeclove-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_prev_grade"><?php esc_html_e( 'Last Grade Completed', 'codeclove-school-management' ); ?></label>
							<input type="text" id="<?php echo esc_attr( $form_id ); ?>_prev_grade" name="previous_grade_completed" placeholder="<?php esc_attr_e( 'e.g. Grade 4', 'codeclove-school-management' ); ?>">
						</div>
					<?php endif; ?>
				</div>

				<div class="codeclove-section-title"><?php esc_html_e( 'Parent & Contact Details', 'codeclove-school-management' ); ?></div>
				<div class="codeclove-form-grid">
					<div class="codeclove-field full">
						<label for="<?php echo esc_attr( $form_id ); ?>_parent_name"><?php echo esc_html( $is_inquiry ? __( 'Parent / Guardian Full Name', 'codeclove-school-management' ) : __( 'Father Full Name', 'codeclove-school-management' ) ); ?> <span class="req">*</span></label>
						<input type="text" id="<?php echo esc_attr( $form_id ); ?>_parent_name" name="father_name" required placeholder="<?php esc_attr_e( 'Full name', 'codeclove-school-management' ); ?>">
					</div>
					<div class="codeclove-field">
						<label for="<?php echo esc_attr( $form_id ); ?>_parent_phone"><?php esc_html_e( 'Mobile Phone', 'codeclove-school-management' ); ?> <span class="req">*</span></label>
						<input type="tel" id="<?php echo esc_attr( $form_id ); ?>_parent_phone" name="father_phone" required placeholder="+1 (555) 000-0000">
					</div>
					<div class="codeclove-field">
						<label for="<?php echo esc_attr( $form_id ); ?>_parent_email"><?php esc_html_e( 'Email Address', 'codeclove-school-management' ); ?> <span class="req">*</span></label>
						<input type="email" id="<?php echo esc_attr( $form_id ); ?>_parent_email" name="father_email" required placeholder="parent@example.com">
					</div>
					<?php if ( ! $is_inquiry ) : ?>
						<div class="codeclove-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_father_occ"><?php esc_html_e( 'Father Occupation', 'codeclove-school-management' ); ?></label>
							<input type="text" id="<?php echo esc_attr( $form_id ); ?>_father_occ" name="father_occupation" placeholder="<?php esc_attr_e( 'Occupation', 'codeclove-school-management' ); ?>">
						</div>
						<div class="codeclove-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_mother_name"><?php esc_html_e( 'Mother Full Name', 'codeclove-school-management' ); ?></label>
							<input type="text" id="<?php echo esc_attr( $form_id ); ?>_mother_name" name="mother_name" placeholder="<?php esc_attr_e( 'Mother name', 'codeclove-school-management' ); ?>">
						</div>
						<div class="codeclove-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_mother_phone"><?php esc_html_e( 'Mother Mobile Number', 'codeclove-school-management' ); ?></label>
							<input type="tel" id="<?php echo esc_attr( $form_id ); ?>_mother_phone" name="mother_phone" placeholder="+1 (555) 000-0000">
						</div>
						<div class="codeclove-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_mother_email"><?php esc_html_e( 'Mother Email Address', 'codeclove-school-management' ); ?></label>
							<input type="email" id="<?php echo esc_attr( $form_id ); ?>_mother_email" name="mother_email" placeholder="mother@example.com">
						</div>
					<?php endif; ?>
				</div>
				<div class="codeclove-section-title"><?php echo esc_html( $is_inquiry ? __( 'Inquiry Details', 'codeclove-school-management' ) : __( 'Address & Remarks', 'codeclove-school-management' ) ); ?></div>
				<div class="codeclove-form-grid">
					<?php if ( ! $is_inquiry ) : ?>
						<div class="codeclove-field full">
							<label for="<?php echo esc_attr( $form_id ); ?>_address"><?php esc_html_e( 'Street Address', 'codeclove-school-management' ); ?></label>
							<input type="text" id="<?php echo esc_attr( $form_id ); ?>_address" name="street_address" placeholder="<?php esc_attr_e( 'House / Building / Street', 'codeclove-school-management' ); ?>">
						</div>
						<div class="codeclove-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_city"><?php esc_html_e( 'City', 'codeclove-school-management' ); ?></label>
							<input type="text" id="<?php echo esc_attr( $form_id ); ?>_city" name="city" placeholder="<?php esc_attr_e( 'City', 'codeclove-school-management' ); ?>">
						</div>
						<div class="codeclove-field">
							<label for="<?php echo esc_attr( $form_id ); ?>_state"><?php esc_html_e( 'State / Province', 'codeclove-school-management' ); ?></label>
							<input type="text" id="<?php echo esc_attr( $form_id ); ?>_state" name="state" placeholder="<?php esc_attr_e( 'State', 'codeclove-school-management' ); ?>">
						</div>
					<?php endif; ?>
					<div class="codeclove-field full">
						<label for="<?php echo esc_attr( $form_id ); ?>_remarks"><?php echo esc_html( $is_inquiry ? __( 'Inquiry Message / Questions', 'codeclove-school-management' ) : __( 'Additional Notes / Message', 'codeclove-school-management' ) ); ?><?php echo $is_inquiry ? ' <span class="req">*</span>' : ''; ?></label>
						<textarea id="<?php echo esc_attr( $form_id ); ?>_remarks" name="remarks" rows="<?php echo $is_inquiry ? '4' : '3'; ?>"<?php echo $is_inquiry ? ' required' : ''; ?> placeholder="<?php echo esc_attr( $is_inquiry ? __( 'Ask about curriculum, fees, tours, or enrollment...', 'codeclove-school-management' ) : __( 'Special requirements, medical notes, or questions...', 'codeclove-school-management' ) ); ?>"></textarea>
					</div>
				</div>

				<button type="submit" class="codeclove-submit-btn" id="<?php echo esc_attr( $btn_id ); ?>"><?php echo esc_html( $is_inquiry ? __( 'Send Inquiry', 'codeclove-school-management' ) : __( 'Submit Application', 'codeclove-school-management' ) ); ?></button>
			</form>

			<div id="<?php echo esc_attr( $msg_id ); ?>" class="codeclove-response-msg"></div>
			<?php
			$success_msg  = '<strong>' . ( $is_inquiry ? __( 'Inquiry Sent!', 'codeclove-school-management' ) : __( 'Application Received!', 'codeclove-school-management' ) ) . '</strong> ' . __( 'Your reference number is', 'codeclove-school-management' ) . ' <strong>{ref}</strong>.';
			$i18n_strings = [
				'submitting'   => __( 'Submitting...', 'codeclove-school-management' ),
				'failed'       => __( 'Submission failed. Please verify required fields.', 'codeclove-school-management' ),
				'networkError' => __( 'Network error occurred. Please try again.', 'codeclove-school-management' ),
			];
			wp_add_inline_script(
				'codeclove-public-admissions',
				sprintf(
					'window.codecloveSubmitForm(%s, %s, %s, %s, %s, %s);',
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
	 * Renders the lightweight admission inquiry form [codeclove_inquiry_form].
	 */
	public static function render_inquiry_form( array $atts = [] ): string {
		return self::render_admission_form( array_merge( $atts, [ 'inquiry' => true ] ) );
	}

	/**
	 * Renders the public careers / staff application form [codeclove_staff_application_form].
	 */
	public static function render_staff_application_form( array $atts = [] ): string {
		$post_url  = esc_url( rest_url( 'codeclove/v1/public/staff-applications' ) );
		$width_css = self::get_width_style( $atts );
		ob_start();
		self::enqueue_public_assets();
		?>
		<div class="codeclove-public-wrap"<?php if ( '' !== $width_css ) : ?> style="<?php echo esc_attr( $width_css ); ?>"<?php endif; ?>>
			<div class="codeclove-header">
				<h3><?php esc_html_e( 'Staff Application', 'codeclove-school-management' ); ?></h3>
				<p class="desc"><?php esc_html_e( 'Submit your employment application below.', 'codeclove-school-management' ); ?></p>
			</div>

			<form id="codeclove-staff-app-form" action="#">
				<div class="codeclove-section-title"><?php esc_html_e( 'Applicant Details', 'codeclove-school-management' ); ?></div>
				<div class="codeclove-form-grid">
					<div class="codeclove-field">
						<label for="staff_first_name"><?php esc_html_e( 'First Name', 'codeclove-school-management' ); ?> <span class="req">*</span></label>
						<input type="text" id="staff_first_name" name="first_name" required placeholder="<?php esc_attr_e( 'First name', 'codeclove-school-management' ); ?>">
					</div>
					<div class="codeclove-field">
						<label for="staff_last_name"><?php esc_html_e( 'Last Name', 'codeclove-school-management' ); ?> <span class="req">*</span></label>
						<input type="text" id="staff_last_name" name="last_name" required placeholder="<?php esc_attr_e( 'Last name', 'codeclove-school-management' ); ?>">
					</div>
					<div class="codeclove-field">
						<label for="staff_email"><?php esc_html_e( 'Email Address', 'codeclove-school-management' ); ?> <span class="req">*</span></label>
						<input type="email" id="staff_email" name="email" required placeholder="applicant@example.com">
					</div>
					<div class="codeclove-field">
						<label for="staff_phone"><?php esc_html_e( 'Phone Number', 'codeclove-school-management' ); ?> <span class="req">*</span></label>
						<input type="tel" id="staff_phone" name="phone" required placeholder="+1 (555) 000-0000">
					</div>
					<div class="codeclove-field">
						<label for="staff_dob"><?php esc_html_e( 'Date of Birth (Optional)', 'codeclove-school-management' ); ?></label>
						<input type="date" id="staff_dob" name="date_of_birth">
					</div>
					<div class="codeclove-field">
						<label for="staff_city"><?php esc_html_e( 'City / Location', 'codeclove-school-management' ); ?></label>
						<input type="text" id="staff_city" name="city" placeholder="<?php esc_attr_e( 'City', 'codeclove-school-management' ); ?>">
					</div>
				</div>

				<div class="codeclove-section-title"><?php esc_html_e( 'Position & Qualifications', 'codeclove-school-management' ); ?></div>
				<div class="codeclove-form-grid">
					<div class="codeclove-field">
						<label for="desired_role"><?php esc_html_e( 'Position / Role Applied For', 'codeclove-school-management' ); ?> <span class="req">*</span></label>
						<input type="text" id="desired_role" name="desired_role" required placeholder="<?php esc_attr_e( 'e.g. Science Teacher, Counselor', 'codeclove-school-management' ); ?>">
					</div>
					<div class="codeclove-field">
						<label for="department"><?php esc_html_e( 'Department / Subject', 'codeclove-school-management' ); ?></label>
						<input type="text" id="department" name="department" placeholder="<?php esc_attr_e( 'e.g. Science, Mathematics', 'codeclove-school-management' ); ?>">
					</div>
					<div class="codeclove-field">
						<label for="qualification"><?php esc_html_e( 'Highest Qualification', 'codeclove-school-management' ); ?></label>
						<input type="text" id="qualification" name="qualification" placeholder="<?php esc_attr_e( 'e.g. M.Sc. Physics, B.Ed', 'codeclove-school-management' ); ?>">
					</div>
					<div class="codeclove-field">
						<label for="experience_years"><?php esc_html_e( 'Years of Relevant Experience', 'codeclove-school-management' ); ?></label>
						<input type="text" id="experience_years" name="experience_years" placeholder="<?php esc_attr_e( 'e.g. 5 Years', 'codeclove-school-management' ); ?>">
					</div>
					<div class="codeclove-field full">
						<label for="experience_details"><?php esc_html_e( 'Work History & Previous Schools', 'codeclove-school-management' ); ?></label>
						<textarea id="experience_details" name="experience_details" rows="3" placeholder="<?php esc_attr_e( 'Summary of previous positions held...', 'codeclove-school-management' ); ?>"></textarea>
					</div>
					<div class="codeclove-field full">
						<label for="cover_letter"><?php esc_html_e( 'Cover Letter & Teaching Philosophy', 'codeclove-school-management' ); ?></label>
						<textarea id="cover_letter" name="cover_letter" rows="4" placeholder="<?php esc_attr_e( 'Tell us about your background and methodology...', 'codeclove-school-management' ); ?>"></textarea>
					</div>
				</div>

				<button type="submit" class="codeclove-submit-btn" id="codeclove-staff-btn"><?php esc_html_e( 'Submit Staff Application', 'codeclove-school-management' ); ?></button>
			</form>

			<div id="codeclove-staff-response" class="codeclove-response-msg"></div>
			<?php
			$staff_success_msg = '<strong>' . __( 'Application Received!', 'codeclove-school-management' ) . '</strong> ' . __( 'Your reference number is', 'codeclove-school-management' ) . ' <strong>{ref}</strong>.';
			$staff_i18n        = [
				'submitting'   => __( 'Submitting...', 'codeclove-school-management' ),
				'failed'       => __( 'Submission failed. Please verify required fields.', 'codeclove-school-management' ),
				'networkError' => __( 'Network error occurred. Please try again.', 'codeclove-school-management' ),
			];
			wp_add_inline_script(
				'codeclove-public-admissions',
				sprintf(
					'window.codecloveSubmitForm(%s, %s, %s, %s, %s, %s);',
					wp_json_encode( 'codeclove-staff-app-form' ),
					wp_json_encode( 'codeclove-staff-btn' ),
					wp_json_encode( 'codeclove-staff-response' ),
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
		$enabled  = (bool) ( $settings[ $is_staff ? 'staff_onboarding' : 'admissions' ]['enable_status_lookup'] ?? true );

		if ( ! $enabled ) {
			return '<div class="codeclove-shortcode-msg codeclove-warning"><p>' . esc_html__( 'Status lookup service is currently unavailable.', 'codeclove-school-management' ) . '</p></div>';
		}
		$status_url = esc_url( rest_url( $is_staff ? 'codeclove/v1/public/staff-applications/status' : 'codeclove/v1/public/admissions/status' ) );
		$form_id    = $is_staff ? 'codeclove-staff-status-form' : 'codeclove-status-form';
		$btn_id     = $is_staff ? 'codeclove-staff-status-btn' : 'codeclove-status-btn';
		$out_id     = $is_staff ? 'codeclove-staff-status-output' : 'codeclove-status-output';
		$ref_id    = $is_staff ? 'staff_lookup_ref' : 'lookup_ref';
		$second_id = $is_staff ? 'staff_lookup_email' : 'lookup_dob';

		self::enqueue_public_assets();
		$width_css = self::get_width_style( $atts );
		ob_start();
		?>
		<div class="codeclove-public-wrap codeclove-lookup-wrap"<?php if ( '' !== $width_css ) : ?> style="<?php echo esc_attr( $width_css ); ?>"<?php endif; ?>>
			<div class="codeclove-header">
				<h3><?php echo esc_html( $is_staff ? __( 'Staff Application Status Lookup', 'codeclove-school-management' ) : __( 'Admission Status Lookup', 'codeclove-school-management' ) ); ?></h3>
				<p class="desc"><?php echo esc_html( $is_staff ? __( 'Track your employment application with your reference number and email address.', 'codeclove-school-management' ) : __( 'Enter your application reference number to track your admission status.', 'codeclove-school-management' ) ); ?></p>
			</div>

			<form id="<?php echo esc_attr( $form_id ); ?>" action="#">
				<div class="codeclove-form-grid">
					<div class="codeclove-field">
						<label for="<?php echo esc_attr( $ref_id ); ?>"><?php esc_html_e( 'Reference Number', 'codeclove-school-management' ); ?> <span class="req">*</span></label>
						<input type="text" id="<?php echo esc_attr( $ref_id ); ?>" name="reference_number" required placeholder="<?php echo esc_attr( $is_staff ? 'e.g. STFAPP20260001' : 'e.g. APP20260001' ); ?>">
					</div>
					<div class="codeclove-field">
						<?php if ( $is_staff ) : ?>
							<label for="<?php echo esc_attr( $second_id ); ?>"><?php esc_html_e( 'Email Address', 'codeclove-school-management' ); ?> <span class="req">*</span></label>
							<input type="email" id="<?php echo esc_attr( $second_id ); ?>" name="email" required placeholder="applicant@example.com">
						<?php else : ?>
							<label for="<?php echo esc_attr( $second_id ); ?>"><?php esc_html_e( 'Student Date of Birth', 'codeclove-school-management' ); ?> <span class="req">*</span></label>
							<input type="date" id="<?php echo esc_attr( $second_id ); ?>" name="student_date_of_birth" required>
						<?php endif; ?>
					</div>
				</div>
				<button type="submit" class="codeclove-submit-btn" id="<?php echo esc_attr( $btn_id ); ?>"><?php esc_html_e( 'Check Status', 'codeclove-school-management' ); ?></button>
			</form>

			<div id="<?php echo esc_attr( $out_id ); ?>" class="codeclove-tracker-card"></div>

			<?php
			$tracker_i18n = [
				'checking'             => __( 'Checking...', 'codeclove-school-management' ),
				'check_status'         => __( 'Check Status', 'codeclove-school-management' ),
				'app_received'         => __( 'Application received and logged in our system.', 'codeclove-school-management' ),
				'submitted'            => __( 'Submitted', 'codeclove-school-management' ),
				'under_review'         => __( 'Under Review', 'codeclove-school-management' ),
				'staff_review_note'    => __( 'Your qualifications are currently being reviewed by the hiring department.', 'codeclove-school-management' ),
				'adm_review_note'      => __( 'Your application is currently being reviewed by the admissions board.', 'codeclove-school-management' ),
				'shortlisted'          => __( 'Shortlisted', 'codeclove-school-management' ),
				'shortlisted_note'     => __( 'You have been shortlisted! Our HR department will contact you regarding interview scheduling.', 'codeclove-school-management' ),
				'offer_extended'       => __( 'Offer Extended', 'codeclove-school-management' ),
				'offer_extended_note'  => __( 'Congratulations! An employment offer has been extended. Please check your email.', 'codeclove-school-management' ),
				'closed'               => __( 'Closed', 'codeclove-school-management' ),
				'closed_note'          => __( 'Thank you for your interest. We have decided to proceed with other candidates for this role.', 'codeclove-school-management' ),
				'assessment'           => __( 'Assessment', 'codeclove-school-management' ),
				'assessment_note'      => __( 'An interview or assessment has been scheduled. Please check your email for details.', 'codeclove-school-management' ),
				'approved'             => __( 'Approved', 'codeclove-school-management' ),
				'approved_note'        => __( 'Congratulations! Your admission application has been approved.', 'codeclove-school-management' ),
				'enrolled'             => __( 'Enrolled', 'codeclove-school-management' ),
				'enrolled_note'        => __( 'Student enrollment is complete. Welcome to our school!', 'codeclove-school-management' ),
				'decision_issued'      => __( 'Decision Issued', 'codeclove-school-management' ),
				'decision_issued_note' => __( 'We regret that your application was not selected for admission in this academic session.', 'codeclove-school-management' ),
				'current_status'       => __( 'Current Status:', 'codeclove-school-management' ),
				'not_found'            => __( 'No application found with those verification details.', 'codeclove-school-management' ),
				'lookup_error'         => __( 'Error looking up status. Please try again.', 'codeclove-school-management' ),
				'ref_prefix'           => __( 'Ref:', 'codeclove-school-management' ),
				'role_prefix'          => __( 'Role:', 'codeclove-school-management' ),
				'class_prefix'         => __( 'Class:', 'codeclove-school-management' ),
				'staff_default'        => __( 'Staff', 'codeclove-school-management' ),
				'na_default'           => __( 'N/A', 'codeclove-school-management' ),
				'step_received'        => __( 'Received', 'codeclove-school-management' ),
				'step_screening'       => __( 'Screening', 'codeclove-school-management' ),
				'step_interview'       => __( 'Interview', 'codeclove-school-management' ),
				'step_decision'        => __( 'Decision', 'codeclove-school-management' ),
				'step_review'          => __( 'Review', 'codeclove-school-management' ),
				'step_assessment'      => __( 'Assessment', 'codeclove-school-management' ),
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
				'codeclove-public-admissions',
				sprintf( 'window.codecloveInitStatusTracker(%s);', wp_json_encode( $tracker_opts ) )
			);
			?>
		</div>
		<?php
		return (string) ob_get_clean();
	}

	/**
	 * Renders the public application status lookup shortcode [codeclove_application_status].
	 */
	public static function render_status_lookup( array $atts = [] ): string {
		return self::render_status_tracker( 'admission', $atts );
	}

	/**
	 * Renders the public staff application status lookup shortcode [codeclove_staff_application_status].
	 *
	 * @param array $atts Shortcode attributes.
	 */
	public static function render_staff_status_lookup( array $atts = [] ): string {
		return self::render_status_tracker( 'staff', $atts );
	}

}
