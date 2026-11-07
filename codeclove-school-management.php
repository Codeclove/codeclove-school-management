<?php
/**
 * Plugin Name:       CodeClove School Management System
 * Description:       Modern, country-aware school management system for WordPress. Manage student admissions, classes, staff, and daily attendance.
 * Version:           1.1.3
 * Requires at least: 6.5
 * Requires PHP:      8.1
 * Author:            CodeClove
 * Author URI:        https://codeclove.com/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       codeclove-school-management
 * Domain Path:       /languages
 *
 * @package CodeClove
 */

declare( strict_types=1 );

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Bail if Pro version is active or already loaded.
$codeclove_is_pro_active = false;
if ( defined( 'CODECLOVE_IS_PRO' ) && CODECLOVE_IS_PRO ) {
	$codeclove_is_pro_active = true;
} else {
	$codeclove_active_plugins = (array) get_option( 'active_plugins', [] );
	if ( is_multisite() ) {
		$codeclove_active_plugins = array_merge( $codeclove_active_plugins, array_keys( (array) get_site_option( 'active_sitewide_plugins', [] ) ) );
	}
	foreach ( $codeclove_active_plugins as $codeclove_plugin ) {
		if ( str_starts_with( (string) $codeclove_plugin, 'codeclove-school-management-pro/' ) ) {
			$codeclove_is_pro_active = true;
			break;
		}
	}
}

if ( $codeclove_is_pro_active ) {
	return;
}

if ( ! defined( 'CODECLOVE_IS_PRO' ) ) {
	define( 'CODECLOVE_IS_PRO', false );
}
if ( ! defined( 'CODECLOVE_VERSION' ) ) {
	define( 'CODECLOVE_VERSION', '1.1.3' );
}
if ( ! defined( 'CODECLOVE_DB_VERSION' ) ) {
	define( 'CODECLOVE_DB_VERSION', '1.0.29' );
}
if ( ! defined( 'CODECLOVE_FILE' ) ) {
	define( 'CODECLOVE_FILE', __FILE__ );
}
require_once __DIR__ . '/includes/bootstrap.php';
