=== CodeClove School Management System ===
Contributors: codeclove
Tags: school management, student management, attendance, education, school erp
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 1.0.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Multi-country school management system for WordPress. Manage student admissions, classes, staff, and daily attendance. Free forever.

== Description ==

**CodeClove School Management System** is a modern, country-aware school management system built natively for WordPress. Designed for K-12 schools, coaching institutes, and colleges, it simplifies student record-keeping, staff directories, academic session structuring, and daily student attendance tracking.

The plugin is built from the ground up with built-in multi-country presets (India, United States, and United Kingdom), allowing you to immediately configure grading conventions, phone formats, currency symbols, and academic terms with a single click.

= Free Features =

* **Unlimited Student Records** — Create and manage detailed student profiles, guardian information, contact records, and enrollment dates with no artificial caps.
* **Bulk CSV Spreadsheet Import** — Fast spreadsheet onboarding for students and faculty with custom column mapping.
* **Online Admissions & Inquiries** — Public embeddable shortcode application form, application review stages, and one-click applicant-to-student conversion.
* **Fee Types & Manual Invoicing** — Configure fee heads/types with class rates, generate student invoices, and record manual payments with receipts.
* **Staff & Faculty Directory** — Maintain comprehensive teacher and administrative staff records with roles, contact info, and assignments.
* **Academic Structure** — Organize your school year into Academic Sessions, Terms/Units, Classes/Groups, and Subjects.
* **Daily Attendance Tracking** — Mark student daily attendance (Present, Absent, Late, Excused) with instant daily summary reports.
* **Multi-Country Presets** — One-click configuration for India (CBSE/ICSE), United States, and United Kingdom presets (terms, date formats, currencies, and identifiers).
* **Student & Guardian Self-Service Portal** — Dedicated frontend portal (`[codeclove_portal]`) allowing authenticated students and parents to view attendance logs, academic schedules, and fee invoices.
* **Modern Single-Page Dashboard** — Clean, responsive React administrative interface designed for speed and clarity.
* **Privacy & GDPR Compliant** — All scripts and stylesheets are hosted 100% locally. Zero external fonts (no Google Fonts tracking) and zero third-party telemetry.

This plugin adheres strictly to WordPress security and coding standards:
* Custom `$wpdb` database tables prefixed with your WordPress installation table prefix.
* Full REST API security with permission callbacks (`permission_callback`) and nonce authentication.
* Role-based access control protecting all student and academic data.

= Need Advanced ERP Capabilities? Upgrade to Pro =

Take your institution to the next level with [School Management Pro](https://codeclove.com/):

* **Financial Analytics & Revenue Charts** — Real-time fee collection graphs, revenue forecasting, and payment mode breakdowns.
* **Defaulters Report & Overdue Tracking** — Automated tracking of overdue invoices and uncollected dues.
* **Online Payment Gateways & UPI** — Direct checkout support for Stripe, PayPal, Razorpay, and Indian UPI.
* **Weekly Timetable Matrix & Substitutions** — Conflict-free timetable builder with automatic teacher substitution assignment.
* **Automated SMS Notifications** — Integrated alerts via Twilio, Vonage, Fast2SMS, and MSG91.
* **Digital Noticeboard & Announcements** — Publish school-wide or targeted circulars and notices.
* **Batch Student Promotion Engine** — One-click end-of-year batch promotion between academic sessions.
* **Granular Role Permission Matrix** — Fine-grained capability control across teachers, accountants, and staff members.
* **Priority Email & Ticket Support** — Dedicated technical assistance and onboarding help.

== Installation ==

1. Upload the `codeclove-school-management` folder to your `/wp-content/plugins/` directory (or install via *Plugins → Add New* in WordPress).
2. Activate the plugin through the **Plugins** menu in WordPress.
3. Navigate to **School Management** in your WordPress admin sidebar.
4. Run the initial setup wizard to select your country preset (India, US, or UK) and configure your academic sessions.

== Frequently Asked Questions ==

= Is the free version limited in student or staff numbers? =
No. The free version allows unlimited students, guardians, classes, and staff members. There are no artificial quotas, trial periods, or disabled features.

= Does the plugin make external network calls or track usage? =
No. This plugin does not load remote fonts from Google Fonts or external CDNs, does not track usage data, and makes zero background network requests. All assets are self-hosted locally.

= Can I upgrade to School Management Pro without losing my existing data? =
Yes. When you install and activate School Management Pro, it seamlessly utilizes your existing database tables and settings. All student records, attendance logs, and academic structures are fully preserved.

== Screenshots ==

1. Dashboard overview — Key operational metrics, attendance summaries, and recent activity.
2. Student directory — Manage student profiles, parent details, and academic enrollments.
3. Daily attendance register — Fast, one-click attendance marking for classes and groups.
4. Academic management — Setup sessions, classes, units, and subjects with localized presets.
5. Invoicing and fee types — Define school fees, issue invoices, and record offline payments.

== Source Code ==

The compiled JavaScript bundles in `assets/build/` are generated from TypeScript/React source files.

The complete, human-readable source code is publicly available at:
https://github.com/Codeclove/codeclove-school-management

To regenerate the compiled assets from source:

1. Requires Node.js 20+ and npm 10+.
2. Navigate to admin directory and install dependencies: `cd admin && npm install`
3. Build for production: `npm run build`
   Vite outputs minified bundles to `assets/build/admin/` and `assets/build/portal/`.

Third-party libraries bundled in the compiled output:

* React 18 — MIT License — https://github.com/facebook/react
* React Router 6 — MIT License — https://github.com/remix-run/react-router
* Tailwind CSS — MIT License — https://github.com/tailwindlabs/tailwindcss
* shadcn/ui components — MIT License — https://github.com/shadcn-ui/ui
* Lucide React icons — ISC License — https://github.com/lucide-icons/lucide

All bundled third-party libraries are open-source and GPL-compatible.

== Changelog ==

= 1.0.1 =
* Fix: Adopt native %i identifier placeholders for all database table references in prepared SQL queries (WordPress 6.1+ compliance).
* Fix: Controller-boundary input sanitization across REST API query parameters.
* Fix: Remove deprecated print_emoji_styles handler before rendering standalone SPA shell.
* Fix: Guard pro-only timetable queries in attendance and portal services for clean free-tier activation.

= 1.0.0 =
* Initial public release on WordPress.org.
* Core academic structure (Sessions, Units, Groups, Subjects).
* Student directory and guardian profile management.
* Staff and faculty directory with native role assignments.
* Daily student attendance marking and daily reports.
* Country presets for India, United States, and United Kingdom.
* Localized typography and zero-telemetry architecture.

== Upgrade Notice ==

= 1.0.1 =
Review revision: SQL query placeholders, input sanitization, and compatibility fixes.

= 1.0.0 =
Initial release of CodeClove School Management System.
