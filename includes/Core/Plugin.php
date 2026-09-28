<?php
/**
 * Main CodeClove plugin orchestrator class.
 *
 * Handles activation, deactivation, singleton instantiation,
 * and boots core subsystems.
 *
 * @package CodeClove\Core
 */

declare( strict_types=1 );

namespace CodeClove\Core;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Api\RestApi;
use CodeClove\Database\Migrations;
use CodeClove\Database\Seeders\RolesSeeder;

/**
 * Class Plugin
 */
final class Plugin {

	/**
	 * The single instance of the class.
	 */
	private static ?self $instance = null;

	/**
	 * Private constructor to enforce singleton pattern.
	 */
	private function __construct() {}

	/**
	 * Prevent cloning.
	 */
	private function __clone() {}

	/**
	 * Prevent unserializing.
	 */
	public function __wakeup(): void {
		throw new \RuntimeException( 'Cannot unserialize singleton' );
	}

	/**
	 * Returns the singleton instance of the plugin.
	 */
	public static function get_instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	// ─── Lifecycle ───────────────────────────────────────────────────────────

	public function activate(): void {
		// Migrations must run first — RolesSeeder reads codeclove_roles which doesn't
		// exist until the schema is created.
		if ( class_exists( Migrations::class ) ) {
			Migrations::run();
		}

		// Load codeclove_settings once and pass it down — avoids a double get_option
		// (seed_defaults and maybe_run_migrations both read the same option).
		$settings = (array) get_option( 'codeclove_settings', [] );
		$this->seed_defaults( $settings );

		if ( class_exists( RolesSeeder::class ) ) {
			RolesSeeder::run();
		}

		// Register custom WordPress roles for school user classes.
		add_role( 'codeclove_staff', __( 'School Staff', 'codeclove-school-management' ), [ 'read' => true ] );
		add_role( 'codeclove_guardian', __( 'School Guardian', 'codeclove-school-management' ), [] );
		add_role( 'codeclove_student', __( 'School Student', 'codeclove-school-management' ), [] );

		// Schedule daily cron event to update overdue invoices.
		if ( ! wp_next_scheduled( 'codeclove_update_overdue_invoices' ) ) {
			wp_schedule_event( time(), 'daily', 'codeclove_update_overdue_invoices' );
		}

		flush_rewrite_rules();
	}

	/**
	 * Called on plugin deactivation.
	 * Does NOT drop tables — use uninstall.php for cleanup.
	 */
	public function deactivate(): void {
		wp_clear_scheduled_hook( 'codeclove_update_overdue_invoices' );
		// Remove custom WordPress roles.
		remove_role( 'codeclove_staff' );
		remove_role( 'codeclove_guardian' );
		remove_role( 'codeclove_student' );

		flush_rewrite_rules();
	}

	// ─── Bootstrap ───────────────────────────────────────────────────────────

	public function run(): void {
		$rest = new RestApi();

		// Register custom admin menu (single top-level page).
		add_action( 'admin_menu', [ $this, 'register_admin_menu' ] );

		// Register the REST API namespace and all routes.
		add_action( 'rest_api_init', [ $rest, 'register_routes' ] );

		// Run migrations when the plugin's DB version is outdated.
		add_action( 'plugins_loaded', [ $this, 'maybe_run_migrations' ] );

		// Daily cron + license heartbeat listeners.
		add_action( 'codeclove_update_overdue_invoices', [ $this, 'update_overdue_invoices' ] );

		$is_pro = defined( 'CODECLOVE_IS_PRO' ) && CODECLOVE_IS_PRO;
		if ( $is_pro ) {
			add_action( 'admin_notices', [ $this, 'maybe_show_pro_welcome_notice' ] );
		}

		if ( class_exists( '\CodeClove\Modules\Notifications\NotificationsService' ) ) {
			( new \CodeClove\Modules\Notifications\NotificationsService() )->init();
		}
		// Register Admissions Public Shortcodes.
		if ( class_exists( '\CodeClove\Modules\Admissions\Shortcodes' ) ) {
			\CodeClove\Modules\Admissions\Shortcodes::register();
		}

		// Register Student & Guardian Portal Public Shortcode.
		if ( class_exists( '\CodeClove\Modules\Portal\PortalShortcode' ) ) {
			\CodeClove\Modules\Portal\PortalShortcode::register();
		}

		// Redirect on login based on user roles.
		add_filter( 'login_redirect', [ $this, 'handle_login_redirect' ], 10, 3 );

		// Hide WP admin bar for portal-only roles.
		add_filter( 'show_admin_bar', [ $this, 'hide_admin_bar_for_portal_users' ] );

		// Restrict student and guardian portal accounts from accessing wp-admin.
		add_action( 'admin_init', [ $this, 'restrict_admin_access_for_portal_users' ] );
	}

	// ─── Admin Menu ──────────────────────────────────────────────────────────

	/**
	 * Registers the CodeClove top-level admin menu entry and hooks the fullscreen renderer.
	 */
	public function register_admin_menu(): void {
		$is_pro    = defined( 'CODECLOVE_IS_PRO' ) && CODECLOVE_IS_PRO;
		$menu_slug = 'codeclove-school-management';
		$page_hook = add_menu_page(
			__( 'School Management', 'codeclove-school-management' ),
			__( 'School Management', 'codeclove-school-management' ),
			'read',                          // CodeClove RBAC controls real access.
			$menu_slug,
			static fn() => null,             // Unreachable: load-{page} hook exits first.
			'dashicons-welcome-learn-more',  // Replaced by React icon in the app.
			30
		);

		// In Free version only: register submenu items highlighting the Pro upgrade.
		if ( ! $is_pro ) {
			add_submenu_page(
				$menu_slug,
				__( 'School Management Dashboard', 'codeclove-school-management' ),
				__( 'Dashboard', 'codeclove-school-management' ),
				'read',
				$menu_slug,
				static fn() => null
			);

			add_submenu_page(
				$menu_slug,
				__( 'Upgrade to Pro', 'codeclove-school-management' ),
				'<span style="color:#f59e0b;font-weight:600;">' . esc_html__( 'Upgrade to Pro ↗', 'codeclove-school-management' ) . '</span>',
				'read',
				$menu_slug . '#/pro-upgrade',
				static fn() => null
			);
		}

		$assets = new Assets();
		add_action( 'load-' . $page_hook, [ $assets, 'render_fullscreen_spa' ] );
	}

	// ─── License Notice ──────────────────────────────────────────────────────

	/**
	 * Shows a reassuring welcome notice when Pro is active alongside Free.
	 */
	public function maybe_show_pro_welcome_notice(): void {
		if ( ! current_user_can( 'activate_plugins' ) || ! in_array( 'codeclove-school-management/codeclove-school-management.php', (array) get_option( 'active_plugins', [] ), true ) ) {
			return;
		}

		printf(
			'<div class="notice notice-success is-dismissible"><p><strong>%s:</strong> %s</p></div>',
			esc_html__( 'School Management Pro Activated', 'codeclove-school-management' ),
			esc_html__( 'All your existing school data, students, and settings are active in Pro. You may safely deactivate and remove the Free version at your convenience.', 'codeclove-school-management' )
		);
	}

	// ─── Migrations ──────────────────────────────────────────────────────────

	/**
	 * Runs DB migrations when the stored schema version is outdated.
	 */
	public function maybe_run_migrations(): void {
		$settings       = get_option( 'codeclove_settings', [] );
		$stored_version = $settings['schema_version'] ?? '0.0.0';

		$db_version = defined( 'CODECLOVE_DB_VERSION' ) ? CODECLOVE_DB_VERSION : '1.0.0';

		if (
			version_compare( $stored_version, $db_version, '<' )
			|| ! Migrations::is_schema_installed()
		) {
			Migrations::run();
		}
	}

	// ─── Seeding ─────────────────────────────────────────────────────────────

	/**
	 * Seeds default plugin settings and roles on first activation.
	 *
	 * On fresh installs, populates all default sections.
	 * On existing installs, only stamps schema/plugin versions (preserving data).
	 * New setting sections introduced in future versions are seeded here on upgrade.
	 */
	private function seed_defaults( array $settings = [] ): void {
		if ( ! is_array( $settings ) ) {
			$settings = [];
		}
		// Caller may pass pre-loaded settings to avoid a redundant get_option().
		if ( empty( $settings ) ) {
			$settings = get_option( 'codeclove_settings', [] );
			if ( ! is_array( $settings ) ) {
				$settings = [];
			}
		}

		// Seed all default sections on fresh installs (education_system is the
		// canonical marker — if it's missing, the install is new or corrupted).
		if ( empty( $settings['education_system'] ) ) {
			$settings['education_system'] = [
				'preset'                    => null,
				'preset_name'               => null,
				'customized'                => false,
				'academic_year_start_month' => 1,
				'academic_year_end_month'   => 12,
				'date_format'               => 'd/m/Y',
				'time_format'               => 'H:i',
				'timezone'                  => 'UTC',
				'currency'                  => 'USD',
				'language'                  => 'en',
				'rtl'                       => false,
			];
			$settings['labels']           = [
				'academic_session' => [ 'singular' => 'Academic Session', 'plural' => 'Academic Sessions' ],
				'academic_term'    => [ 'singular' => 'Academic Term',    'plural' => 'Academic Terms'    ],
				'academic_unit'    => [ 'singular' => 'Academic Unit',    'plural' => 'Academic Units'    ],
				'academic_group'   => [ 'singular' => 'Academic Group',   'plural' => 'Academic Groups'   ],
			];
			$settings['school']           = [
				'name'  => get_bloginfo( 'name' ),
				'email' => get_bloginfo( 'admin_email' ),
			];
			$settings['appearance']       = [
				'mode'             => 'light',
				'layout'           => 'boxed',
				'sidebar_density'  => 'comfortable',
				'table_density'    => 'comfortable',
				'ui_scale'         => '100%',
			];
		}

		$db_version      = defined( 'CODECLOVE_DB_VERSION' ) ? CODECLOVE_DB_VERSION : '1.0.0';
		$plugin_version  = defined( 'CODECLOVE_VERSION' ) ? CODECLOVE_VERSION : '1.0.0';

		// Always stamp current versions and persist.
		$settings['schema_version'] = $db_version;
		$settings['plugin_version'] = $plugin_version;
		update_option( 'codeclove_settings', $settings, false );
	}

	/**
	 * Handler for updating overdue invoices daily cron task.
	 */
	public function update_overdue_invoices(): void {
		if ( class_exists( '\CodeClove\Modules\Finance\FinanceService' ) ) {
			$finance_service = new \CodeClove\Modules\Finance\FinanceService();
			$finance_service->update_overdue_invoices();
		}

		// Delete old logs based on retention settings.
		$settings = get_option( 'codeclove_settings', [] );
		$retention_days = (int) ( $settings['system']['log_retention_days'] ?? 0 );
		if ( $retention_days > 0 ) {
			global $wpdb;
			if ( class_exists( '\CodeClove\Database\Schema' ) ) {
				// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
				$wpdb->query(
					$wpdb->prepare(
						"DELETE FROM " . \CodeClove\Database\Schema::app_logs() . " WHERE created_at < DATE_SUB( UTC_TIMESTAMP(), INTERVAL %d DAY )",
						$retention_days
					)
				);
				// phpcs:enable
			}
		}
	}

	/**
	 * Handle login redirects for CodeClove user roles.
	 *
	 * The third param is WP_User|WP_Error (not nullable) — widen the hint to
	 * mixed so strict_types=1 doesn't throw a TypeError on failed logins.
	 */
	public function handle_login_redirect( string $redirect_to, string $request, mixed $user ): string {
		if ( ! $user instanceof \WP_User ) {
			return $redirect_to;
		}

		// Never hijack login redirects for WordPress administrators.
		if ( $user->has_cap( 'manage_options' ) ) {
			return $redirect_to;
		}

		$menu_slug = 'codeclove-school-management';

		if ( $user->has_cap( 'codeclove_staff' ) ) {
			return admin_url( 'admin.php?page=' . $menu_slug );
		}

		if (
			$user->has_cap( 'codeclove_guardian' )
			|| $user->has_cap( 'codeclove_student' )
		) {
			return home_url( '/portal' );
		}

		return $redirect_to;
	}

	/**
	 * Hide admin bar for portal-only roles.
	 */
	public function hide_admin_bar_for_portal_users( bool $show ): bool {
		if ( current_user_can( 'manage_options' ) ) {
			return $show;
		}

		if (
			current_user_can( 'codeclove_guardian' )
			|| current_user_can( 'codeclove_student' )
		) {
			return false;
		}
		return $show;
	}

	/**
	 * Blocks student and guardian portal accounts from accessing wp-admin.
	 */
	public function restrict_admin_access_for_portal_users(): void {
		if ( wp_doing_ajax() || ( defined( 'DOING_CRON' ) && DOING_CRON ) ) {
			return;
		}

		if ( current_user_can( 'manage_options' ) ) {
			return;
		}

		if (
			current_user_can( 'codeclove_guardian' )
			|| current_user_can( 'codeclove_student' )
		) {
			wp_safe_redirect( home_url( '/portal' ) );
			exit;
		}
	}

}
