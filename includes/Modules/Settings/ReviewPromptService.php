<?php
/**
 * Milestone-based review prompt service.
 *
 * Tracks plugin installation age and student milestones to prompt
 * administrators for a WordPress.org plugin review.
 *
 * @package CodeClove\Modules\Settings
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Settings;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Database\Schema;

/**
 * Class ReviewPromptService
 */
final class ReviewPromptService {

	public const REVIEW_URL  = 'https://wordpress.org/support/plugin/codeclove-school-management/reviews/#new-post';
	public const SUPPORT_URL = 'https://wordpress.org/support/plugin/codeclove-school-management/';

	/**
	 * Ensures the codeclove_installed_at option exists with the current timestamp if absent.
	 *
	 * @return int Unix timestamp when the plugin was installed.
	 */
	public static function ensure_installed_at(): int {
		$installed_at = get_option( 'codeclove_installed_at' );

		if ( false === $installed_at || ! is_numeric( $installed_at ) || (int) $installed_at <= 0 ) {
			$now = time();
			update_option( 'codeclove_installed_at', $now, false );
			return $now;
		}

		return (int) $installed_at;
	}

	/**
	 * Returns the current review prompt status.
	 *
	 * @return array{should_show: bool, trigger_reason: string, students_count: int, days_passed: int, review_url: string, support_url: string, shouldShow: bool, triggerReason: string, studentsCount: int, daysPassed: int, reviewUrl: string, supportUrl: string}
	 */
	public static function get_status(): array {
		$review_url   = self::REVIEW_URL;
		$support_url  = self::SUPPORT_URL;
		$installed_at = self::ensure_installed_at();
		$day_seconds  = defined( 'DAY_IN_SECONDS' ) ? DAY_IN_SECONDS : 86400;
		$days_passed  = max( 0, (int) floor( ( time() - $installed_at ) / $day_seconds ) );

		global $wpdb;
		$students_count = 0;
		if ( class_exists( Schema::class ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Review milestone active students count.
			$count = $wpdb->get_var( 'SELECT COUNT(*) FROM ' . Schema::students() . ' WHERE deleted_at IS NULL' );
			$students_count = null !== $count ? (int) $count : 0;
		}

		// Dismissed permanently.
		$dismissed = (string) get_option( 'codeclove_review_dismissed', '' );
		if ( in_array( $dismissed, [ 'reviewed', 'never' ], true ) ) {
			return self::build_response( false, '', $students_count, $days_passed, $review_url, $support_url );
		}

		// Snoozed temporarily.
		$snoozed_until = (int) get_option( 'codeclove_review_snoozed_until', 0 );
		if ( $snoozed_until > time() ) {
			return self::build_response( false, '', $students_count, $days_passed, $review_url, $support_url );
		}

		// Milestone check: 5+ students or 7+ days passed.
		$should_show = ( $days_passed >= 7 || $students_count >= 5 );
		$trigger_reason = '';

		if ( $should_show ) {
			$trigger_reason = $students_count >= 5 ? 'students_count' : 'days_passed';
		}

		return self::build_response( $should_show, $trigger_reason, $students_count, $days_passed, $review_url, $support_url );
	}

	/**
	 * Dismisses or snoozes the review prompt.
	 *
	 * @param string $action 'reviewed', 'never', or 'maybe_later'.
	 * @return bool True if the action was valid and saved, false otherwise.
	 */
	public static function dismiss( string $action ): bool {
		$day_seconds = defined( 'DAY_IN_SECONDS' ) ? DAY_IN_SECONDS : 86400;

		if ( in_array( $action, [ 'reviewed', 'never' ], true ) ) {
			update_option( 'codeclove_review_dismissed', $action, false );
			delete_option( 'codeclove_review_snoozed_until' );
			return true;
		}

		if ( 'maybe_later' === $action ) {
			update_option( 'codeclove_review_snoozed_until', time() + ( 14 * $day_seconds ), false );
			return true;
		}

		return false;
	}

	/**
	 * Formats status response with both snake_case and camelCase aliases for seamless interop.
	 *
	 * @param bool   $should_show    Whether the prompt should be displayed.
	 * @param string $trigger_reason 'students_count', 'days_passed', or ''.
	 * @param int    $students_count Active students count.
	 * @param int    $days_passed    Number of days since install.
	 * @param string $review_url     WordPress.org review link.
	 * @param string $support_url    WordPress.org support forum link.
	 * @return array<string, mixed>
	 */
	private static function build_response(
		bool $should_show,
		string $trigger_reason,
		int $students_count,
		int $days_passed,
		string $review_url,
		string $support_url = self::SUPPORT_URL
	): array {
		return [
			'should_show'    => $should_show,
			'trigger_reason' => $trigger_reason,
			'students_count' => $students_count,
			'days_passed'    => $days_passed,
			'review_url'     => $review_url,
			'support_url'    => $support_url,
			// JavaScript camelCase aliases:
			'shouldShow'     => $should_show,
			'triggerReason'  => $trigger_reason,
			'studentsCount'  => $students_count,
			'daysPassed'     => $days_passed,
			'reviewUrl'      => $review_url,
			'supportUrl'     => $support_url,
		];
	}
}
