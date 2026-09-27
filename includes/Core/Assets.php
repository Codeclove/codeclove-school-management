<?php
/**
 * Asset management and fullscreen SPA renderer.
 *
 * Renders the isolated fullscreen SPA and completely bypasses the WordPress
 * admin chrome, header, footer, and scripts.
 *
 * @package Nexora\Core
 */

declare( strict_types=1 );

namespace Nexora\Core;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Assets
 */
final class Assets {

	private const BUILD_DIR = NEXORA_DIR . 'assets/build/admin/';
	private const BUILD_URL = NEXORA_URL . 'assets/build/admin/';

	private const JS_HANDLE  = 'nexora-admin';
	private const CSS_HANDLE = 'nexora-admin-css';

	/**
	 * Renders the fullscreen isolated SPA and terminates the request.
	 * Hooked to load-{page_hook}.
	 */
	public function render_fullscreen_spa(): void {
		// Prevent page caching.
		nocache_headers();

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			$menu_slug = defined( 'NEXORA_IS_PRO' ) && NEXORA_IS_PRO ? 'nexora' : 'nexora-school-management';
			wp_safe_redirect( wp_login_url( admin_url( 'admin.php?page=' . $menu_slug ) ) );
			exit;
		}

		// No valid license — admins go to the activation page; everyone else gets a clear error.
		if ( class_exists( '\Nexora\Licensing\License' ) && ( ! \Nexora\Licensing\License::verified() || ! \Nexora\Licensing\License::verify_integrity() ) ) {
			if ( current_user_can( 'manage_options' ) ) {
				wp_safe_redirect( admin_url( 'admin.php?page=nexora-license' ) );
				exit;
			}
			wp_die(
				esc_html__( 'Nexora is currently disabled. No valid license is active. Please contact your site administrator.', 'nexora-school-management' ),
				esc_html__( 'License Required', 'nexora-school-management' ),
				[ 'response' => 403 ]
			);
		}

		// Students, guardians, and users without staff permissions must never access the admin SPA.
		if ( ! current_user_can( 'manage_options' ) ) {
			if (
				current_user_can( 'nexora_guardian' )
				|| current_user_can( 'nexora_student' )
				|| empty( \Nexora\Core\Permissions::get_user_permissions( $user_id ) )
			) {
				wp_die(
					esc_html__( 'You do not have permission to access the Nexora administration panel.', 'nexora-school-management' ),
					esc_html__( 'Access Denied', 'nexora-school-management' ),
					[ 'response' => 403 ]
				);
			}
		}
		// phpcs:disable WordPress.WP.EnqueuedResources.NonEnqueuedScript, WordPress.WP.EnqueuedResources.NonEnqueuedStylesheet
		if ( $this->is_vite_dev_active() ) {
			$head = implode( "\n\t\t\t\t", [
				'<script type="module">',
					"import RefreshRuntime from 'http://localhost:5174/@react-refresh'",
					'RefreshRuntime.injectIntoGlobalHook(window)',
					'window.$RefreshReg$ = () => {}',
					'window.$RefreshSig$ = () => (type) => type',
					'window.__vite_plugin_react_preamble_installed__ = true',
				'</script>',
				'<script type="module" src="http://localhost:5174/@vite/client"></script>',
			] );
			$body = '<script type="module" src="http://localhost:5174/src/main.tsx?t=' . time() . '"></script>';
			$this->render_html( $head, $body );
		}

		$js_path  = self::BUILD_DIR . 'index.js';
		$css_path = self::BUILD_DIR . 'index.css';

		if ( ! file_exists( $js_path ) ) {
			wp_die(
				esc_html__( 'Nexora admin bundle not found. Please run "npm run build" in the admin directory.', 'nexora-school-management' )
			);
		}

		$head = file_exists( $css_path )
			? '<link rel="stylesheet" id="' . esc_attr( self::CSS_HANDLE ) . '" href="' . esc_url( self::BUILD_URL . 'index.css?ver=' . NEXORA_VERSION ) . '" media="all" />'
			: '';
		$body = '<script id="' . esc_attr( self::JS_HANDLE ) . '" src="' . esc_url( self::BUILD_URL . 'index.js?ver=' . NEXORA_VERSION ) . '"></script>';

		$this->render_html( $head, $body );
		// phpcs:enable
	}
	/**
	 * Renders the shared fullscreen HTML shell and exits.
	 *
	 * @param string $head_extras  HTML to inject inside <head> (scripts/styles).
	 * @param string $body_scripts HTML to inject before </body> (app entry script).
	 */
	private function render_html( string $head_extras, string $body_scripts ): void {
		$config_json = wp_json_encode( $this->build_config(), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );
		?>
		<!DOCTYPE html>
		<html <?php language_attributes(); ?>>
		<head>
			<meta charset="<?php bloginfo( 'charset' ); ?>">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title><?php esc_html_e( 'Nexora', 'nexora-school-management' ); ?></title>
			<link rel="icon" type="image/svg+xml" href="<?php echo esc_url( NEXORA_URL . 'assets/defaults/logo.svg' ); ?>">
			<link rel="shortcut icon" href="<?php echo esc_url( NEXORA_URL . 'assets/defaults/logo.svg' ); ?>">
			<?php if ( $head_extras ) echo $head_extras; // phpcs:ignore WordPress.Security.EscapeOutput ?>
			<?php wp_print_styles(); wp_print_head_scripts(); ?>
			<script>window.NexoraConfig = <?php echo $config_json; // phpcs:ignore WordPress.Security.EscapeOutput ?>;</script>
		</head>
		<body>
			<div id="nexora-root"></div>
			<?php echo $body_scripts; // phpcs:ignore WordPress.Security.EscapeOutput ?>
			<?php wp_print_footer_scripts(); ?>
		</body>
		</html>
		<?php
		exit;
	}

	/**
	 * Checks if Vite dev server is running.
	 *
	 * @return bool
	 */
	private function is_vite_dev_active(): bool {
		// Strict opt-in: only activate dev server if NEXORA_DEV is explicitly defined as true
		if ( ! defined( 'NEXORA_DEV' ) || ! NEXORA_DEV ) {
			return false;
		}
		$response = wp_remote_get( 'http://127.0.0.1:5174/@vite/client', [
			'timeout'   => 0.05,
			'sslverify' => false,
		] );

		if ( ! is_wp_error( $response ) && 200 === wp_remote_retrieve_response_code( $response ) ) {
			return true;
		}

		return false;
	}

	/**
	 *
	 * @return array<string, mixed>
	 */
	private function build_config(): array {
		$user    = wp_get_current_user();
		$user_id = (int) $user->ID;
		$is_admin = user_can( $user_id, 'manage_options' );

		// WP admins always have full access — skip the DB query entirely.
		// For Nexora Owner role users, get_user_permissions() returns ['*' => true].
		// The frontend must treat a permissions array containing '*' as "all granted".
		$permissions = $is_admin
			? [ '*' ]
			: array_keys( \Nexora\Core\Permissions::get_user_permissions( $user_id ) );

		global $wpdb;
		$staff_id = null;
		if ( $user_id > 0 ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$staff_id = $wpdb->get_var(
				$wpdb->prepare(
					'SELECT id FROM ' . \Nexora\Database\Schema::staff_members() . ' WHERE user_id = %d AND deleted_at IS NULL',
					$user_id
				)
			);
			// phpcs:enable
			$staff_id = $staff_id ? (int) $staff_id : null;
		}

		$is_dev_mode = ( defined( 'NEXORA_DEV_TOOLS' ) && NEXORA_DEV_TOOLS ) || ( defined( 'NEXORA_DEV' ) && NEXORA_DEV ) || ( defined( 'WP_RUNNING_TESTS' ) && WP_RUNNING_TESTS );
		$is_pro      = defined( 'NEXORA_IS_PRO' ) && NEXORA_IS_PRO;
		$pro_url     = 'https://codeclove.com/plugins/nexora/?utm_source=wp_plugin&utm_medium=pro_page&utm_campaign=upgrade';
		$settings    = get_option( 'nexora_settings', [] );
		$is_rtl      = is_rtl() || ! empty( $settings['localization']['rtl'] ?? false );

		return [
			'restUrl'     => rest_url( 'nexora/v1/' ),
			'nonce'       => wp_create_nonce( 'wp_rest' ),
			'adminUrl'    => admin_url( 'admin.php?page=' . ( $is_pro ? 'nexora' : 'nexora-school-management' ) ),
			'wpAdminUrl'  => admin_url(),
			'logoutUrl'   => wp_logout_url( admin_url() ),
			'pluginUrl'   => NEXORA_URL,
			'version'     => NEXORA_VERSION,
			'devMode'     => (bool) $is_dev_mode,
			'isPro'       => (bool) $is_pro,
			'proUrl'      => $pro_url,
			'permissions' => $permissions,
			'locale'      => determine_locale(),
			'rtl'         => (bool) $is_rtl,
			'i18n'        => self::get_jed_data(),
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
	 * Loads JED translation JSON data for the current locale.
	 *
	 * Checks WP_LANG_DIR first (WordPress.org translation updates), then plugin languages dir.
	 *
	 * @return array<string, mixed>|null
	 */
	public static function get_jed_data(): ?array {
		$locale = determine_locale();

		// Candidate file paths in order of precedence:
		$candidates = [];
		if ( defined( 'WP_LANG_DIR' ) ) {
			$candidates[] = WP_LANG_DIR . '/plugins/nexora-school-management-' . $locale . '.json';
		}
		$candidates[] = NEXORA_DIR . 'languages/nexora-school-management-' . $locale . '.json';

		$json = null;
		foreach ( $candidates as $file ) {
			if ( file_exists( $file ) ) {
				$content = file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
				if ( $content ) {
					$json = $content;
					break;
				}
			}
		}

		if ( ! $json ) {
			return null;
		}

		$data = json_decode( $json, true );
		if ( ! is_array( $data ) || empty( $data['locale_data'] ) ) {
			return null;
		}

		return $data;
	}
}
