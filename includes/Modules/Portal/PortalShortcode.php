<?php
/**
 * Portal Public Shortcode handler.
 *
 * Provides the [codeclove_portal] shortcode:
 * - When guest: displays an elegant, responsive portal login form
 * - When logged in: mounts the portal SPA root (<div id="codeclove-portal-root"></div>),
 *   passes window.CodeClovePortalConfig, and enqueues Vite dev or production bundle.
 *
 * @package CodeClove\Modules\Portal
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Portal;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Modules\Settings\SettingsRepository;

/**
 * Class PortalShortcode
 */
final class PortalShortcode {

	/**
	 * Registers the shortcode and asset hooks.
	 */
	public static function register(): void {
		add_shortcode( 'codeclove_portal', [ __CLASS__, 'render_portal' ] );
		// Hide WP admin bar for portal-only roles (guardians/students don't need it)
		add_filter( 'show_admin_bar', [ __CLASS__, 'maybe_hide_admin_bar' ] );

		// Redirect portal login failures back to portal page
		add_action( 'wp_login_failed', [ __CLASS__, 'handle_login_failed' ] );
		add_filter( 'authenticate', [ __CLASS__, 'handle_empty_login_credentials' ], 99, 3 );
	}

	/**
	 * Hides the WP admin bar for codeclove_guardian and codeclove_student roles.
	 *
	 * @param bool $show Current visibility.
	 * @return bool
	 */
	public static function maybe_hide_admin_bar( bool $show ): bool {
		if ( ! is_user_logged_in() ) {
			return $show;
		}
		$user = wp_get_current_user();
		$portal_roles = [ 'codeclove_guardian', 'codeclove_student' ];
		if ( array_intersect( $portal_roles, (array) $user->roles ) ) {
			return false;
		}
		return $show;
	}
	/**
	 * Redirects failed portal login attempts back to the portal page with login=failed query arg.
	 */
	public static function handle_login_failed(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		if ( ! empty( $_POST['codeclove_portal_login'] ) ) {
			$referrer = wp_get_referer();
			if ( $referrer ) {
				$redirect = add_query_arg( 'login', 'failed', $referrer );
				wp_safe_redirect( $redirect );
				exit;
			}
		}
	}

	/**
	 * Intercepts empty credentials on portal login submissions to redirect back to portal page.
	 *
	 * @param mixed $user
	 * @param string $username
	 * @param string $password
	 * @return mixed
	 */
	public static function handle_empty_login_credentials( $user, $username, $password ) {
		if ( is_wp_error( $user ) ) {
			self::handle_login_failed();
		}
		return $user;
	}


	/**
	 * Main shortcode rendering handler.
	 *
	 * @return string HTML output.
	 */
	public static function render_portal(): string {
		$available = apply_filters( 'codeclove_portal_available', true );
		if ( ! $available ) {
			return '<div class="codeclove-portal-notice"><p>' . esc_html__( 'The student & guardian portal is currently unavailable. Please contact the school administration.', 'codeclove-school-management' ) . '</p></div>';
		}

		if ( ! is_user_logged_in() ) {
			return self::render_login_form();
		}

		return self::render_spa();
	}

	/**
	 * Renders the SPA container, config object, and bundles.
	 *
	 * @return string HTML.
	 */
	private static function render_spa(): string {
		$current_user = wp_get_current_user();
		$user_id      = (int) $current_user->ID;

		$settings_repo = new SettingsRepository();
		$settings      = $settings_repo->get_settings();
		$site_name     = ! empty( $settings['school']['name'] ) ? $settings['school']['name'] : get_bloginfo( 'name' );
		$logo_url      = ! empty( $settings['school']['logo'] ) ? $settings['school']['logo'] : ( CODECLOVE_URL . 'assets/defaults/logo.svg' );

		// Resolve student service context
		$portal_service = new PortalService();
		$portal_context = $portal_service->get_portal_user_context( $user_id );

		$config = [
			'restUrl'     => esc_url_raw( rest_url( 'codeclove/v1/' ) ),
			'nonce'       => wp_create_nonce( 'wp_rest' ),
			'locale'      => str_replace( '_', '-', determine_locale() ),
			'rtl'         => (bool) ( is_rtl() || ! empty( $settings['localization']['rtl'] ?? false ) ),
			'i18n'        => \CodeClove\Core\Assets::get_jed_data(),
			'currentUser' => [
				'id'       => $user_id,
				'name'     => $current_user->display_name,
				'email'    => $current_user->user_email,
				'roles'    => (array) $current_user->roles,
				'role'     => $portal_context['role'],
				'guardian' => $portal_context['guardian'],
				'student'  => $portal_context['student'],
			],
			'context'     => $portal_context,
			'logoutUrl'   => wp_logout_url( get_permalink() ?: home_url() ),
			'siteName'    => $site_name,
			'logoUrl'     => esc_url( $logo_url ),
			'version'     => CODECLOVE_VERSION,
			'isPro'       => false, // Free version — pro features locked.
			'settings'    => [
				'school'       => $settings['school'] ?? [],
				'appearance'   => $settings['appearance'] ?? [],
				'localization' => $settings['localization'] ?? [],
				'labels'       => $settings['labels'] ?? [],
			],
		];
		$config_json = wp_json_encode( $config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );

		$build_dir = CODECLOVE_DIR . 'assets/build/portal/';
		$build_url = CODECLOVE_URL . 'assets/build/portal/';

		if ( file_exists( $build_dir . 'index.css' ) ) {
			wp_enqueue_style( 'codeclove-portal-css', $build_url . 'index.css', [], CODECLOVE_VERSION );
		}
		if ( file_exists( $build_dir . 'index.js' ) ) {
			wp_enqueue_script( 'codeclove-portal-js', $build_url . 'index.js', [], CODECLOVE_VERSION, true );
			wp_add_inline_script(
				'codeclove-portal-js',
				'window.CodeClovePortalConfig = ' . $config_json . ';',
				'before'
			);
		}

		return '<div id="codeclove-portal-root" class="codeclove-portal-app"></div>';
	}

	/**
	 * Renders a modern, responsive login card for unauthenticated visitors.
	 *
	 * @return string HTML.
	 */
	private static function render_login_form(): string {
		$current_url = ! empty( $_SERVER['REQUEST_URI'] )
			? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) )
			: home_url();

		$settings_repo = new SettingsRepository();
		$settings      = $settings_repo->get_settings();
		$school_name   = ! empty( $settings['school']['name'] ) ? $settings['school']['name'] : get_bloginfo( 'name' );
		$logo_url      = ! empty( $settings['school']['logo'] ) ? $settings['school']['logo'] : ( CODECLOVE_URL . 'assets/defaults/logo.svg' );

		// Resolve brand color for login card styling
		$theme_color   = $settings['appearance']['theme_color'] ?? 'classic_indigo';
		$theme_hex_map = [
			'classic_indigo' => [ 'brand' => '#4f46e5', 'hover' => '#4338ca', 'light' => '#eef2ff' ],
			'sky_blue'       => [ 'brand' => '#2563eb', 'hover' => '#1d4ed8', 'light' => '#eff6ff' ],
			'sunset_orange'  => [ 'brand' => '#ea580c', 'hover' => '#c2410c', 'light' => '#fff7ed' ],
			'sunny_gold'     => [ 'brand' => '#d97706', 'hover' => '#b45309', 'light' => '#fffbeb' ],
			'fresh_mint'     => [ 'brand' => '#16a34a', 'hover' => '#15803d', 'light' => '#f0fdf4' ],
			'playful_violet' => [ 'brand' => '#7c3aed', 'hover' => '#6d28d9', 'light' => '#f5f3ff' ],
			'fun_pink'       => [ 'brand' => '#db2777', 'hover' => '#be185d', 'light' => '#fdf2f8' ],
		];
		$brand_colors  = $theme_hex_map[ $theme_color ] ?? $theme_hex_map['classic_indigo'];

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$login_error = isset( $_GET['login'] ) && 'failed' === sanitize_key( wp_unslash( $_GET['login'] ) );

		wp_enqueue_style(
			'codeclove-portal-login',
			CODECLOVE_URL . 'assets/css/portal-login.css',
			[],
			CODECLOVE_VERSION
		);
		$custom_css = sprintf(
			':root { --codeclove-brand: %s; --codeclove-brand-hover: %s; --codeclove-brand-light: %s; }',
			esc_attr( $brand_colors['brand'] ),
			esc_attr( $brand_colors['hover'] ),
			esc_attr( $brand_colors['light'] )
		);
		wp_add_inline_style( 'codeclove-portal-login', $custom_css );

		ob_start();
		?>
		<div class="codeclove-portal-login-wrap">
			<div class="codeclove-portal-brand">
				<div class="codeclove-portal-logo">
					<img src="<?php echo esc_url( $logo_url ); ?>" alt="<?php echo esc_attr( $school_name ); ?>" />
				</div>
				<h2 class="codeclove-portal-title"><?php echo esc_html( $school_name ); ?></h2>
				<p class="codeclove-portal-subtitle"><?php esc_html_e( 'Student & Guardian Portal Sign In', 'codeclove-school-management' ); ?></p>
			</div>

			<?php if ( $login_error ) : ?>
				<div class="codeclove-portal-alert">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
					<span><?php esc_html_e( 'Invalid username or password. Please try again.', 'codeclove-school-management' ); ?></span>
				</div>
			<?php endif; ?>

			<form method="post" action="<?php echo esc_url( site_url( 'wp-login.php', 'login_post' ) ); ?>">
				<input type="hidden" name="codeclove_portal_login" value="1" />
				<input type="hidden" name="redirect_to" value="<?php echo esc_url( $current_url ); ?>" />

				<div class="codeclove-login-field">
					<label class="codeclove-login-label" for="codeclove_user_login"><?php esc_html_e( 'Username or Email', 'codeclove-school-management' ); ?></label>
					<input type="text" name="log" id="codeclove_user_login" class="codeclove-login-input" required autocomplete="username" placeholder="<?php esc_attr_e( 'Enter your username or email', 'codeclove-school-management' ); ?>" />
				</div>

				<div class="codeclove-login-field">
					<label class="codeclove-login-label" for="codeclove_user_pass"><?php esc_html_e( 'Password', 'codeclove-school-management' ); ?></label>
					<input type="password" name="pwd" id="codeclove_user_pass" class="codeclove-login-input" required autocomplete="current-password" placeholder="<?php esc_attr_e( '••••••••', 'codeclove-school-management' ); ?>" />
				</div>

				<div class="codeclove-login-row">
					<label class="codeclove-login-remember">
						<input type="checkbox" name="rememberme" value="forever" />
						<span><?php esc_html_e( 'Remember me', 'codeclove-school-management' ); ?></span>
					</label>
					<a href="<?php echo esc_url( wp_lostpassword_url( $current_url ) ); ?>" class="codeclove-login-forgot">
						<?php esc_html_e( 'Forgot password?', 'codeclove-school-management' ); ?>
					</a>
				</div>

				<button type="submit" class="codeclove-portal-submit-btn">
					<?php esc_html_e( 'Sign In to Portal', 'codeclove-school-management' ); ?>
				</button>
			</form>

			<div class="codeclove-portal-footer">
				<span><?php esc_html_e( 'Protected by CodeClove School Management', 'codeclove-school-management' ); ?></span>
			</div>
		</div>
		<?php
		return (string) ob_get_clean();
	}
}
