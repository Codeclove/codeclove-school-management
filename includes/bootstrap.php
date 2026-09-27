<?php
/**
 * Main plugin bootstrap file.
 *
 * Loaded by both Nexora Pro (nexora.php) and Nexora Free (nexora-school-management.php).
 *
 * @package Nexora
 */

declare( strict_types=1 );

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// ─── Shared Plugin Constants ──────────────────────────────────────────────────

define( 'NEXORA_DIR', plugin_dir_path( NEXORA_FILE ) );
define( 'NEXORA_URL', plugin_dir_url( NEXORA_FILE ) );
define( 'NEXORA_BASENAME', plugin_basename( NEXORA_FILE ) );
if ( ! defined( 'NEXORA_DEV_TOOLS' ) ) {
	define( 'NEXORA_DEV_TOOLS', false );
}

// ─── Autoloader ──────────────────────────────────────────────────────────────

if ( file_exists( NEXORA_DIR . 'vendor/autoload.php' ) ) {
	require_once NEXORA_DIR . 'vendor/autoload.php';
} else {
	// PSR-4 autoloader fallback for environments without Composer vendor directory.
	spl_autoload_register( static function( string $class ): void {
		$prefix   = 'Nexora\\';
		$base_dir = NEXORA_DIR . 'includes/';

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

use Nexora\Core\Plugin;

if ( ! function_exists( 'nexora' ) ) {
	/**
	 * Returns the singleton plugin instance.
	 *
	 * @return Plugin
	 */
	function nexora(): Plugin {
		return Plugin::get_instance();
	}
}

// Activation / deactivation hooks.
register_activation_hook( NEXORA_FILE, [ nexora(), 'activate' ] );
register_deactivation_hook( NEXORA_FILE, [ nexora(), 'deactivate' ] );

// Kick everything off.
nexora()->run();

// Register WP-CLI command for database seeding if WP-CLI is active.
if ( defined( 'WP_CLI' ) && WP_CLI ) {
	if ( class_exists( '\Nexora\Database\DevSeeder' ) ) {
		\WP_CLI::add_command(
			'nexora db seed',
			static function ( array $args, array $assoc_args ): void {
				$country = isset( $assoc_args['country'] ) ? strtoupper( $assoc_args['country'] ) : 'IN';
				if ( ! in_array( $country, [ 'IN', 'US', 'GB' ], true ) ) {
					$country = 'IN';
				}
				$res = \Nexora\Database\DevSeeder::run( $country );
				if ( ! $res['success'] ) {
					\WP_CLI::error( $res['message'] );
				} else {
					\WP_CLI::success( $res['message'] );
				}
			}
		);

		\WP_CLI::add_command(
			'nexora db clear',
			static function ( array $args, array $assoc_args ): void {
				$res = \Nexora\Database\DevSeeder::clear();
				if ( ! $res['success'] ) {
					\WP_CLI::error( $res['message'] );
				} else {
					\WP_CLI::success( $res['message'] );
				}
			}
		);
	}
}

// ─── Global Helper ───────────────────────────────────────────────────────────

if ( ! function_exists( 'nexora_user_can' ) ) {
	/**
	 * Global helper for Nexora RBAC checks.
	 *
	 * Equivalent to WP's current_user_can() but for Nexora permissions.
	 * WordPress administrators always return true.
	 *
	 * Usage:
	 *   if ( nexora_user_can( get_current_user_id(), 'students.view' ) ) { ... }
	 *
	 * @param int    $user_id        WordPress user ID.
	 * @param string $permission_key Dot-notation permission key.
	 */
	function nexora_user_can( int $user_id, string $permission_key ): bool {
		if ( user_can( $user_id, 'manage_options' ) ) {
			return true;
		}

		return \Nexora\Core\Permissions::check( $user_id, $permission_key );
	}
}
