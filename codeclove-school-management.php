<?php
/**
 * Plugin Name:       CodeClove School Management System
 * Description:       Modern, country-aware school management system for WordPress. Manage student admissions, classes, staff, and daily attendance.
 * Version:           1.0.5
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

// Bail if Pro version is active.
if ( ( defined( 'CODECLOVE_IS_PRO' ) && CODECLOVE_IS_PRO ) || in_array( 'codeclove-school-management-pro/codeclove-school-management-pro.php', (array) get_option( 'active_plugins', [] ), true ) ) {
	return;
}

define( 'CODECLOVE_IS_PRO', false );
define( 'CODECLOVE_VERSION', '1.0.5' );
define( 'CODECLOVE_DB_VERSION', '1.0.22' );
define( 'CODECLOVE_FILE', __FILE__ );
require_once __DIR__ . '/includes/bootstrap.php';
