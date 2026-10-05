<?php
/**
 * System report service.
 *
 * Generates sanitized environment diagnostics and formats GitHub-compatible
 * markdown summaries for support and bug reporting without exposing PII,
 * absolute paths, or sensitive credentials.
 *
 * @package CodeClove\Modules\Settings
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Settings;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class SystemReportService
 */
final class SystemReportService {

	/**
	 * Settings repository instance.
	 *
	 * @var SettingsRepository
	 */
	private SettingsRepository $settings_repo;

	/**
	 * Constructor.
	 *
	 * @param SettingsRepository|null $settings_repo Optional settings repository.
	 */
	public function __construct( ?SettingsRepository $settings_repo = null ) {
		$this->settings_repo = $settings_repo ?? new SettingsRepository();
	}

	/**
	 * Collects and returns a sanitized system diagnostic array.
	 *
	 * @return array
	 */
	public function get_sanitized_report(): array {
		global $wpdb;

		$mysql_version = 'Unknown';
		if ( isset( $wpdb ) && method_exists( $wpdb, 'db_version' ) ) {
			$mysql_version = (string) $wpdb->db_version();
		}

		$settings = $this->settings_repo->get_settings( true );
		$preset   = $settings['education_system']['preset'] ?? 'IN';

		return [
			'codeclove'   => [
				'version'    => defined( 'CODECLOVE_VERSION' ) ? CODECLOVE_VERSION : 'unknown',
				'db_version' => defined( 'CODECLOVE_DB_VERSION' ) ? CODECLOVE_DB_VERSION : 'unknown',
				'edition'    => ( defined( 'CODECLOVE_IS_PRO' ) && CODECLOVE_IS_PRO ) ? 'pro' : 'free',
				'preset'     => $preset,
			],
			'license'     => self::get_sanitized_license_info(),
			'environment' => [
				'php_version'      => PHP_VERSION,
				'mysql_version'    => $mysql_version,
				'wp_version'       => get_bloginfo( 'version' ),
				'multisite'        => is_multisite(),
				'wp_memory_limit'  => defined( 'WP_MEMORY_LIMIT' ) ? WP_MEMORY_LIMIT : 'unknown',
				'php_memory_limit' => ini_get( 'memory_limit' ) ?: 'unknown',
				'server_software'  => $this->sanitize_server_software(),
			],
		];
	}

	/**
	 * Formats a sanitized diagnostic report as GitHub-compatible markdown.
	 *
	 * @param array $report Sanitized report array.
	 * @return string Markdown output.
	 */
	public function format_markdown_report( array $report ): string {
		$codeclove   = $report['codeclove'] ?? [];
		$license     = $report['license'] ?? [];
		$environment = $report['environment'] ?? [];

		$lines   = [];
		$lines[] = '<details>';
		$lines[] = '<summary>System Diagnostics</summary>';
		$lines[] = '';
		$lines[] = '| Key | Value |';
		$lines[] = '|---|---|';
		$lines[] = '| CodeClove Version | ' . ( $codeclove['version'] ?? 'unknown' ) . ' |';
		if ( ! empty( $codeclove['db_version'] ) && $codeclove['db_version'] !== ( $codeclove['version'] ?? '' ) ) {
			$lines[] = '| DB Schema Version | ' . $codeclove['db_version'] . ' |';
		}
		if ( ! empty( $codeclove['preset'] ) ) {
			$lines[] = '| Country Preset | ' . $codeclove['preset'] . ' |';
		}
		if ( ! empty( $license['status'] ) ) {
			$license_val = ucfirst( (string) $license['status'] );
			if ( ! empty( $license['type'] ) ) {
				$license_val .= ' (' . $license['type'] . ')';
			}
			if ( ! empty( $license['expires'] ) ) {
				$license_val .= ' — Expires: ' . ( 'lifetime' === $license['expires'] ? 'Lifetime' : $license['expires'] );
			}
			if ( ! empty( $license['masked_key'] ) ) {
				$license_val .= ' [' . $license['masked_key'] . ']';
			}
			$lines[] = '| License Status | ' . $license_val . ' |';
		}
		$lines[] = '| WordPress Version | ' . ( $environment['wp_version'] ?? 'unknown' ) . ' |';
		$lines[] = '| PHP Version | ' . ( $environment['php_version'] ?? 'unknown' ) . ' |';
		$lines[] = '| MySQL Version | ' . ( $environment['mysql_version'] ?? 'unknown' ) . ' |';
		$lines[] = '| Memory Limit | ' . ( $environment['php_memory_limit'] ?? 'unknown' ) . ' (WP: ' . ( $environment['wp_memory_limit'] ?? 'unknown' ) . ') |';
		$lines[] = '</details>';

		return implode( "\n", $lines );
	}

	/**
	 * Sanitizes server software string to avoid leaking OS file paths.
	 *
	 * @return string
	 */
	private function sanitize_server_software(): string {
		$raw = isset( $_SERVER['SERVER_SOFTWARE'] ) ? sanitize_text_field( (string) $_SERVER['SERVER_SOFTWARE'] ) : 'Unknown';
		return $this->redact_paths( $raw );
	}

	/**
	 * Redacts server paths with [site-root].
	 *
	 * @param string $text Input text.
	 * @return string
	 */
	public function redact_paths( string $text ): string {
		if ( defined( 'ABSPATH' ) && ABSPATH !== '' ) {
			$text = str_replace( ABSPATH, '[site-root]/', $text );
		}
		if ( isset( $_SERVER['DOCUMENT_ROOT'] ) && ! empty( $_SERVER['DOCUMENT_ROOT'] ) ) {
			$text = str_replace( (string) $_SERVER['DOCUMENT_ROOT'], '[doc-root]', $text );
		}
		return $text;
	}

	/**
	 * Collects a sanitized summary of current license state.
	 *
	 * @return array{status: string, label: string, type: string, is_valid: bool, expires: string, masked_key: string}
	 */
	public static function get_sanitized_license_info(): array {
		$is_pro = defined( 'CODECLOVE_IS_PRO' ) && CODECLOVE_IS_PRO;

		if ( ! $is_pro ) {
			return [
				'status'     => 'free',
				'label'      => __( 'Free Edition', 'codeclove-school-management' ),
				'type'       => __( 'Free', 'codeclove-school-management' ),
				'is_valid'   => false,
				'expires'    => '',
				'masked_key' => '',
			];
		}
		$license_info = apply_filters( 'codeclove_license_status_report', null );
		if ( null !== $license_info && is_array( $license_info ) ) {
			return $license_info;
		}
		return [
			'status'     => 'free',
			'label'      => __( 'Free Edition', 'codeclove-school-management' ),
			'type'       => __( 'Free', 'codeclove-school-management' ),
			'is_valid'   => false,
			'expires'    => '',
			'masked_key' => '',
		];
	}
}
