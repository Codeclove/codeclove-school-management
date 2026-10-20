<?php
/**
 * Login Customizer.
 *
 * Keeps WordPress login vanilla while branding the logo and school name.
 *
 * @package CodeClove\Core
 */

declare( strict_types=1 );

namespace CodeClove\Core;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Modules\Settings\SettingsRepository;

/**
 * Class LoginCustomizer
 */
final class LoginCustomizer {

	/**
	 * Registers vanilla WordPress login branding hooks.
	 */
	public static function register(): void {
		add_filter( 'login_headerurl', [ __CLASS__, 'custom_login_headerurl' ] );
		add_filter( 'login_headertext', [ __CLASS__, 'custom_login_headertext' ] );
		add_action( 'login_enqueue_scripts', [ __CLASS__, 'enqueue_school_logo' ] );
	}

	/**
	 * Returns the school website URL for the login logo link.
	 *
	 * @return string
	 */
	public static function custom_login_headerurl(): string {
		return home_url();
	}

	/**
	 * Returns the school name for the login logo tooltip/title.
	 *
	 * @return string
	 */
	public static function custom_login_headertext(): string {
		$settings_repo = new SettingsRepository();
		$settings      = $settings_repo->get_settings();
		return ! empty( $settings['school']['name'] ) ? (string) $settings['school']['name'] : get_bloginfo( 'name' );
	}

	/**
	 * Applies the school logo to standard wp-login.php using native WordPress CSS pattern.
	 */
	public static function enqueue_school_logo(): void {
		$settings_repo = new SettingsRepository();
		$settings      = $settings_repo->get_settings();
		$logo_url      = ! empty( $settings['school']['logo'] ) ? $settings['school']['logo'] : ( CODECLOVE_URL . 'assets/defaults/logo.svg' );
		?>
		<style type="text/css">
			#login h1 a, .login h1 a {
				background-image: url('<?php echo esc_url( $logo_url ); ?>') !important;
				background-size: contain !important;
				background-repeat: no-repeat !important;
				background-position: center !important;
				width: 84px !important;
				height: 84px !important;
				margin-bottom: 16px !important;
			}
		</style>
		<?php
	}
}
