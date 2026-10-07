<?php
/**
 * Main plugin bootstrap file.
 *
 * Defines shared constants, registers the autoloader, and initializes
 * the CodeClove core singleton.
 *
 * @package CodeClove
 */

declare( strict_types=1 );

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// ─── Shared Plugin Constants ──────────────────────────────────────────────────

$codeclove_file = defined( 'CODECLOVE_FILE' ) ? CODECLOVE_FILE : dirname( __DIR__ ) . '/codeclove-school-management.php';

if ( ! defined( 'CODECLOVE_FILE' ) ) {
	define( 'CODECLOVE_FILE', $codeclove_file );
}

define( 'CODECLOVE_DIR', plugin_dir_path( CODECLOVE_FILE ) );
if ( ! defined( 'CODECLOVE_PLUGIN_DIR' ) ) {
	define( 'CODECLOVE_PLUGIN_DIR', CODECLOVE_DIR );
}
define( 'CODECLOVE_URL', plugin_dir_url( CODECLOVE_FILE ) );
define( 'CODECLOVE_BASENAME', plugin_basename( CODECLOVE_FILE ) );

if ( ! defined( 'CODECLOVE_DEV_TOOLS' ) ) {
	define( 'CODECLOVE_DEV_TOOLS', false );
}

// ─── Autoloader ──────────────────────────────────────────────────────────────

if ( file_exists( CODECLOVE_DIR . 'vendor/autoload.php' ) ) {
	require_once CODECLOVE_DIR . 'vendor/autoload.php';
} else {
	// PSR-4 autoloader fallback for environments without Composer vendor directory.
	spl_autoload_register( static function( string $class ): void {
		$prefix   = 'CodeClove\\';
		$base_dir = CODECLOVE_DIR . 'includes/';

		$len = strlen( $prefix );
		if ( strncmp( $prefix, $class, $len ) !== 0 ) {
			return;
		}

		$relative_class = substr( $class, $len );
		$file           = $base_dir . str_replace( '\\', '/', $relative_class ) . '.php';

		if ( file_exists( $file ) ) {
			require_once $file;
		}
	} );
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

use CodeClove\Core\Plugin;

if ( ! function_exists( 'codeclove' ) ) {
	/**
	 * Returns the singleton plugin instance.
	 *
	 * @return Plugin
	 */
	function codeclove(): Plugin {
		return Plugin::get_instance();
	}
}

// Activation / deactivation hooks.
register_activation_hook( CODECLOVE_FILE, [ codeclove(), 'activate' ] );
register_deactivation_hook( CODECLOVE_FILE, [ codeclove(), 'deactivate' ] );

$pro_bootstrap = CODECLOVE_PLUGIN_DIR . 'pro/bootstrap.php';
if ( ! file_exists( $pro_bootstrap ) ) {
	$pro_bootstrap = dirname( __DIR__ ) . '/pro/bootstrap.php';
}
if ( file_exists( $pro_bootstrap ) ) {
	require_once $pro_bootstrap;
}

// Kick everything off.
codeclove()->run();

// Register WP-CLI commands if active.
if ( defined( 'WP_CLI' ) && WP_CLI ) {
	do_action( 'codeclove_cli_init' );
}

// ─── Global Helper ───────────────────────────────────────────────────────────

if ( ! function_exists( 'codeclove_user_can' ) ) {
	/**
	 * Global helper for CodeClove RBAC checks.
	 *
	 * Equivalent to WP's current_user_can() but for CodeClove permissions.
	 * WordPress administrators always return true.
	 *
	 * Usage:
	 *   if ( codeclove_user_can( get_current_user_id(), 'students.view' ) ) { ... }
	 *
	 * @param int    $user_id        WordPress user ID.
	 * @param string $permission_key Dot-notation permission key.
	 */
	function codeclove_user_can( int $user_id, string $permission_key ): bool {
		if ( user_can( $user_id, 'manage_options' ) ) {
			return true;
		}

		if ( class_exists( '\CodeClove\Core\Permissions' ) ) {
			return \CodeClove\Core\Permissions::check( $user_id, $permission_key );
		}

		return false;
	}
}

if ( ! function_exists( 'codeclove_get_portal_url' ) ) {
	/**
	 * Resolves the public URL for the CodeClove Student & Parent Portal.
	 *
	 * Checks filters, published pages containing the [codeclove_portal] shortcode
	 * or portal meta, common slugs, and falls back to a clean permalink.
	 *
	 * @return string Portal URL.
	 */
	function codeclove_get_portal_url(): string {
		$custom = apply_filters( 'codeclove_portal_url', null );
		if ( ! empty( $custom ) ) {
			return (string) $custom;
		}

		global $wpdb;
		if ( isset( $wpdb->posts ) ) {
			$page_id = (int) $wpdb->get_var(
				"SELECT p.ID FROM {$wpdb->posts} p
				 LEFT JOIN {$wpdb->postmeta} pm ON (p.ID = pm.post_id AND pm.meta_key = '_codeclove_shortcode_key')
				 WHERE p.post_type = 'page'
				   AND p.post_status = 'publish'
				   AND (pm.meta_value = 'portal' OR p.post_content LIKE '%[codeclove_portal%')
				 ORDER BY (pm.meta_value = 'portal') DESC, p.ID ASC
				 LIMIT 1"
			);

			if ( $page_id > 0 ) {
				$permalink = get_permalink( $page_id );
				if ( ! empty( $permalink ) ) {
					return $permalink;
				}
			}
		}

		// Fallback check for common page slugs if direct query yielded nothing.
		foreach ( [ 'student-portal', 'portal' ] as $slug ) {
			$page = get_page_by_path( $slug );
			if ( $page && 'publish' === $page->post_status ) {
				$permalink = get_permalink( $page->ID );
				if ( ! empty( $permalink ) ) {
					return $permalink;
				}
			}
		}

		return home_url( '/student-portal/' );
	}
}
