=== CodeClove School Management System ===
Contributors: codeclove
Tags: school management, student management, attendance, school, education
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 1.1.3
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
= 1.1.0 =
Major milestone: student trash lifecycle and database cleanup, student portal user account management and dark mode, noticeboard announcement scheduling, WordPress login customizer, query security hardening, and performance polish. Recommended for all users.

= 1.0.10 =
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

= 1.1.3 =
* Improved: Plugin Information: Completely removed donation links across the plugin.

= 1.1.2 =
* Improved: Student Management: Faster bulk updates and deletions when managing large lists of students and staff.
* Improved: Student Profiles: Faster loading times and cleaner receipt printing on student finance tabs.
* Improved: Search Performance: More responsive search results across admin screens and the student portal.
* Improved: Timetable Duplication: Schedule copy tool now automatically matches the school's configured teaching days.
* Fixed: Finance Dashboard: Corrected outstanding fee totals and collection percentage numbers on fee cards.
* Fixed: System Stability: Resolved warning notices during plugin activation in mixed server environments.

= 1.1.1 =
* Added: 150+ Global Currencies: Full support for world currencies with automated zero-decimal rules.
* Added: Payment Gateway Intelligence: In-settings currency compatibility badge and checks for PayPal.
* Added: Timetable Slot Quick Clone: Instant slot clone mode with modifier hold (`Ctrl` / `Cmd`) support for rapid multi-cell placement across weekly schedules.
* Added: Live Operations Indicator: Added dynamic live operations status indicator badge to the admin dashboard header.
* Fixed: Card Content Hierarchy & Text Truncation: Restructured KPI stat cards with icon top-left, badge top-right, numeric value centered, and full-width non-truncated labels positioned below the value to eliminate ellipsis clipping.
* Fixed: Corner Radius Consistency: Harmonized border radii across all dashboard cards, stat cards, data tables, and modal dialogs to a balanced, professional 12px (`rounded-xl`), eliminating mismatched and overly-rounded bubble corners.
* Fixed: Operational Typography: Fixed uppercase tracked eyebrows on today's attendance and action items strips, restoring clean title case.
* Improved: Currency Typography: Polished symbol spacing and zero-decimal formatting across receipts, invoices, and the portal.
* Improved: Fees Progress Badge: Resolved fee collection rate badge display on the dashboard Outstanding Fees card.

= 1.1.0 =
* Added: Teacher Fatigue Protection: Automatic streak limit and rest break tracking across timetable periods; prevents assigning teachers to more than 3 consecutive periods without a rest break.
* Added: Smart Timetable Duplication: Added `Copy Subjects Only` mode for secondary schools to duplicate the weekly subject structure without cross-class teacher clashes.
* Added: Live Clash Simulation: Added real-time conflict pre-check simulation for day and term duplication to preview clash counts before modifying the database.
* Added: Assisted Teacher Picker: In-cell teacher dropdown dynamically prioritizes available staff and disables double-booked staff with contextual clash labels.
* Added: Timetable Health & Telemetry: Integrated live clash counts, workload balance badges, and progress capacity pills directly into the timetable card header.
* Added: Dynamic Print Iframe Orientation: Sized off-screen print iframe to match physical document orientation (portrait vs. landscape) prior to layout rendering.
* Added: Version Parity Alignment: Synchronized CodeClove Free and Pro releases into lockstep `1.1.0` milestone.
* Fixed: Print Perimeter & Skia Clipping: Fixed missing right-hand border on Saturday lesson rows during browser print preview by pulling table width to `calc(100% - 2px)` to prevent Chromium canvas margin clipping.
* Fixed: Column Width Consistency: Locked uniform percentage column widths in fixed table layout across `<thead>` and `<tbody>`.

= 1.0.18 =
* Added: Examinations Workspace Module: Complete examination management with theory & practical exams, flight board grading progress, class broadsheet tabulation ledger, and printable institutional admit cards.
* Added: Dual Broadsheet Tabulation Views: Detailed and summary ledger views with printable tabulation broadsheet documents.
* Added: Student Portal Examinations Hub: Students and guardians can view scheduled examinations, download admit cards, and access printable report cards.
* Added: Active Academic Session Bootstrap: Automatically inject active academic session into global frontend configuration (`CodeCloveConfig`).
* Added: Student Portal Account Linking: Link WordPress user accounts to student profiles with portal authentication and password reset capabilities.
* Added: WordPress Login Screen Customizer: School branding, custom logos, and custom color presets for the standard WordPress login page.
* Fixed: Database Query Hardening: Converted dynamic table queries to native `%i` placeholders with strict parameter binding for WordPress Plugin Check compliance.
* Fixed: Combobox Focus Trapping: Resolved focus trapping and backdrop pointer-events lock on nested modal dialogs.
* Fixed: Staff WP_Error Codes: Provided explicit, machine-readable error codes in `WP_Error` constructors for account linking endpoints.

= 1.0.17 =
* Added: Student Trash & Cleanup Lifecycle: Added soft-delete trash state, restore capability, and permanent database purge tool with orphaned record cleanup.
* Added: Roles & Permissions Matrix UI Overhaul: Redesigned role capability management grid with consolidated administrator hierarchy.
* Added: Institutional Admit Cards Density Engine: Optimized whitespace density to comfortably fit up to 18 exam subjects on a single A4 page.
* Added: Per-Exam Report Card Configuration: Country-aware report card display presets with customizable grading scales.
* Fixed: Student Import Unit Scoping: Scoped bulk CSV import classes to the active academic session and lifted dropdown pagination caps.
* Fixed: Weekend Days Synchronization: Added weekend days configuration and synchronized locale date formatting settings.

= 1.0.16 =
* Added: Student Documents Vault: Secure document uploads with plugin vault storage, preventing attachment collisions and unauthorized file access.
* Added: In-App Document Preview: Integrated modal preview for student documents with stream disposition controls.
* Added: Noticeboard Announcement Scheduling: Rich composer with announcement pinning, schedule date windows, and student portal feed integration.
* Added: Student Portal Theme Toggle: Added light/dark mode switch with dedicated dark tokens and unread notification bell.
* Added: Visual Certificate Designer: 3-zone visual studio for designing institutional certificates, clearance issuance, and portal integration.
* Added: Multi-Class Batch Certificate Issuance: Bulk certificate issuance with cohort exclusions and class-wise printing.
* Added: WhatsApp Business API Notifications: Meta WhatsApp Business integration with message templates and local test simulator.
* Added: Multi-Gateway Checkout: Stripe and PayPal payment gateways with drag-and-drop gateway ordering and portal fee checkout.
* Fixed: Timetable Print Layout: Polished timetable print layout, typography, and single-page landscape constraints.
* Fixed: Feedback Telemetry Routing: Modernized in-app bug reporting and diagnostics endpoints to REST namespace.

= 1.0.15 =
* Added: Licensing Architecture: Integrated Ed25519 cryptographic token verification, license heartbeat scheduling, and decentralized feature gates.
* Added: Internationalization (i18n): Comprehensive text domain migration to `codeclove-school-management` and RTL layout support.
* Fixed: WordPress.org Directory Compliance: Resolved all plugin check notices, isolated Pro-only code, and unified packaging pipeline.
* Fixed: Command Palette Permissions: Scoped global command search actions to active user role permissions.

= 1.0.14 =
* Added: Ed25519 License Token Verification: Cryptographically signed license keys and decentralized offline validation.
* Fixed: Release Packaging: Standardized distribution scripts for lockstep Free and Pro archive builds.

= 1.0.13 =
* Added: License Management: Transient caching for license verification, daily heartbeat, and admin notices.

= 1.0.12 =
* Added: Automatic Updater Integration: Integrated EDD Software Licensing updater and license activation admin screen.

= 1.0.11 =
* Fixed: Student Cascade Deletion: Safely validates database table existence before running student cleanup queries.
* Fixed: Navigation Menu Hygiene: Removed locked submenu links for a clean, 100% operational sidebar interface.
* Fixed: Security Hardening: Enforced strict placeholder parameterization across database queries.
* Fixed: Date Pickers & Modals: Refined date pickers, popovers, and student document preview modals.

= 1.0.10 =
* Added: WordPress Login Customizer: School logo and custom styling presets on the standard WordPress login page.
* Added: Student Portal User Accounts: Link WordPress user accounts to student records with self-service login and password reset.
* Added: Noticeboard Scheduling: Announcement scheduling, pinning, and portal feed display.
* Fixed: Admission Application Timeline: Event tracking and walk-in source attribution.

= 1.0.9 =
* Added: Public Staff Application Form: Embeddable shortcode for staff recruitment with admin review list and status workflow.
* Fixed: Public Admissions Session Scoping: Admissions submitted via shortcode now properly associate with the active academic session.
* Fixed: Session Promotion Layout: Refined promotion workflow step navigation.

= 1.0.8 =
* Fixed: Navigation Polish: Removed duplicate Timetable entry from admin sidebar.
* Fixed: Pro Settings Tabs: In-tab upgrade panels instead of redirecting away from Settings.
* Fixed: Promotion & Rollover: Correctly tagged Pro-only features.
* Fixed: Defaulters Report: Replaced mock figures with realistic placeholders.
* Fixed: Directory Compliance: Added Privacy Policy disclosures and removed external feedback calls from free distribution.

= 1.0.7 =
* Security: Account Creation Guard: Staff profile endpoints no longer create or reset WordPress user accounts without explicit administrator privileges.
* Security: Role Hierarchy: Enforced role hierarchy on staff role assignments.
* Fixed: Dev-Server Probes: Dev-server health probes scoped strictly to local development environments.

= 1.0.6 =
* Added: Voluntary Deactivation Feedback: Optional survey when an administrator chooses to deactivate the plugin, with full privacy disclosures.

= 1.0.5 =
* Added: Online Payment Gateways: Stripe and PayPal integration for fee invoicing and student portal checkout.
* Added: Staff Attendance Defaults: Default status submission support for initial daily registers.
* Fixed: Fee Statement Letterhead: Cleaned up letterhead typography and invoice statement layout.

= 1.0.3 =
* Updated: Directory Discoverability: Refined readme description and tags for WordPress.org search guidelines.

= 1.0.2 =
* Fixed: Modal Date Picker: Keyboard handling and selection inside modal dialogs.
* Fixed: Overlay Interaction: Prevented modal dismissal during portaled select interactions.

= 1.0.1 =
* Fixed: REST API Boundaries: Input sanitization and parameter validation at all API endpoints.
* Fixed: SPA Shell: Removed deprecated `print_emoji_styles` action hook before rendering the admin shell.

= 1.0.0 =
* Added: Initial Release: Complete self-hosted school management system for WordPress.
* Added: Core Modules: Unlimited students, guardians, staff directory, academic sessions, terms, classes, subjects, daily attendance registers, fee invoicing, and student/parent self-service portal (`[codeclove_portal]`).
* Added: Country Presets: Built-in localization presets for India (IN), United States (US), and United Kingdom (GB).
