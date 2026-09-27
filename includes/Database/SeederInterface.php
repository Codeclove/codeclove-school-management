<?php
/**
 * Seeder interface definition.
 *
 * All developer seeders must implement this interface to support orchestration
 * by DevSeeder.
 *
 * @package Nexora\Database
 */

declare( strict_types=1 );

namespace Nexora\Database;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Interface SeederInterface
 */
interface SeederInterface {

	/**
	 * Seeds data for the module based on a country preset.
	 *
	 * @param string $country Country code preset ('IN', 'US', 'GB').
	 */
	public function seed( string $country ): void;

	/**
	 * Clears/truncates the table(s) associated with this module.
	 */
	public function truncate(): void;
}
