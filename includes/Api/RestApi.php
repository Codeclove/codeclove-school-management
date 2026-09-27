<?php
/**
 * REST API registration.
 *
 * Registers the Nexora REST API namespace and discovers all module controllers.
 * Each module controller is responsible for registering its own routes.
 *
 * @package Nexora\Api
 */

declare( strict_types=1 );

namespace Nexora\Api;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class RestApi
 */
final class RestApi {

	/**
	 * The Nexora REST API namespace and version.
	 */
	public const NAMESPACE = 'nexora/v1';

	/**
	 * Registers all module REST routes.
	 * Called on `rest_api_init`.
	 */
	public function register_routes(): void {
		foreach ( $this->get_controllers() as $controller ) {
			$controller->register_routes();
		}
	}

	/**
	 * Returns an ordered list of all module controllers.
	 *
	 * Adding a new module = instantiate its controller here.
	 * Order is not significant for REST registration.
	 *
	 * @return BaseController[]
	 */
	private function get_controllers(): array {
		$controllers = [
			// Dashboard
			new \Nexora\Modules\Dashboard\DashboardController(),

			// Activity Logs
			new \Nexora\Modules\Activity\ActivityController(),

			// Media Uploads
			new \Nexora\Modules\Media\MediaController(),

			// Settings
			new \Nexora\Modules\Settings\SettingsController(),

			// Academics
			new \Nexora\Modules\Academics\AcademicsController(),

			// Roles
			new \Nexora\Modules\Roles\RolesController(),

			// Admissions
			new \Nexora\Modules\Admissions\AdmissionsController(),

			// Students
			new \Nexora\Modules\Students\StudentsController(),

			// Staff
			new \Nexora\Modules\Staff\StaffController(),
			new \Nexora\Modules\Staff\MeController(),

			// Attendance
			new \Nexora\Modules\Attendance\AttendanceController(),

			// Finance
			new \Nexora\Modules\Finance\FinanceController(),

			// Student & Guardian Portal Module
			new \Nexora\Modules\Portal\PortalController(),
		];

		// Optional / Pro modules — dynamically discovered if classes exist.
		$optional = [
			\Nexora\Modules\Notifications\NotificationsController::class,
			\Nexora\Modules\Promotion\PromotionController::class,
			\Nexora\Modules\Timetable\TimetableController::class,
			\Nexora\Api\DevController::class,
		];
		foreach ( $optional as $class ) {
			if ( class_exists( $class ) ) {
				$controllers[] = new $class();
			}
		}

		return $controllers;
	}
}
