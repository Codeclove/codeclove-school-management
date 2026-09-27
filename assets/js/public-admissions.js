/**
 * Nexora Public Admissions & Careers Form Scripts
 *
 * @package Nexora\Modules\Admissions
 */

(function () {
	'use strict';

	function escHtml(str) {
		if (str === null || str === undefined) return '';
		var div = document.createElement('div');
		div.textContent = String(str);
		return div.innerHTML;
	}

	window.nexoraSubmitForm = window.nexoraSubmitForm || function (formId, btnId, msgId, url, successTpl, i18n) {
		var form = document.getElementById(formId);
		if (!form) return;

		var strings = i18n || {
			submitting: 'Submitting...',
			failed: 'Submission failed. Please verify required fields.',
			networkError: 'Network error occurred. Please try again.'
		};

		form.addEventListener('submit', function (e) {
			e.preventDefault();
			var btn = document.getElementById(btnId);
			var msg = document.getElementById(msgId);
			btn.disabled = true;
			var orig = btn.innerText;
			btn.innerText = strings.submitting;
			msg.style.display = 'none';

			var payload = {};
			new FormData(form).forEach(function (v, k) {
				payload[k] = v;
			});

			fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			})
				.then(function (r) { return r.json(); })
				.then(function (d) {
					btn.disabled = false;
					btn.innerText = orig;
					msg.style.display = 'block';
					if (d.success) {
						msg.className = 'nexora-response-msg success';
						var ref = (d.data && d.data.reference_number) ? escHtml(d.data.reference_number) : '';
						msg.innerHTML = successTpl.replace('{ref}', ref);
						form.reset();
					} else {
						msg.className = 'nexora-response-msg error';
						msg.textContent = d.message || strings.failed;
					}
				})
				.catch(function () {
					btn.disabled = false;
					btn.innerText = orig;
					msg.style.display = 'block';
					msg.className = 'nexora-response-msg error';
					msg.textContent = strings.networkError;
				});
		});
	};

	window.nexoraInitStatusTracker = window.nexoraInitStatusTracker || function (opts) {
		var form = document.getElementById(opts.formId);
		if (!form) return;

		form.addEventListener('submit', function (e) {
			e.preventDefault();
			var btn = document.getElementById(opts.btnId);
			var out = document.getElementById(opts.outId);
			btn.disabled = true;
			btn.innerText = opts.i18n.checking;
			out.style.display = 'none';

			var ref = document.getElementById(opts.refId).value;
			var sec = document.getElementById(opts.secondId).value;
			var url = opts.statusUrl + '?reference_number=' + encodeURIComponent(ref);
			if (sec) {
				url += '&' + (opts.isStaff ? 'email' : 'student_date_of_birth') + '=' + encodeURIComponent(sec);
			}

			fetch(url)
				.then(function (res) { return res.json(); })
				.then(function (data) {
					btn.disabled = false;
					btn.innerText = opts.i18n.check_status;
					out.style.display = 'block';

					if (data.success) {
						out.className = 'nexora-tracker-card';
						var d = data.data;
						var st = d.status || 'submitted';
						var step1 = 'completed', step2 = '', step3 = '', step4 = '';
						var note = opts.i18n.app_received;
						var statusText = opts.i18n.submitted;

						var safeRef = escHtml(d.reference_number || '');
						if (opts.isStaff) {
							var name = escHtml((d.first_name || '') + ' ' + (d.last_name || ''));
							var safeRole = escHtml(d.desired_role || opts.i18n.staff_default || '');
							var meta = escHtml(opts.i18n.ref_prefix) + ' <strong>' + safeRef + '</strong> | ' + escHtml(opts.i18n.role_prefix) + ' <strong>' + safeRole + '</strong>';
							var l1 = escHtml(opts.i18n.step_received), l2 = escHtml(opts.i18n.step_screening), l3 = escHtml(opts.i18n.step_interview), l4 = escHtml(opts.i18n.step_decision);

							if (st === 'under_review') {
								step2 = 'active';
								statusText = opts.i18n.under_review;
								note = opts.i18n.staff_review_note;
							} else if (st === 'shortlisted' || st === 'interview') {
								step2 = 'completed';
								step3 = 'active';
								statusText = opts.i18n.shortlisted;
								note = opts.i18n.shortlisted_note;
							} else if (st === 'accepted' || st === 'hired') {
								step2 = 'completed';
								step3 = 'completed';
								step4 = 'completed';
								statusText = opts.i18n.offer_extended;
								note = opts.i18n.offer_extended_note;
							} else if (st === 'rejected') {
								step2 = 'completed';
								step3 = 'completed';
								step4 = 'completed';
								statusText = opts.i18n.closed;
								note = opts.i18n.closed_note;
							} else {
								step1 = 'active';
							}
						} else {
							var name = escHtml((d.student_first_name || '') + ' ' + (d.student_last_name || ''));
							var safeUnit = escHtml(d.academic_unit_name || opts.i18n.na_default || '');
							var meta = escHtml(opts.i18n.ref_prefix) + ' <strong>' + safeRef + '</strong> | ' + escHtml(opts.i18n.class_prefix) + ' <strong>' + safeUnit + '</strong>';
							var l1 = escHtml(opts.i18n.step_received), l2 = escHtml(opts.i18n.step_review), l3 = escHtml(opts.i18n.step_assessment), l4 = escHtml(opts.i18n.step_decision);

							if (st === 'under_review') {
								step2 = 'active';
								statusText = opts.i18n.under_review;
								note = opts.i18n.adm_review_note;
							} else if (st === 'interview_scheduled') {
								step2 = 'completed';
								step3 = 'active';
								statusText = opts.i18n.assessment;
								note = opts.i18n.assessment_note;
							} else if (st === 'accepted') {
								step2 = 'completed';
								step3 = 'completed';
								step4 = 'completed';
								statusText = opts.i18n.approved;
								note = opts.i18n.approved_note;
							} else if (st === 'enrolled') {
								step2 = 'completed';
								step3 = 'completed';
								step4 = 'completed';
								statusText = opts.i18n.enrolled;
								note = opts.i18n.enrolled_note;
							} else if (st === 'rejected') {
								step2 = 'completed';
								step3 = 'completed';
								step4 = 'completed';
								statusText = opts.i18n.decision_issued;
								note = opts.i18n.decision_issued_note;
							} else {
								step1 = 'active';
							}
						}

						out.innerHTML = '<div class="nexora-tracker-header">' +
							'<div><div class="nexora-tracker-title">' + name + '</div><div class="nexora-tracker-meta">' + meta + '</div></div>' +
							'<div class="nexora-tracker-badge">' + escHtml(statusText) + '</div>' +
							'</div>' +
							'<div class="nexora-stepper">' +
							'<div class="nexora-step ' + step1 + '"><div class="nexora-step-num">1</div><div class="nexora-step-lbl">' + l1 + '</div></div>' +
							'<div class="nexora-step ' + step2 + '"><div class="nexora-step-num">2</div><div class="nexora-step-lbl">' + l2 + '</div></div>' +
							'<div class="nexora-step ' + step3 + '"><div class="nexora-step-num">3</div><div class="nexora-step-lbl">' + l3 + '</div></div>' +
							'<div class="nexora-step ' + step4 + '"><div class="nexora-step-num">4</div><div class="nexora-step-lbl">' + l4 + '</div></div>' +
							'</div>' +
							'<div class="nexora-guidance-box"><strong>' + escHtml(opts.i18n.current_status) + '</strong> ' + escHtml(note) + '</div>';
					} else {
						out.className = 'nexora-tracker-card notfound';
						out.textContent = data.message || opts.i18n.not_found;
					}
				})
				.catch(function () {
					btn.disabled = false;
					btn.innerText = opts.i18n.check_status;
					out.style.display = 'block';
					out.className = 'nexora-tracker-card notfound';
					out.textContent = opts.i18n.lookup_error;
				});
		});
	};
})();
