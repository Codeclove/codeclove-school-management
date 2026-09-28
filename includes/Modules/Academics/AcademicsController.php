<?php
/**
 * Academics REST API controller.
 *
 * Exposes REST routes to query, create, update, and delete:
 *   - Academic Sessions
 *   - Academic Units
 *   - Academic Groups
 *   - Subjects
 *
 * @package CodeClove\Modules\Academics
 */

declare( strict_types=1 );

namespace CodeClove\Modules\Academics;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use CodeClove\Api\BaseController;
use CodeClove\Shared\AuditLogger;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class AcademicsController
 */
final class AcademicsController extends BaseController {

	private Sessions\SessionsService $sessions_service;
	private Units\UnitsService $units_service;
	private Groups\GroupsService $groups_service;
	private Subjects\SubjectsService $subjects_service;

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->sessions_service = new Sessions\SessionsService();
		$this->units_service    = new Units\UnitsService();
		$this->groups_service   = new Groups\GroupsService();
		$this->subjects_service = new Subjects\SubjectsService();
	}

	/**
	 * Registers REST routes.
	 */
	public function register_routes(): void {
		// ─── Academic Sessions Endpoints ─────────────────────────────────────
		register_rest_route(
			$this->namespace,
			'/academic-sessions',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_sessions' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_sessions.view', $request ); },
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'create_session' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_sessions.add', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/academic-sessions/(?P<id>\d+)',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_session' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_sessions.view', $request ); },
				],
				[
					'methods'             => 'PATCH',
					'callback'            => [ $this, 'update_session' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_sessions.edit', $request ); },
				],
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'delete_session' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_sessions.delete', $request ) || $this->can( 'academic_sessions.manage', $request ); },
				],
			]
		);

		// ─── Academic Units Endpoints ────────────────────────────────────────
		register_rest_route(
			$this->namespace,
			'/academic-units',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_units' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_units.view', $request ); },
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'create_unit' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_units.add', $request ); },
				],
			]
		);



		register_rest_route(
			$this->namespace,
			'/academic-units/(?P<id>\d+)',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_unit' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_units.view', $request ); },
				],
				[
					'methods'             => 'PATCH',
					'callback'            => [ $this, 'update_unit' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_units.edit', $request ); },
				],
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'delete_unit' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_units.delete', $request ); },
				],
			]
		);

		// ─── Academic Groups Endpoints ───────────────────────────────────────
		register_rest_route(
			$this->namespace,
			'/academic-groups',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_groups' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_groups.view', $request ); },
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'create_group' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_groups.add', $request ); },
				],
			]
		);



		register_rest_route(
			$this->namespace,
			'/academic-groups/(?P<id>\d+)',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_group' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_groups.view', $request ); },
				],
				[
					'methods'             => 'PATCH',
					'callback'            => [ $this, 'update_group' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_groups.edit', $request ); },
				],
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'delete_group' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_groups.delete', $request ); },
				],
			]
		);

		// ─── Subjects Endpoints ──────────────────────────────────────────────
		register_rest_route(
			$this->namespace,
			'/subjects',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_subjects' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'subjects.view', $request ); },
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'create_subject' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'subjects.add', $request ); },
				],
			]
		);



		register_rest_route(
			$this->namespace,
			'/subjects/(?P<id>\d+)',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_subject' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'subjects.view', $request ); },
				],
				[
					'methods'             => 'PATCH',
					'callback'            => [ $this, 'update_subject' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'subjects.edit', $request ); },
				],
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'delete_subject' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'subjects.delete', $request ); },
				],
			]
		);

		// ─── Academic Terms Endpoints ────────────────────────────────────────
		register_rest_route(
			$this->namespace,
			'/academic-sessions/(?P<session_id>\d+)/terms',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_terms' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_terms.view', $request ); },
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'create_term' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_terms.add', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/academic-terms/(?P<id>\d+)',
			[
				[
					'methods'             => 'PATCH',
					'callback'            => [ $this, 'update_term' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_terms.edit', $request ); },
				],
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'delete_term' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_terms.delete', $request ); },
				],
			]
		);

		// ─── Academic Unit Subjects Endpoints ─────────────────────────────────
		register_rest_route(
			$this->namespace,
			'/academic-units/(?P<unit_id>\d+)/subjects',
			[
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'get_unit_subjects' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_units.view', $request ); },
				],
				[
					'methods'             => 'POST',
					'callback'            => [ $this, 'assign_subject_to_unit' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_units.edit', $request ); },
				],
			]
		);

		register_rest_route(
			$this->namespace,
			'/academic-units/(?P<unit_id>\d+)/subjects/(?P<subject_id>\d+)',
			[
				[
					'methods'             => 'DELETE',
					'callback'            => [ $this, 'unassign_subject_from_unit' ],
					'permission_callback' => function ( WP_REST_Request $request ): bool { return $this->can( 'academic_units.edit', $request ); },
				],
			]
		);
	}

	// ─── Sessions Callback Handlers ──────────────────────────────────────────

	/**
	 * Gets a list of academic sessions.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_sessions( WP_REST_Request $request ): WP_REST_Response {
		$pagination = $this->get_pagination( $request );
		$args       = [
			'limit'  => $pagination['per_page'],
			'offset' => $pagination['offset'],
			'search' => $request->get_param( 'search' ) ? sanitize_text_field( $request->get_param( 'search' ) ) : '',
			'status' => $request->get_param( 'status' ) ? sanitize_text_field( $request->get_param( 'status' ) ) : '',
		];

		$result = $this->sessions_service->get_sessions( $args );

		return $this->paginated(
			$result['sessions'],
			$result['total'],
			$pagination['page'],
			$pagination['per_page']
		);
	}

	/**
	 * Gets a single academic session.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_session( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id      = (int) $request->get_param( 'id' );
		$session = $this->sessions_service->get_session( $id );

		if ( null === $session ) {
			return $this->error( 'not_found', __( 'Academic session not found.', 'codeclove-school-management' ), 404 );
		}

		return $this->success( $session );
	}

	/**
	 * Creates a new academic session.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function create_session( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->sessions_service->create_session( $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'academic_session.created',
			[
				'session_id' => $result['id'],
				'name'       => $result['name'],
			]
		);

		return $this->success( $result, 201 );
	}

	/**
	 * Updates an academic session.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_session( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->sessions_service->update_session( $id, $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'academic_session.updated',
			[
				'session_id' => $id,
				'name'       => $result['name'],
			]
		);

		return $this->success( $result );
	}

	/**
	 * Deletes an academic session.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function delete_session( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$result = $this->sessions_service->delete_session( $id );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'academic_session.deleted',
			[ 'session_id' => $id ]
		);

		return $this->success( [ 'deleted' => true ] );
	}

	// ─── Units Callback Handlers ─────────────────────────────────────────────

	/**
	 * Gets academic units.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_units( WP_REST_Request $request ): WP_REST_Response {
		$pagination = $this->get_pagination( $request );
		$args       = [
			'limit'      => $pagination['per_page'],
			'offset'     => $pagination['offset'],
			'search'     => $request->get_param( 'search' ) ? sanitize_text_field( $request->get_param( 'search' ) ) : '',
			'status'     => $request->get_param( 'status' ) ? sanitize_text_field( $request->get_param( 'status' ) ) : '',
			'session_id' => $request->get_param( 'session_id' ) ? (int) $request->get_param( 'session_id' ) : ( $request->get_param( 'academic_session_id' ) ? (int) $request->get_param( 'academic_session_id' ) : 0 ),
			'orderby'    => $request->get_param( 'orderby' ) ? sanitize_text_field( $request->get_param( 'orderby' ) ) : '',
			'order'      => $request->get_param( 'order' ) ? sanitize_text_field( $request->get_param( 'order' ) ) : '',
		];

		$result = $this->units_service->get_units( $args );

		return $this->paginated(
			$result['units'],
			$result['total'],
			$pagination['page'],
			$pagination['per_page']
		);
	}

	/**
	 * Gets a single academic unit.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_unit( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id   = (int) $request->get_param( 'id' );
		$unit = $this->units_service->get_unit( $id );

		if ( null === $unit ) {
			return $this->error( 'not_found', __( 'Academic unit not found.', 'codeclove-school-management' ), 404 );
		}

		return $this->success( $unit );
	}

	/**
	 * Creates an academic unit.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function create_unit( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->units_service->create_unit( $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'academic_unit.created',
			[
				'unit_id'    => $result['id'],
				'session_id' => $result['session_id'],
				'name'       => $result['name'],
			]
		);

		return $this->success( $result, 201 );
	}

	/**
	 * Updates an academic unit.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_unit( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->units_service->update_unit( $id, $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'academic_unit.updated',
			[
				'unit_id' => $id,
				'name'    => $result['name'],
			]
		);

		return $this->success( $result );
	}

	/**
	 * Deletes an academic unit.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function delete_unit( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$result = $this->units_service->delete_unit( $id );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'academic_unit.deleted',
			[ 'unit_id' => $id ]
		);

		return $this->success( [ 'deleted' => true ] );
	}

	// ─── Groups Callback Handlers ────────────────────────────────────────────

	/**
	 * Gets academic groups.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_groups( WP_REST_Request $request ): WP_REST_Response {
		$pagination = $this->get_pagination( $request );
		$args       = [
			'limit'      => $pagination['per_page'],
			'offset'     => $pagination['offset'],
			'search'     => $request->get_param( 'search' ) ? sanitize_text_field( $request->get_param( 'search' ) ) : '',
			'status'     => $request->get_param( 'status' ) ? sanitize_text_field( $request->get_param( 'status' ) ) : '',
			'session_id' => $request->get_param( 'session_id' ) ? (int) $request->get_param( 'session_id' ) : ( $request->get_param( 'academic_session_id' ) ? (int) $request->get_param( 'academic_session_id' ) : 0 ),
			'unit_id'    => $request->get_param( 'unit_id' ) ? (int) $request->get_param( 'unit_id' ) : ( $request->get_param( 'academic_unit_id' ) ? (int) $request->get_param( 'academic_unit_id' ) : 0 ),
			'orderby'    => $request->get_param( 'orderby' ) ? sanitize_text_field( $request->get_param( 'orderby' ) ) : '',
			'order'      => $request->get_param( 'order' ) ? sanitize_text_field( $request->get_param( 'order' ) ) : '',
		];

		$result = $this->groups_service->get_groups( $args );

		return $this->paginated(
			$result['groups'],
			$result['total'],
			$pagination['page'],
			$pagination['per_page']
		);
	}

	/**
	 * Gets a single academic group.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_group( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id    = (int) $request->get_param( 'id' );
		$group = $this->groups_service->get_group( $id );

		if ( null === $group ) {
			return $this->error( 'not_found', __( 'Academic group not found.', 'codeclove-school-management' ), 404 );
		}

		return $this->success( $group );
	}

	/**
	 * Creates an academic group.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function create_group( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->groups_service->create_group( $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'academic_group.created',
			[
				'group_id'   => $result['id'],
				'unit_id'    => $result['unit_id'],
				'session_id' => $result['session_id'],
				'name'       => $result['name'],
			]
		);

		return $this->success( $result, 201 );
	}

	/**
	 * Updates an academic group.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_group( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->groups_service->update_group( $id, $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'academic_group.updated',
			[
				'group_id' => $id,
				'name'     => $result['name'],
			]
		);

		return $this->success( $result );
	}

	/**
	 * Deletes an academic group.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function delete_group( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$result = $this->groups_service->delete_group( $id );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'academic_group.deleted',
			[ 'group_id' => $id ]
		);

		return $this->success( [ 'deleted' => true ] );
	}

	// ─── Subjects Callback Handlers ──────────────────────────────────────────

	/**
	 * Gets subjects.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_subjects( WP_REST_Request $request ): WP_REST_Response {
		$pagination = $this->get_pagination( $request );
		$args       = [
			'limit'      => $pagination['per_page'],
			'offset'     => $pagination['offset'],
			'search'     => $request->get_param( 'search' ) ? sanitize_text_field( $request->get_param( 'search' ) ) : '',
			'status'     => $request->get_param( 'status' ) ? sanitize_text_field( $request->get_param( 'status' ) ) : '',
			'session_id' => $request->get_param( 'session_id' ) ? (int) $request->get_param( 'session_id' ) : ( $request->get_param( 'academic_session_id' ) ? (int) $request->get_param( 'academic_session_id' ) : 0 ),
			'orderby'    => $request->get_param( 'orderby' ) ? sanitize_text_field( $request->get_param( 'orderby' ) ) : '',
			'order'      => $request->get_param( 'order' ) ? sanitize_text_field( $request->get_param( 'order' ) ) : '',
		];

		$result = $this->subjects_service->get_subjects( $args );

		return $this->paginated(
			$result['subjects'],
			$result['total'],
			$pagination['page'],
			$pagination['per_page']
		);
	}

	/**
	 * Gets a single subject.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_subject( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id      = (int) $request->get_param( 'id' );
		$subject = $this->subjects_service->get_subject( $id );

		if ( null === $subject ) {
			return $this->error( 'not_found', __( 'Subject not found.', 'codeclove-school-management' ), 404 );
		}

		return $this->success( $subject );
	}

	/**
	 * Creates a subject.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function create_subject( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->subjects_service->create_subject( $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'subject.created',
			[
				'subject_id' => $result['id'],
				'name'       => $result['name'],
			]
		);

		return $this->success( $result, 201 );
	}

	/**
	 * Updates a subject.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_subject( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->subjects_service->update_subject( $id, $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'subject.updated',
			[
				'subject_id' => $id,
				'name'       => $result['name'],
			]
		);

		return $this->success( $result );
	}

	/**
	 * Deletes a subject.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function delete_subject( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$result = $this->subjects_service->delete_subject( $id );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'subject.deleted',
			[ 'subject_id' => $id ]
		);

		return $this->success( [ 'deleted' => true ] );
	}

	// ─── Terms Callback Handlers ─────────────────────────────────────────────

	/**
	 * Gets academic terms for a session.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_terms( WP_REST_Request $request ): WP_REST_Response {
		$session_id = (int) $request->get_param( 'session_id' );
		$terms      = $this->sessions_service->get_terms( $session_id );
		return $this->success( $terms );
	}

	/**
	 * Creates a term for a session.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function create_term( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$session_id = (int) $request->get_param( 'session_id' );
		$params     = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}
		$params['session_id'] = $session_id;

		$result = $this->sessions_service->create_term( $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'academic_term.created',
			[
				'term_id'    => $result['id'],
				'session_id' => $result['session_id'],
				'name'       => $result['name'],
			]
		);

		return $this->success( $result, 201 );
	}

	/**
	 * Updates a term.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_term( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$params = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->sessions_service->update_term( $id, $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'academic_term.updated',
			[
				'term_id' => $id,
				'name'    => $result['name'],
			]
		);

		return $this->success( $result );
	}

	/**
	 * Deletes a term.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function delete_term( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id     = (int) $request->get_param( 'id' );
		$result = $this->sessions_service->delete_term( $id );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'academic_term.deleted',
			[ 'term_id' => $id ]
		);

		return $this->success( [ 'deleted' => true ] );
	}

	// ─── Unit Subjects Callback Handlers ─────────────────────────────────────

	/**
	 * Gets subjects mapped to a unit.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_unit_subjects( WP_REST_Request $request ): WP_REST_Response {
		$unit_id  = (int) $request->get_param( 'unit_id' );
		$subjects = $this->units_service->get_unit_subjects( $unit_id );
		return $this->success( $subjects );
	}

	/**
	 * Assigns a subject to a unit.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function assign_subject_to_unit( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$unit_id = (int) $request->get_param( 'unit_id' );
		$params  = $this->json_body( $request );
		if ( is_wp_error( $params ) ) {
			return $params;
		}

		$result = $this->units_service->assign_subject_to_unit( $unit_id, $params );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'academic_unit_subject.assigned',
			[
				'unit_id'    => $unit_id,
				'subject_id' => $result['subject_id'],
			]
		);

		return $this->success( $result, 201 );
	}

	/**
	 * Unassigns a subject from a unit.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function unassign_subject_from_unit( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$unit_id    = (int) $request->get_param( 'unit_id' );
		$subject_id = (int) $request->get_param( 'subject_id' );

		$result = $this->units_service->unassign_subject_from_unit( $unit_id, $subject_id );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		AuditLogger::log(
			'academic_unit_subject.unassigned',
			[
				'unit_id'    => $unit_id,
				'subject_id' => $subject_id,
			]
		);

		return $this->success( [ 'unassigned' => true ] );
	}
}
