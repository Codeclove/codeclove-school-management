<?php
/**
 * REST API registration.
 *
 * Registers the CodeClove REST API namespace and discovers all module controllers.
 * Each module controller is responsible for registering its own routes.
 *
 * @package CodeClove\Api
 */

declare( strict_types=1 );

namespace CodeClove\Api;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class RestApi
 */
final class RestApi {

	/**
	 * The CodeClove REST API namespace and version.
	 */
	public const NAMESPACE = 'codeclove/v1';

	/**
	 * Registers all module REST routes.
	 * Called on `rest_api_init`.
	 */
	public function register_routes(): void {
		foreach ( $this->get_controllers() as $controller ) {
			if ( is_string( $controller ) && class_exists( $controller ) ) {
				$controller = new $controller();
			}
			if ( is_object( $controller ) && method_exists( $controller, 'register_routes' ) ) {
				$controller->register_routes();
			}
		}
	}

	/**
	 * Returns an ordered list of all module controllers.
	 *
	 * Adding a new module = instantiate its controller here.
	 * Order is not significant for REST registration.
	 *
	 * @return object[]
	 */
	private function get_controllers(): array {
		$candidates = [
			// Dashboard
			'\CodeClove\Modules\Dashboard\DashboardController',

			// Media Uploads
			'\CodeClove\Modules\Media\MediaController',

			// Settings
			'\CodeClove\Modules\Settings\SettingsController',

			// Academics
			'\CodeClove\Modules\Academics\AcademicsController',

			// Roles
			'\CodeClove\Modules\Roles\RolesController',

			// Admissions
			'\CodeClove\Modules\Admissions\AdmissionsController',

			// Students
			'\CodeClove\Modules\Students\StudentsController',

			// Staff
			'\CodeClove\Modules\Staff\StaffController',
			'\CodeClove\Modules\Staff\MeController',

			// Attendance
			'\CodeClove\Modules\Attendance\AttendanceController',

			// Finance
			'\CodeClove\Modules\Finance\FinanceController',

			// Student & Guardian Portal Module
			'\CodeClove\Modules\Portal\PortalController',

			// Demo Data Management
			'\CodeClove\Api\DemoDataController',

			// Milestone Review Prompt
			'\CodeClove\Api\ReviewPromptController',
		];
		$controllers = [];

		foreach ( $candidates as $class ) {
			if ( class_exists( $class ) ) {
				$controllers[] = new $class();
			}
		}

		return apply_filters( 'codeclove_rest_controllers', $controllers );
	}
}
