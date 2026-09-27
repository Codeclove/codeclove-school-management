<?php
/**
 * Core plugin orchestrator.
 *
 * Single responsibility: wire everything together at the right time.
 * All heavy logic lives in dedicated service/module classes.
 *
 * @package Nexora\Core
 */

declare( strict_types=1 );

namespace Nexora\Core;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Nexora\Api\RestApi;
use Nexora\Database\Migrations;
use Nexora\Database\Seeders\RolesSeeder;
use Nexora\Licensing\License;
use Nexora\Licensing\LicensePage;

/**
 * Class Plugin
 *
 * Bootstraps Nexora by registering WordPress hooks and initialising modules.
 * Use the singleton pattern so that hooks are only registered once.
 */
final class Plugin {

	// ─── Singleton ───────────────────────────────────────────────────────────

	private static ?self $instance = null;

	private function __construct() {
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
		// Load nexora_settings once and pass it down — avoids a double get_option
		// (seed_defaults and maybe_run_migrations both read the same option).
		$settings = (array) get_option( 'nexora_settings', [] );
		$this->seed_defaults( $settings );
		RolesSeeder::run();

		// Register custom WordPress roles for Nexora user classes.
		add_role( 'nexora_staff', __( 'Nexora Staff', 'nexora-school-management' ), [ 'read' => true ] );
		add_role( 'nexora_guardian', __( 'Nexora Guardian', 'nexora-school-management' ), [] );
		add_role( 'nexora_student', __( 'Nexora Student', 'nexora-school-management' ), [] );

		// Schedule daily cron event to update overdue invoices.
		if ( ! wp_next_scheduled( 'nexora_update_overdue_invoices' ) ) {
			wp_schedule_event( time(), 'daily', 'nexora_update_overdue_invoices' );
		}

		// Schedule license heartbeat.
		if ( class_exists( '\Nexora\Licensing\License' ) ) {
			License::schedule_heartbeat();
		}
		flush_rewrite_rules();
	}

	/**
	 * Called on plugin deactivation.
	 * Does NOT drop tables — use uninstall.php for cleanup.
	 */
	public function deactivate(): void {
		wp_clear_scheduled_hook( 'nexora_update_overdue_invoices' );
		if ( class_exists( '\Nexora\Licensing\License' ) ) {
			License::clear_heartbeat();
		}
		// Remove custom WordPress roles.
		remove_role( 'nexora_staff' );
		remove_role( 'nexora_guardian' );
		remove_role( 'nexora_student' );

		flush_rewrite_rules();
	}

	// ─── Bootstrap ───────────────────────────────────────────────────────────

	public function run(): void {
		$rest = new RestApi();

		// License page + updater registration.
		if ( class_exists( '\Nexora\Licensing\LicensePage' ) ) {
			( new LicensePage() )->init();
		}
		// Register custom admin menu (single top-level page).
		add_action( 'admin_menu', [ $this, 'register_admin_menu' ] );

		// Register the REST API namespace and all routes.
		add_action( 'rest_api_init', [ $rest, 'register_routes' ] );

		// Run migrations when the plugin's DB version is outdated.
		add_action( 'plugins_loaded', [ $this, 'maybe_run_migrations' ] );

		// Daily cron + license heartbeat listeners.
		add_action( 'nexora_update_overdue_invoices', [ $this, 'update_overdue_invoices' ] );
		if ( defined( 'NEXORA_IS_PRO' ) && NEXORA_IS_PRO ) {
			add_action( 'admin_notices', [ $this, 'maybe_show_pro_welcome_notice' ] );
			if ( class_exists( '\Nexora\Licensing\License' ) ) {
				add_action( License::HEARTBEAT_HOOK, [ License::class, 'run_heartbeat' ] );
				add_action( 'admin_notices', [ $this, 'maybe_show_license_notice' ] );
			}
		}
		if ( class_exists( '\Nexora\Modules\Notifications\NotificationsService' ) ) {
			( new \Nexora\Modules\Notifications\NotificationsService() )->init();
		}
		// Register Admissions Public Shortcodes.
		\Nexora\Modules\Admissions\Shortcodes::register();

		// Register Student & Guardian Portal Public Shortcode.
		\Nexora\Modules\Portal\PortalShortcode::register();
		// Redirect on login based on user roles.
		add_filter( 'login_redirect', [ $this, 'handle_login_redirect' ], 10, 3 );

		// Hide WP admin bar for portal-only roles.
		add_filter( 'show_admin_bar', [ $this, 'hide_admin_bar_for_portal_users' ] );

		// Restrict student and guardian portal accounts from accessing wp-admin.
		add_action( 'admin_init', [ $this, 'restrict_admin_access_for_portal_users' ] );

	}

	// ─── Admin Menu ──────────────────────────────────────────────────────────

	/**
	 * Registers the Nexora top-level admin menu entry and hooks the fullscreen renderer.
	 */
	public function register_admin_menu(): void {
		$is_pro    = defined( 'NEXORA_IS_PRO' ) && NEXORA_IS_PRO;
		$menu_slug = $is_pro ? 'nexora' : 'nexora-school-management';
		$page_hook = add_menu_page(
			__( 'Nexora', 'nexora-school-management' ),
			__( 'Nexora', 'nexora-school-management' ),
			'read',                          // Nexora RBAC controls real access.
			$menu_slug,
			static fn() => null,             // Unreachable: load-{page} hook exits first.
			'dashicons-welcome-learn-more',  // Replaced by React icon in the app.
			3
		);

		// In Free version only: register submenu items highlighting the Pro upgrade.
		if ( ! $is_pro ) {
			add_submenu_page(
				$menu_slug,
				__( 'Nexora Dashboard', 'nexora-school-management' ),
				__( 'Dashboard', 'nexora-school-management' ),
				'read',
				$menu_slug,
				static fn() => null
			);

			add_submenu_page(
				$menu_slug,
				__( 'Upgrade to Pro', 'nexora-school-management' ),
				'<span style="color:#f59e0b;font-weight:600;">' . esc_html__( 'Upgrade to Pro ↗', 'nexora-school-management' ) . '</span>',
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
	 * Shows a dismissible admin notice when no valid license is active.
	 * Only shown to users who can manage options (WP admins).
	 */
	/**
	 * Shows a reassuring welcome notice when Pro is active alongside Free.
	 */
	public function maybe_show_pro_welcome_notice(): void {
		if ( ! current_user_can( 'activate_plugins' ) || ! in_array( 'nexora-school-management/nexora-school-management.php', (array) get_option( 'active_plugins', [] ), true ) ) {
			return;
		}

		printf(
			'<div class="notice notice-success is-dismissible"><p><strong>%s:</strong> %s</p></div>',
			esc_html__( 'Nexora Pro Activated', 'nexora-school-management' ),
			esc_html__( 'All your existing school data, students, and settings are active in Pro. You may safely deactivate and remove the Free version at your convenience.', 'nexora-school-management' )
		);
	}

	public function maybe_show_license_notice(): void {
		if ( ! defined( 'NEXORA_IS_PRO' ) || ! NEXORA_IS_PRO ) {
			return;
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		// Don't clutter the activation form with a redundant notice.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( 'nexora-license' === sanitize_key( wp_unslash( $_GET['page'] ?? '' ) ) ) {
			return;
		}
		if ( ! class_exists( '\Nexora\Licensing\License' ) || License::verified() ) {
			return;
		}
		$url = admin_url( 'admin.php?page=nexora-license' );
		printf(
			'<div class="notice notice-warning is-dismissible"><p><strong>%s:</strong> %s <a href="%s">%s</a></p></div>',
			esc_html__( 'Nexora Pro', 'nexora-school-management' ),
			esc_html__( 'No active license found. Nexora is fully disabled until a license is activated.', 'nexora-school-management' ),
			esc_url( $url ),
			esc_html__( 'Activate your license', 'nexora-school-management' )
		);
	}

	// ─── Migrations ──────────────────────────────────────────────────────────

	/**
	 * Runs DB migrations when the stored schema version is outdated.
	 */
	public function maybe_run_migrations(): void {
		$settings       = get_option( 'nexora_settings', [] );
		$stored_version = $settings['schema_version'] ?? '0.0.0';

		if (
			version_compare( $stored_version, NEXORA_DB_VERSION, '<' )
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
			$settings = get_option( 'nexora_settings', [] );
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

		// Always stamp current versions and persist.
		// This runs on both fresh installs and upgrades.
		$settings['schema_version'] = NEXORA_DB_VERSION;
		$settings['plugin_version'] = NEXORA_VERSION;
		update_option( 'nexora_settings', $settings, false );

		// Seed default roles — delegated to a future Roles module.
		// Roles\RolesService::seed_defaults();
	}
	/**
	 * Handler for updating overdue invoices daily cron task.
	 */
	public function update_overdue_invoices(): void {
		$finance_service = new \Nexora\Modules\Finance\FinanceService();
		$finance_service->update_overdue_invoices();

		// ponytail: delete old logs based on retention settings.
		$settings = get_option( 'nexora_settings', [] );
		$retention_days = (int) ( $settings['system']['log_retention_days'] ?? 0 );
		if ( $retention_days > 0 ) {
			global $wpdb;
			// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$wpdb->query(
				$wpdb->prepare(
					"DELETE FROM " . \Nexora\Database\Schema::app_logs() . " WHERE created_at < DATE_SUB( UTC_TIMESTAMP(), INTERVAL %d DAY )",
					$retention_days
				)
			);
			// phpcs:enable
		}
	}

	/**
	 * Handle login redirects for Nexora user roles.
	 *
	 * The third param is WP_User|WP_Error (not nullable) — widen the hint to
	 * mixed so strict_types=1 doesn't throw a TypeError on failed logins.
	 *
	 * ponytail: redirect based on capability shell.
	 */
	public function handle_login_redirect( string $redirect_to, string $request, mixed $user ): string {
		if ( ! $user instanceof \WP_User ) {
			return $redirect_to;
		}

		// Never hijack login redirects for WordPress administrators.
		if ( $user->has_cap( 'manage_options' ) ) {
			return $redirect_to;
		}

		$is_pro    = defined( 'NEXORA_IS_PRO' ) && NEXORA_IS_PRO;
		$menu_slug = $is_pro ? 'nexora' : 'nexora-school-management';

		if ( $user->has_cap( 'nexora_staff' ) ) {
			return admin_url( 'admin.php?page=' . $menu_slug );
		}

		if ( $user->has_cap( 'nexora_guardian' ) || $user->has_cap( 'nexora_student' ) ) {
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

		if ( current_user_can( 'nexora_guardian' ) || current_user_can( 'nexora_student' ) ) {
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

		if ( current_user_can( 'nexora_guardian' ) || current_user_can( 'nexora_student' ) ) {
			wp_safe_redirect( home_url( '/portal' ) );
			exit;
		}
	}

}
