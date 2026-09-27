<?php
/**
 * Plugin Name:       Nexora – School Management System
 * Plugin URI:        https://codeclove.com/plugins/nexora/
 * Description:       Modern, country-aware school management system for WordPress. Manage student admissions, classes, staff, and daily attendance.
 * Version:           1.0.0
 * Requires at least: 6.5
 * Requires PHP:      8.1
 * Author:            CodeClove
 * Author URI:        https://codeclove.com/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       nexora-school-management
 * Domain Path:       /languages
 *
 * @package Nexora_School_Management
 */

declare( strict_types=1 );

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}


// Bail if Nexora Pro is active.
if ( ( defined( 'NEXORA_IS_PRO' ) && NEXORA_IS_PRO ) || in_array( 'nexora/nexora.php', (array) get_option( 'active_plugins', [] ), true ) ) {
	return;
}

define( 'NEXORA_IS_PRO', false );
define( 'NEXORA_VERSION', '1.0.0' );
define( 'NEXORA_DB_VERSION', '1.0.21' );
define( 'NEXORA_FILE', __FILE__ );
require_once __DIR__ . '/includes/bootstrap.php';
