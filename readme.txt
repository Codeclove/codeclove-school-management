=== CodeClove School Management System ===
Contributors: codeclove
Tags: school management, student management, attendance, school, education
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 1.0.10
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Business Model: freemium

School management for WordPress. Students, staff, admissions, attendance, fee invoicing, and parent portal. Unlimited records, no monthly fees.

== Description ==

**CodeClove School Management System** is a complete, self-hosted school administration plugin for WordPress. Manage unlimited students, staff, academic sessions, daily attendance, fee invoices, and a parent-student self-service portal — all from your WordPress admin. No SaaS subscription, no per-student fees, no data leaving your server.

Built for real schools: primary, secondary, and higher-secondary institutions across India, the US, and the UK are supported out of the box with country-specific presets for grading scales, currency, phone formats, and academic term names. Any other country works too — every setting is fully customisable.

🚀 **[Try the Live Demo](https://demo.codeclove.com/school-management-pro/?utm_source=wporg&utm_medium=readme&utm_campaign=demo)** — full admin dashboard and student portal, no signup required.

📖 **[Documentation](https://docs.codeclove.com/school-management-pro/?utm_source=wporg&utm_medium=readme&utm_campaign=docs)** — setup guides and tutorials.

⭐ **[Upgrade to Pro](https://codeclove.com/plugins/codeclove-school-management-pro/?utm_source=wporg&utm_medium=readme&utm_campaign=pro_header)** — online payments, timetable builder, SMS and WhatsApp alerts.

= What the free plugin includes =

**Student management**
Unlimited student profiles with guardian contacts, enrollment history, and printable dual-side ID cards. Bulk CSV import to onboard hundreds of students from a spreadsheet in minutes.

**Online admissions**
Embed `[codeclove_admission_form]` on any page. Review applications in the admin, then convert an applicant to an enrolled student in one click.

**Daily attendance register**
Mark Present, Absent, Late, or Excused per student and generate instant daily summary reports. Staff attendance is tracked separately.

**Fee invoicing and receipts**
Define fee heads per class, generate invoices, and record offline payments with printable, branded receipts.

**Staff directory**
Teacher and admin records with roles, contact information, class assignments, and secure links to WordPress user accounts.

**Academic structure**
Sessions, terms, classes, groups, and subjects — organised the way your school actually works, not around software limitations.

**Student and parent portal**
`[codeclove_portal]` gives students and guardians a self-service frontend view of attendance records, timetable, and fee invoices — no third-party portal app required.

**Role-based access control**
Predefined roles for Principals, Teachers, Accountants, and Receptionists. WordPress administrators bypass all checks automatically.

**Command palette**
Global search across students, staff, pages, and shortcuts — accessible from anywhere in the admin.

**Dark mode**
Full dark theme for the admin interface, independent of the active WordPress theme.

**Zero external tracking**
No Google Fonts, no external CDNs, no analytics or telemetry calls. Every asset and all school data stay on your server.

= Built-in country presets =

Run the setup wizard, choose your country, and the plugin configures itself:

* 🇮🇳 **India** — INR currency, Indian phone format, CBSE/ICSE class naming, Hindi-compatible date fields.
* 🇺🇸 **United States** — USD, K-12 grade labels, US phone format, semester/quarter terms.
* 🇬🇧 **United Kingdom** — GBP, Key Stage labels, UK phone format, term naming.
* 🌍 **Any other country** — all labels, currency symbols, date formats, and academic terms are fully customisable.

= Free vs Pro comparison =

**Included in Free and Pro:**

* Unlimited student & staff records
* Country presets for India, US, and UK
* Student & guardian self-service portal
* Daily attendance register (student & staff)
* Fee heads, invoicing & offline payments

**Pro only:**

* Online payments — Stripe, PayPal, Razorpay, UPI
* Drag-and-drop timetable & substitution manager
* SMS & WhatsApp notifications — Twilio, MSG91
* 1-click session rollover & batch student promotion
* Granular role permissions builder
* Priority engineering support

👉 **[View Pro features, pricing, and live demo →](https://codeclove.com/plugins/codeclove-school-management-pro/?utm_source=wporg&utm_medium=readme&utm_campaign=pro_cta)**

= Who this plugin is for =

* **Primary and secondary schools** that need a self-hosted alternative to expensive SaaS school management platforms.
* **Coaching institutes and tuition centres** that want to track student enrolment, fees, and attendance without per-student costs.
* **International schools** needing flexible country configuration without hard-coded assumptions.
* **School IT administrators** who want full control over student data and hosting.
* **Developers and agencies** building school websites on WordPress who need a solid, extensible management layer.

== Installation ==

1. Go to **Plugins → Add New** in your WordPress admin and search for **CodeClove School Management**, or upload the ZIP file manually via **Plugins → Add New → Upload Plugin**.
2. Activate the plugin.
3. Open **School Management** in your admin sidebar.
4. Run the setup wizard, pick your country preset, and create your first academic session.
5. Add your academic structure (classes, groups, subjects), then start adding students and staff.

== Frequently Asked Questions ==

= Is the student or staff count limited in the free version? =

No. Unlimited students, guardians, classes, and staff records. No quotas, no trial periods, and no features hidden behind a paywall in the free version.

= Does the plugin work for Indian schools with CBSE or ICSE curriculum? =

Yes. Select the India preset during setup and the plugin configures INR currency, Indian phone formats, and standard class naming automatically. You can override any of these settings at any time.

= Does the plugin work for US K-12 schools? =

Yes. The US preset configures USD currency, K-12 grade labels, US phone format, and semester/quarter term naming. All labels are fully customisable.

= Does the plugin send any data to external servers? =

By default, no. All fonts, styles, scripts, and school data stay 100% on your server with zero background analytics or tracking. The only optional external request is the voluntary deactivation survey, fully documented in the External Services section of this readme.

= Can I upgrade to Pro without losing data? =

Yes. Pro uses the same database tables. Install and activate the Pro plugin alongside the free version and all existing student, staff, and attendance records carry over with zero migration steps.

= What WordPress and PHP versions are required? =

WordPress 6.5 or later and PHP 8.1 or later.

= Does it work for coaching institutes and tuition centres, not just schools? =

Yes. The academic structure — sessions, classes, groups, and subjects — works for any teaching institution. The terminology on every screen is fully customisable.

= How do I embed the student and parent portal on my site? =

Create a WordPress page, add the shortcode `[codeclove_portal]`, and publish it. Students and guardians log in with their WordPress credentials and see a dashboard scoped to their own records.

= How do I collect online admissions? =

Add `[codeclove_admission_form]` to any page. Applicants fill in the form on the frontend; you review submissions in the admin and convert accepted applicants to enrolled students in one click.

= Is the plugin translation-ready? =

Yes. All user-facing strings use the `codeclove-school-management` text domain and are ready for translation via standard WordPress translation tools.

= Where is the source code? =

The full React and TypeScript source is available at [github.com/Codeclove/codeclove-school-management](https://github.com/Codeclove/codeclove-school-management).

== Screenshots ==

1. Dashboard — attendance summaries, key metrics, and recent activity at a glance.
2. Student directory — profiles, guardian details, and academic enrolments.
3. Daily attendance register — one-click marking with Present, Absent, Late, and Excused statuses.
4. Academic management — sessions, classes, units, and subjects with country presets.
5. Invoicing — define fee types, generate invoices, and record offline payments.
6. Student profile and ID card — full academic record with printable dual-side ID card.
7. Roles and permissions — access control matrix for staff and administrators.
8. Command palette — global search for students, pages, shortcuts, and actions.
9. Dark mode — full dark theme for the admin interface.

== Source Code ==

The JavaScript bundles in `assets/build/` are compiled from TypeScript and React source files.

Full source: https://github.com/Codeclove/codeclove-school-management

Third-party libraries included in the compiled output:

* React 18 — MIT License — https://github.com/facebook/react
* React Router 6 — MIT License — https://github.com/remix-run/react-router
* Tailwind CSS — MIT License — https://github.com/tailwindlabs/tailwindcss
* shadcn/ui components — MIT License — https://github.com/shadcn-ui/ui
* Lucide React icons — ISC License — https://github.com/lucide-icons/lucide

All bundled libraries are open-source and GPL-compatible.

== Upgrade Notice ==

= 1.0.10 =
WordPress login customizer, student portal user account linking, portal dark mode toggle, noticeboard scheduling, and UI refinements. Recommended for all users.

= 1.0.9 =
Public admissions shortcode session association fix, staff recruitment applications portal, and general stability improvements. Recommended for all users.

= 1.0.8 =
Compliance and stability update. Fixes sidebar navigation, Pro settings tabs, and session rollover. Recommended for all users.

= 1.0.7 =
Security and compliance update. Removes in-dashboard external feedback from the free version, hardens staff endpoint security to prevent privilege escalation, and replaces dev-server probes with the WordPress HTTP API. Recommended for all users.
== External Services ==

This plugin makes no background or automatic network requests. The one external connection below is strictly opt-in and triggered only by an explicit administrator action.

= Deactivation Feedback =

An optional survey is shown when an administrator deactivates the plugin. Submission is voluntary — clicking "Skip & Deactivate" sends nothing.

* **Triggered by:** Administrator choosing to submit the deactivation survey (not by deactivating alone).
* **Data sent:** Selected reason, optional comment, plugin version, WordPress version, PHP version, site URL, and site locale.
* **Endpoint:** `https://feedback.codeclove.com/nexora/v1/deactivate`
* **Provider:** CodeClove
* **Terms of Service:** https://codeclove.com/terms/
* **Privacy Policy:** https://codeclove.com/privacy-policy/

== Privacy Policy ==

This plugin does not collect any data by default.

The voluntary deactivation survey (shown only when an administrator deactivates the plugin) may transmit: the selected reason, optional comment, plugin version, WordPress version, PHP version, site locale, and site URL to CodeClove's feedback server at https://feedback.codeclove.com. Submission is entirely optional — clicking "Skip & Deactivate" sends nothing.

For full details see: https://codeclove.com/privacy-policy/

== Changelog ==

= 1.0.10 =
* Feature: WordPress login screen branding with school logo and custom styling.
* Feature: Link WordPress user accounts to students with portal access and password reset.
* Feature: Student & parent portal theme toggle (light/dark mode) and notification bell.
* Feature: Noticeboard announcement scheduling, pinning, and portal feed display.
* Fix: Admission application timeline event tracking and walk-in source attribution.
* Tweak: Streamlined table row actions, command palette elevation, and print layout polish.

= 1.0.9 =
* Fix: Public admissions submitted via shortcode now properly associate with the active academic session and display in the admin applications list.
* Feature: Public staff application shortcode and status tracking support.
* Feature: Staff applications review list and detail review workflow.
* Tweak: Cleaner confirmation dialogs and improved accessibility across data tables.
* Tweak: Refined session promotion workflow step layout.

= 1.0.8 =
* Fix: Duplicate Timetable item in sidebar navigation.
* Fix: Pro settings tabs now show an upgrade panel in-tab rather than leaving Settings.
* Fix: Promotion & Rollover correctly marked as Pro-only instead of "coming soon".
* Fix: Defaulters Report preview replaced fake figures with neutral placeholders.
* Compliance: Review prompt no longer solicits a specific star rating.
* Compliance: Removed Donate link header (was pointing to a sales page).
* Compliance: Deactivation modal now discloses what data is submitted and links to Privacy Policy.
* Compliance: Added Privacy Policy section to readme.

= 1.0.7 =
* Security: Staff profile endpoints no longer create or reset WordPress user accounts.
* Security: Role hierarchy enforced on staff role assignments.
* Fix: Dev-server probe scoped to development mode only.

= 1.0.6 =
* Feature: Voluntary deactivation feedback survey.
* Fix: Feedback telemetry routed to correct endpoint.

= 1.0.5 =
* Feature: Improved student admissions and portal workflow.
* Fix: Initial staff attendance submission now allowed with default statuses.
* Tweak: Fee statement and letterhead layout refresh.

= 1.0.3 =
* Tweak: Readme description trimmed to WP.org 150-character limit.
* Tweak: Plugin tags updated for better discoverability.

= 1.0.2 =
* Fix: Date picker selection and keyboard handling inside modal dialogs.
* Fix: Modal dismissal no longer triggered by portaled overlay interaction.

= 1.0.1 =
* Fix: Input sanitization at REST API boundaries.
* Fix: Deprecated print_emoji_styles hook removed from SPA shell.
* Fix: Timetable queries in attendance and portal services.

= 1.0.0 =
* Initial release.
