<?php
/**
 * Deactivation Feedback Survey.
 *
 * Intercepts plugin deactivation on plugins.php to collect voluntary
 * feedback before deactivation, complying with WordPress.org guidelines.
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
 * Class DeactivationFeedback
 */
final class DeactivationFeedback {

	/**
	 * Registers hooks for the deactivation survey.
	 */
	public static function init(): void {
		add_action( 'admin_footer-plugins.php', [ __CLASS__, 'render_modal' ] );
		add_action( 'admin_footer-plugins-network.php', [ __CLASS__, 'render_modal' ] );
		add_action( 'wp_ajax_codeclove_deactivate_feedback', [ __CLASS__, 'handle_ajax' ] );
	}

	/**
	 * Handles AJAX feedback submission.
	 */
	public static function handle_ajax(): void {
		if ( ! check_ajax_referer( 'codeclove_deactivate_feedback', 'nonce', false ) ) {
			wp_send_json_error( [ 'message' => 'Invalid security token' ], 403 );
		}

		if ( ! current_user_can( 'activate_plugins' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized' ], 403 );
		}

		$reason  = isset( $_POST['reason'] ) ? sanitize_text_field( wp_unslash( $_POST['reason'] ) ) : '';
		$details = isset( $_POST['details'] ) ? sanitize_text_field( wp_unslash( $_POST['details'] ) ) : '';

		$payload = [
			'plugin'         => 'codeclove-school-management',
			'type'           => 'deactivation_feedback',
			'reason'         => $reason,
			'details'        => $details,
			'plugin_version' => defined( 'CODECLOVE_VERSION' ) ? CODECLOVE_VERSION : '1.0.0',
			'wp_version'     => get_bloginfo( 'version' ),
			'php_version'    => PHP_VERSION,
			'site_lang'      => get_locale(),
			'site_url'       => get_site_url(),
		];
		// Dispatch non-blocking HTTP request to CodeClove deactivation receiver.
		$api_url = ( defined( 'CODECLOVE_DEACTIVATION_API_URL' ) && CODECLOVE_DEACTIVATION_API_URL )
			? CODECLOVE_DEACTIVATION_API_URL
			: 'https://feedback.codeclove.com/nexora/v1/deactivate';

		$receiver_url = (string) apply_filters( 'codeclove_deactivation_api_url', $api_url );
		wp_remote_post(
			$receiver_url,
			[
				'headers'   => [ 'Content-Type' => 'application/json' ],
				'body'      => wp_json_encode( $payload ),
				'timeout'   => 2,
				'blocking'  => false,
				'sslverify' => true,
			]
		);

		do_action( 'codeclove_deactivation_feedback_sent', $payload );

		wp_send_json_success();
	}

	/**
	 * Renders the modal HTML and vanilla JS in the plugins screen footer.
	 */
	public static function render_modal(): void {
		if ( ! current_user_can( 'activate_plugins' ) ) {
			return;
		}

		$nonce = wp_create_nonce( 'codeclove_deactivate_feedback' );
		?>
		<div id="codeclove-deactivate-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.5); backdrop-filter:blur(2px); z-index:999999; align-items:center; justify-content:center; padding:16px;">
			<div style="background:#fff; border-radius:10px; max-width:480px; width:100%; box-shadow:0 20px 25px -5px rgba(15,23,42,0.15), 0 8px 10px -6px rgba(15,23,42,0.1); border:1px solid rgba(0,0,0,0.06); padding:24px 28px; position:relative; box-sizing:border-box; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
				<button type="button" id="codeclove-modal-close" style="position:absolute; top:18px; right:18px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; background:none; border:none; font-size:18px; line-height:1; cursor:pointer; color:#94a3b8; border-radius:6px; transition:all 0.15s ease;" aria-label="<?php esc_attr_e( 'Close', 'codeclove-school-management' ); ?>">&times;</button>
				
				<div style="margin-bottom:14px;">
					<h3 style="margin:0 0 6px 0; font-size:16px; font-weight:600; color:#0f172a; line-height:1.3; letter-spacing:-0.01em;">
						<?php esc_html_e( 'Quick Feedback', 'codeclove-school-management' ); ?>
					</h3>
					<p style="margin:0; color:#64748b; font-size:13px; line-height:1.5;">
						<?php esc_html_e( 'If you have a moment, please let us know why you are deactivating:', 'codeclove-school-management' ); ?>
					</p>
				</div>

				<form id="codeclove-deactivate-form" style="margin:0;">
					<div style="display:flex; flex-direction:column; gap:4px; margin-bottom:14px;">
						<label class="codeclove-reason-row" style="display:block; padding:7px 10px; border-radius:6px; cursor:pointer; transition:background-color 0.15s ease;">
							<div style="display:flex; align-items:center; gap:9px;">
								<input type="radio" name="codeclove_reason" value="setup_difficulty" style="margin:0; accent-color:#2563eb; cursor:pointer;">
								<span style="font-size:13px; color:#1e293b;"><?php esc_html_e( "I couldn't figure out how to set it up", 'codeclove-school-management' ); ?></span>
							</div>
						</label>

						<label class="codeclove-reason-row" style="display:block; padding:7px 10px; border-radius:6px; cursor:pointer; transition:background-color 0.15s ease;">
							<div style="display:flex; align-items:center; gap:9px;">
								<input type="radio" name="codeclove_reason" value="missing_feature" style="margin:0; accent-color:#2563eb; cursor:pointer;">
								<span style="font-size:13px; color:#1e293b;"><?php esc_html_e( 'Missing a feature I need', 'codeclove-school-management' ); ?></span>
							</div>
						</label>

						<label class="codeclove-reason-row" style="display:block; padding:7px 10px; border-radius:6px; cursor:pointer; transition:background-color 0.15s ease;">
							<div style="display:flex; align-items:center; gap:9px;">
								<input type="radio" name="codeclove_reason" value="unsupported_country" style="margin:0; accent-color:#2563eb; cursor:pointer;">
								<span style="font-size:13px; color:#1e293b;"><?php esc_html_e( "My country's grading or academic terms aren't supported", 'codeclove-school-management' ); ?></span>
							</div>
						</label>

						<label class="codeclove-reason-row" style="display:block; padding:7px 10px; border-radius:6px; cursor:pointer; transition:background-color 0.15s ease;">
							<div style="display:flex; align-items:center; gap:9px;">
								<input type="radio" name="codeclove_reason" value="temporary" style="margin:0; accent-color:#2563eb; cursor:pointer;">
								<span style="font-size:13px; color:#1e293b;"><?php esc_html_e( 'Temporary deactivation / troubleshooting', 'codeclove-school-management' ); ?></span>
							</div>
						</label>

						<label class="codeclove-reason-row" style="display:block; padding:7px 10px; border-radius:6px; cursor:pointer; transition:background-color 0.15s ease;">
							<div style="display:flex; align-items:center; gap:9px;">
								<input type="radio" name="codeclove_reason" value="other" style="margin:0; accent-color:#2563eb; cursor:pointer;">
								<span style="font-size:13px; color:#1e293b;"><?php esc_html_e( 'Other', 'codeclove-school-management' ); ?></span>
							</div>
						</label>
					</div>

					<div id="codeclove-detail-wrap" style="display:none; margin-bottom:16px;">
						<input type="text" id="codeclove-detail-input" class="codeclove-detail-input" style="width:100%; padding:7px 10px; font-size:12.5px; border:1px solid #cbd5e1; border-radius:6px; outline:none; box-sizing:border-box;" placeholder="">
					</div>

					<div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding-top:14px; border-top:1px solid #f1f5f9;">
						<button type="button" id="codeclove-btn-cancel" style="background:none; border:none; padding:4px 6px; color:#94a3b8; font-size:13px; cursor:pointer; text-decoration:none; font-weight:500; transition:color 0.15s ease;">
							<?php esc_html_e( 'Cancel', 'codeclove-school-management' ); ?>
						</button>
						<div style="display:flex; align-items:center; gap:8px;">
							<button type="button" class="button button-secondary" id="codeclove-btn-skip" style="color:#64748b; border-color:#cbd5e1; background:#fff; height:32px; padding:0 12px; font-size:12.5px; border-radius:6px;">
								<?php esc_html_e( 'Skip &amp; Deactivate', 'codeclove-school-management' ); ?>
							</button>
							<button type="button" class="button button-primary" id="codeclove-btn-submit" disabled style="background:#2563eb; border-color:#2563eb; height:32px; padding:0 14px; font-size:12.5px; font-weight:500; border-radius:6px; transition:opacity 0.15s ease;">
								<?php esc_html_e( 'Submit &amp; Deactivate', 'codeclove-school-management' ); ?>
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>

		<style>
		.codeclove-reason-row:hover { background-color: #f8fafc; }
		#codeclove-modal-close:hover { background-color: #f1f5f9; color: #334155; }
		#codeclove-btn-cancel:hover { color: #475569; }
		.codeclove-detail-input:focus { border-color: #2563eb !important; box-shadow: 0 0 0 2px rgba(37,99,235,0.15); }
		</style>

		<script>
		(function() {
			var link = document.querySelector('a[href*="action=deactivate"][href*="codeclove-school-management"]');
			if (!link) return;

			var modal = document.getElementById('codeclove-deactivate-modal');
			if (!modal) return;

			var form = document.getElementById('codeclove-deactivate-form');
			var submitBtn = document.getElementById('codeclove-btn-submit');
			var skipBtn = document.getElementById('codeclove-btn-skip');
			var cancelBtn = document.getElementById('codeclove-btn-cancel');
			var closeBtn = document.getElementById('codeclove-modal-close');
			var redirectUrl = '';

			link.addEventListener('click', function(e) {
				e.preventDefault();
				redirectUrl = link.href;
				modal.style.display = 'flex';
			});

			function closeModal() {
				modal.style.display = 'none';
				redirectUrl = '';
			}

			cancelBtn.addEventListener('click', closeModal);
			closeBtn.addEventListener('click', closeModal);

			modal.addEventListener('click', function(e) {
				if (e.target === modal) closeModal();
			});

			document.addEventListener('keydown', function(e) {
				if (e.key === 'Escape' && modal.style.display === 'flex') {
					closeModal();
				}
			});

			var detailWrap = document.getElementById('codeclove-detail-wrap');
			var detailInput = document.getElementById('codeclove-detail-input');
			var placeholders = {
				missing_feature: '<?php echo esc_js( __( 'What feature do you need?', 'codeclove-school-management' ) ); ?>',
				unsupported_country: '<?php echo esc_js( __( 'Which country or curriculum? (e.g. Nigeria, Philippines)', 'codeclove-school-management' ) ); ?>',
				other: '<?php echo esc_js( __( 'Please share any details (optional)', 'codeclove-school-management' ) ); ?>'
			};

			form.addEventListener('change', function(e) {
				if (e.target.name !== 'codeclove_reason') return;
				submitBtn.removeAttribute('disabled');
				var ph = placeholders[e.target.value];
				if (ph) {
					detailWrap.style.display = 'block';
					detailInput.placeholder = ph;
					detailInput.focus();
				} else {
					detailWrap.style.display = 'none';
					detailInput.value = '';
				}
			});

			skipBtn.addEventListener('click', function() {
				if (redirectUrl) window.location.href = redirectUrl;
			});

			submitBtn.addEventListener('click', function() {
				if (!redirectUrl) return;

				var selected = form.querySelector('input[name="codeclove_reason"]:checked');
				if (!selected) {
					window.location.href = redirectUrl;
					return;
				}

				submitBtn.setAttribute('disabled', 'disabled');
				submitBtn.textContent = '<?php echo esc_js( __( 'Deactivating...', 'codeclove-school-management' ) ); ?>';
				skipBtn.setAttribute('disabled', 'disabled');

				var data = new URLSearchParams();
				data.append('action', 'codeclove_deactivate_feedback');
				data.append('nonce', '<?php echo esc_js( $nonce ); ?>');
				data.append('reason', selected.value);
				data.append('details', detailWrap.style.display !== 'none' ? detailInput.value.trim() : '');

				var done = false;
				function finish() {
					if (!done) {
						done = true;
						window.location.href = redirectUrl;
					}
				}
				setTimeout(finish, 1500);

				fetch(ajaxurl, { method: 'POST', body: data }).finally(finish);
			});
		})();
		</script>
		<?php
	}
}
