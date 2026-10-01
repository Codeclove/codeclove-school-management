<?php
/**
 * Asset management and fullscreen SPA renderer.
 *
 * Renders the isolated fullscreen SPA and completely bypasses the WordPress
 * admin chrome, header, footer, and scripts.
 *
 * @package CodeClove\Core
 */

declare( strict_types=1 );

namespace CodeClove\Core;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Assets
 */
final class Assets {

	private const JS_HANDLE  = 'codeclove-admin';
	private const CSS_HANDLE = 'codeclove-admin-css';

	/**
	 * Resolves build dir.
	 */
	private static function get_build_dir(): string {
		$dir = defined( 'CODECLOVE_DIR' ) ? CODECLOVE_DIR : '';
		return $dir . 'assets/build/admin/';
	}

	/**
	 * Resolves build url.
	 */
	private static function get_build_url(): string {
		$url = defined( 'CODECLOVE_URL' ) ? CODECLOVE_URL : '';
		return $url . 'assets/build/admin/';
	}

	/**
	 * Renders the fullscreen isolated SPA and terminates the request.
	 * Hooked to load-{page_hook}.
	 */
	public function render_fullscreen_spa(): void {
		// Prevent page caching.
		nocache_headers();

		$user_id = get_current_user_id();
		$menu_slug = 'codeclove-school-management';
		if ( ! $user_id ) {
			wp_safe_redirect( wp_login_url( admin_url( 'admin.php?page=' . $menu_slug ) ) );
			exit;
		}


		// Students, guardians, and users without staff permissions must never access the admin SPA.
		if ( ! current_user_can( 'manage_options' ) ) {
			$has_perms = class_exists( Permissions::class ) ? ! empty( Permissions::get_user_permissions( $user_id ) ) : false;
			if (
				current_user_can( 'codeclove_guardian' )
				|| current_user_can( 'codeclove_student' )
				|| ! $has_perms
			) {
				wp_die(
					esc_html__( 'You do not have permission to access the School Management administration panel.', 'codeclove-school-management' ),
					esc_html__( 'Access Denied', 'codeclove-school-management' ),
					[ 'response' => 403 ]
				);
			}
		}


		$build_dir = self::get_build_dir();
		$build_url = self::get_build_url();
		$version   = defined( 'CODECLOVE_VERSION' ) ? CODECLOVE_VERSION : '1.0.0';

		$js_path  = $build_dir . 'index.js';
		$css_path = $build_dir . 'index.css';

		if ( ! file_exists( $js_path ) ) {
			wp_die(
				esc_html__( 'School Management admin bundle not found. Please run "npm run build" in the admin directory.', 'codeclove-school-management' )
			);
		}

		// Enqueue via WordPress APIs — satisfies WP.org review requirements.
		if ( file_exists( $css_path ) ) {
			wp_enqueue_style( self::CSS_HANDLE, $build_url . 'index.css', [], $version );
		}
		wp_enqueue_script( self::JS_HANDLE, $build_url . 'index.js', [], $version, true );

		// Inline config — output is wp_json_encode()'d with full HEX escaping; safe.
		$config_json = wp_json_encode( $this->build_config(), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );
		wp_add_inline_script( self::JS_HANDLE, 'window.CodeCloveConfig = ' . $config_json . ';', 'before' );

		$this->render_html();
	}

	/**
	 * Renders the fullscreen HTML shell using WP's enqueue queue, then exits.
	 */
	private function render_html(): void {
		$plugin_url = defined( 'CODECLOVE_URL' ) ? CODECLOVE_URL : '';

		// WordPress 6.4+ deprecated print_emoji_styles() on wp_print_styles/admin_print_styles.
		// Core unhooks it inside wp_enqueue_emoji_styles() during standard enqueue actions.
		// Since our fullscreen SPA shell prints styles directly on load-{$hook}, remove the
		// deprecated handler (same pattern WordPress core uses in wp-includes/block-editor.php).
		remove_action( 'wp_print_styles', 'print_emoji_styles' );
		remove_action( 'admin_print_styles', 'print_emoji_styles' );
		?>
		<!DOCTYPE html>
		<html <?php language_attributes(); ?>>
		<head>
			<meta charset="<?php bloginfo( 'charset' ); ?>">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title><?php esc_html_e( 'School Management', 'codeclove-school-management' ); ?></title>
			<link rel="icon" type="image/svg+xml" href="<?php echo esc_url( $plugin_url . 'assets/defaults/logo.svg' ); ?>">
			<link rel="shortcut icon" href="<?php echo esc_url( $plugin_url . 'assets/defaults/logo.svg' ); ?>">
			<?php wp_print_styles(); wp_print_head_scripts(); ?>
		</head>
		<body>
			<div id="codeclove-root"></div>
			<?php wp_print_footer_scripts(); ?>
		</body>
		</html>
		<?php
		exit;
	}
	/**
	 * Builds config payload passed to the frontend via window.CodeCloveConfig.
	 *
	 * @return array<string, mixed>
	 */
	private function build_config(): array {
		$user    = wp_get_current_user();
		$user_id = (int) $user->ID;
		$is_admin = user_can( $user_id, 'manage_options' );

		// WP admins always have full access — skip the DB query entirely.
		// For CodeClove Owner role users, get_user_permissions() returns ['*' => true].
		// The frontend must treat a permissions array containing '*' as "all granted".
		$permissions = $is_admin
			? [ '*' ]
			: array_keys( Permissions::get_user_permissions( $user_id ) );

		global $wpdb;
		$staff_id = null;
		if ( $user_id > 0 ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Resolving staff member profile id.
			$staff_id = $wpdb->get_var(
				$wpdb->prepare(
					'SELECT id FROM %i WHERE user_id = %d AND deleted_at IS NULL',
					\CodeClove\Database\Schema::staff_members(),
					$user_id
				)
			);
			$staff_id = $staff_id ? (int) $staff_id : null;
		}

		$is_dev_mode = ( defined( 'CODECLOVE_DEV_TOOLS' ) && CODECLOVE_DEV_TOOLS ) || ( defined( 'CODECLOVE_DEV' ) && CODECLOVE_DEV ) || ( defined( 'WP_RUNNING_TESTS' ) && WP_RUNNING_TESTS );
		$is_pro      = defined( 'CODECLOVE_IS_PRO' ) && CODECLOVE_IS_PRO;
		$pro_url     = 'https://codeclove.com/?utm_source=wp_plugin&utm_medium=pro_page&utm_campaign=upgrade';
		$settings    = get_option( 'codeclove_settings', [] );
		$is_rtl      = is_rtl() || ! empty( $settings['localization']['rtl'] ?? false );
		$plugin_url  = defined( 'CODECLOVE_URL' ) ? CODECLOVE_URL : '';
		$version     = defined( 'CODECLOVE_VERSION' ) ? CODECLOVE_VERSION : '1.0.0';

		return [
			'restUrl'     => rest_url( 'codeclove/v1/' ),
			'nonce'       => wp_create_nonce( 'wp_rest' ),
			'adminUrl'    => admin_url( 'admin.php?page=codeclove-school-management' ),
			'wpAdminUrl'  => admin_url(),
			'logoutUrl'   => wp_logout_url( admin_url() ),
			'pluginUrl'   => $plugin_url,
			'version'     => $version,
			'devMode'     => (bool) $is_dev_mode,
			'isPro'       => (bool) $is_pro,
			'proUrl'      => $pro_url,
			'permissions' => $permissions,
			'locale'      => str_replace( '_', '-', determine_locale() ),
			'rtl'         => (bool) $is_rtl,
			'i18nUrl'     => self::get_i18n_url(),
			'currentUser' => [
				'id'       => $user_id,
				'staff_id' => $staff_id,
				'name'     => $user->display_name,
				'email'    => $user->user_email,
				'avatar'   => get_avatar_url( $user_id, [ 'size' => 64 ] ),
				'isAdmin'  => $is_admin,
			],
		];
	}

	/**
	 * Returns the URL of the JED translation JSON file for the current locale,
	 * or null for English (no file needed).
	 *
	 * Checks WP_LANG_DIR first (WordPress.org auto-updates), then the plugin's
	 * own languages/ directory.
	 *
	 * The file is served as a static asset — separately cacheable, not inlined
	 * into the HTML. The frontend fetches it before mounting.
	 *
	 * @return string|null
	 */
	public static function get_i18n_url(): ?string {
		$locale = determine_locale();
		$slug   = 'codeclove-school-management-' . $locale . '.json';

		// WP_LANG_DIR takes precedence (WordPress.org translation updates).
		if ( defined( 'WP_LANG_DIR' ) && file_exists( WP_LANG_DIR . '/plugins/' . $slug ) ) {
			return content_url( 'languages/plugins/' . $slug );
		}

		$plugin_dir = defined( 'CODECLOVE_DIR' ) ? CODECLOVE_DIR : '';
		$plugin_url = defined( 'CODECLOVE_URL' ) ? CODECLOVE_URL : '';

		if ( file_exists( $plugin_dir . 'languages/' . $slug ) ) {
			return $plugin_url . 'languages/' . $slug;
		}

		return null;
	}

	/**
	 * Loads JED translation JSON data for the current locale, or null if English.
	 *
	 * @return array<string, mixed>|null
	 */
	public static function get_jed_data(): ?array {
		$locale     = determine_locale();
		$slug       = 'codeclove-school-management-' . $locale . '.json';
		$plugin_dir = defined( 'CODECLOVE_DIR' ) ? CODECLOVE_DIR : '';
		$file       = $plugin_dir . 'languages/' . $slug;

		if ( file_exists( $file ) ) {
			$raw = file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions
			if ( false !== $raw ) {
				$decoded = json_decode( $raw, true );
				return is_array( $decoded ) ? $decoded : null;
			}
		}

		return null;
	}
}
