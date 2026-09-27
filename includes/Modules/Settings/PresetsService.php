<?php
/**
 * Presets service.
 *
 * Handles loading education system configuration presets from JSON files
 * and merging them into the active settings.
 *
 * @package Nexora\Modules\Settings
 */

declare( strict_types=1 );

namespace Nexora\Modules\Settings;

// Prevent direct file access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class PresetsService
 */
final class PresetsService {

	/**
	 * Returns the list of supported presets.
	 *
	 * @return array
	 */
	public function get_presets(): array {
		return [
			[
				'code' => 'IN',
				'name' => 'India',
			],
			[
				'code' => 'US',
				'name' => 'United States',
			],
			[
				'code' => 'GB',
				'name' => 'United Kingdom',
			],
		];
	}

	/**
	 * Loads and returns raw preset data for a given preset code.
	 *
	 * @param string $code Preset code (IN, US, GB).
	 * @return array|null Preset data or null if not found.
	 */
	public function get_preset_data( string $code ): ?array {
		$code = strtoupper( sanitize_key( $code ) );
		$file = NEXORA_DIR . "includes/Presets/{$code}.json";

		if ( ! file_exists( $file ) ) {
			return null;
		}

		$content = file_get_contents( $file );
		if ( ! $content ) {
			return null;
		}

		$data = json_decode( $content, true );
		if ( ! is_array( $data ) ) {
			return null;
		}

		return $data;
	}

	/**
	 * Applies a preset to the active settings database.
	 *
	 * @param string             $code Preset code to apply.
	 * @param string             $mode Mode: 'replace_defaults', 'missing_only', or 'preview'.
	 * @param SettingsRepository $repository Active settings repository.
	 * @return array{success: bool, data: array} Result envelope.
	 */
	public function apply_preset( string $code, string $mode, SettingsRepository $repository ): array {
		$preset_data = $this->get_preset_data( $code );

		if ( ! $preset_data ) {
			return [
				'success' => false,
				'data'    => [ 'message' => 'Preset not found.' ],
			];
		}

		$current_settings = $repository->get_settings();

		// For 'preview', just return what would change.
		if ( 'preview' === $mode ) {
			return [
				'success' => true,
				'data'    => [
					'current' => [
						'education_system' => $current_settings['education_system'],
						'labels'           => $current_settings['labels'],
						'localization'     => $current_settings['localization'],
						'identifiers'      => $current_settings['identifiers'] ?? [],
					],
					'preset'  => [
						'education_system' => array_merge(
							$current_settings['education_system'],
							$preset_data['education_system'],
							[
								'preset'         => $preset_data['code'],
								'preset_name'    => $preset_data['name'],
								'preset_version' => $preset_data['version'],
								'customized'     => false,
							]
						),
						'labels'           => array_merge( $current_settings['labels'], $preset_data['labels'] ),
						'localization'     => array_merge( $current_settings['localization'], $preset_data['localization'] ),
						'identifiers'      => array_merge( $current_settings['identifiers'] ?? [], $preset_data['identifiers'] ?? [] ),
					],
				],
			];
		}

		// Apply preset values.
		if ( 'replace_defaults' === $mode ) {
			// Replace mode: overwrite education_system, labels, and localization values from the preset.
			$current_settings['education_system']['preset']                    = $preset_data['code'];
			$current_settings['education_system']['preset_name']               = $preset_data['name'];
			$current_settings['education_system']['preset_version']            = $preset_data['version'];
			$current_settings['education_system']['customized']                = false;
			$current_settings['education_system']['academic_year_start_month'] = $preset_data['education_system']['academic_year_start_month'] ?? 1;
			$current_settings['education_system']['academic_year_end_month']   = $preset_data['education_system']['academic_year_end_month'] ?? 12;
			$current_settings['education_system']['default_number_terms']      = $preset_data['education_system']['default_number_terms'] ?? 3;
			$current_settings['education_system']['grading_default']           = $preset_data['education_system']['grading_default'] ?? 'marks_percentage';

			// Merge labels: preset labels replace current labels.
			foreach ( $preset_data['labels'] as $label_key => $values ) {
				$current_settings['labels'][ $label_key ] = $values;
			}

			// Merge localization: preset localization replaces current localization.
			foreach ( $preset_data['localization'] as $loc_key => $val ) {
				$current_settings['localization'][ $loc_key ] = $val;
			}

			// Merge identifiers: preset identifiers replace current identifiers.
			if ( isset( $preset_data['identifiers'] ) && is_array( $preset_data['identifiers'] ) ) {
				foreach ( $preset_data['identifiers'] as $id_key => $values ) {
					$current_settings['identifiers'][ $id_key ] = $values;
				}
			}

			$current_settings['education_system']['default_academic_units']  = $preset_data['education_system']['default_academic_units'] ?? [];
			$current_settings['education_system']['default_groups_per_unit'] = $preset_data['education_system']['default_groups_per_unit'] ?? [];
		} elseif ( 'missing_only' === $mode ) {
			// Missing mode: only apply preset fields if currently null or default.
			$defaults = $repository->get_defaults();

			$current_settings['education_system']['preset']         = $preset_data['code'];
			$current_settings['education_system']['preset_name']    = $preset_data['name'];
			$current_settings['education_system']['preset_version'] = $preset_data['version'];

			foreach ( $preset_data['education_system'] as $key => $value ) {
				if (
					array_key_exists( $key, $defaults['education_system'] )
					&& $current_settings['education_system'][ $key ] === $defaults['education_system'][ $key ]
				) {
					$current_settings['education_system'][ $key ] = $value;
				}
			}

			foreach ( $preset_data['labels'] as $label_key => $values ) {
				// If current labels match default system labels, override them with the preset labels.
				if ( isset( $current_settings['labels'][ $label_key ] ) && $current_settings['labels'][ $label_key ] === $defaults['labels'][ $label_key ] ) {
					$current_settings['labels'][ $label_key ] = $values;
				}
			}

			foreach ( $preset_data['localization'] as $loc_key => $val ) {
				if (
					array_key_exists( $loc_key, $defaults['localization'] )
					&& $current_settings['localization'][ $loc_key ] === $defaults['localization'][ $loc_key ]
				) {
					$current_settings['localization'][ $loc_key ] = $val;
				}
			}

			foreach ( $preset_data['identifiers'] as $id_key => $values ) {
				if ( isset( $current_settings['identifiers'][ $id_key ] ) && $current_settings['identifiers'][ $id_key ] === $defaults['identifiers'][ $id_key ] ) {
					$current_settings['identifiers'][ $id_key ] = $values;
				}
			}

			// ponytail: was has_preserved_customizations() — a private method that
			// duplicated detect_customizations() on SettingsRepository. Delegated.
			$current_settings['education_system']['customized'] =
				( new SettingsRepository() )->detect_customizations_for( $current_settings );
		}

		$saved = $repository->update_settings( $current_settings );

		return [
			'success' => true,
			'data'    => $saved,
		];
	}

}
