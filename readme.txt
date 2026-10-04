=== School Management System for WordPress – CodeClove ===
Contributors: codeclove
Tags: school management, student management, attendance, school erp, education management
Donate link: https://codeclove.com/plugins/codeclove-school-management-pro/
Requires at least: 6.5
Tested up to: 7.1.2
Requires PHP: 8.1
Stable tag: 1.0.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

school management for WordPress. Unlimited students, no monthly fees. Admissions, attendance, fees, and parent portal — free.

== Description ==

**CodeClove School Management System** handles student records, staff directories, academic sessions, daily attendance, fee invoicing, and a parent-student self-service portal — all from your WordPress admin. No SaaS fees, no student caps, no data leaving your server.

= Works worldwide — built-in presets for India, US, and UK =

Pick your country during setup and the plugin configures grading conventions, phone formats, currency symbols, academic terms, and date formats automatically. Built-in presets cover India (CBSE/ICSE), United States (K-12), and United Kingdom (Key Stages). Every setting is fully customizable for any other country or curriculum.

= Free features =

* **Unlimited student records.** Student profiles, guardian contacts, enrollment dates. No caps, no paywalls on record counts.
* **Bulk CSV import.** Onboard hundreds of students or staff from a spreadsheet with custom column mapping.
* **Online admissions.** Embed an application form with `[codeclove_admission_form]`. Review applications, then convert an applicant to a student in one click.
* **Fee types and invoicing.** Define fee heads per class, generate invoices, and record offline payments with printable receipts.
* **Staff directory.** Teacher and admin records with roles, contact info, and class assignments.
* **Academic structure.** Sessions, terms, classes, groups, and subjects organized the way your school actually works.
* **Daily attendance.** Mark Present, Absent, Late, or Excused per student. Instant daily summary reports.
* **Student and parent portal.** `[codeclove_portal]` gives students and guardians a frontend view of attendance, schedules, and fee invoices.
* **Printable ID cards.** Dual-side student ID cards generated from profile data.
* **Command palette.** Global search across students, staff, pages, and shortcuts.
* **Dark mode.** Full dark theme for the admin interface.
* **Zero tracking.** No Google Fonts, no external CDNs, no analytics calls. Everything loads from your server.

= Security =

* All database tables use your WordPress table prefix.
* Every REST API endpoint has a `permission_callback` and nonce verification.
* Role-based access control on all student and academic data.

= School Management Pro =

The free plugin covers daily operations. [School Management Pro](https://codeclove.com/plugins/codeclove-school-management-pro/) is **$59/year** and adds:

* **Revenue analytics.** Fee collection graphs, forecasting, and payment mode breakdowns.
* **Defaulter tracking.** Automatic overdue invoice reports.
* **Online payments.** Stripe, PayPal, Razorpay, and Indian UPI checkout.
* **Timetable builder.** Weekly schedule matrix with teacher substitution handling.
* **SMS notifications.** Twilio, Vonage, Fast2SMS, and MSG91 integrations.
* **Noticeboard.** School-wide or targeted announcements and circulars.
* **Batch promotion.** Move students between academic sessions at year-end in one operation.
* **Permission matrix.** Capability control per role across teachers, accountants, and staff.
* **Priority support.** Email and ticket support with onboarding help.

== Installation ==

1. Go to **Plugins → Add New** in your WordPress admin and search for "CodeClove School Management", or upload the zip manually.
2. Activate the plugin.
3. Open **School Management** in your admin sidebar.
4. Run the setup wizard, pick your country preset, and create your first academic session.

== Frequently Asked Questions ==

= Is the free version limited in student or staff numbers? =

No. Unlimited students, guardians, classes, and staff. No quotas, no trial periods, no features disabled behind a paywall.

= Does the plugin make external network calls? =

No. No remote fonts, no CDN assets, no usage tracking, no background requests of any kind. All assets load from your server.

= Can I upgrade to Pro without losing data? =

Yes. Pro uses the same database tables. Install and activate it alongside the free plugin and all your existing records carry over.

= What WordPress and PHP versions does it require? =

WordPress 6.5 or later and PHP 8.1 or later.

= Does it work for coaching institutes, not just schools? =

Yes. The academic structure, sessions, groups, and subjects work for any teaching institution.

= Does it work for Indian schools with CBSE or ICSE curriculum? =

Yes. Select the India preset during setup and the plugin configures INR currency, Indian phone formats, and CBSE/ICSE class naming automatically. The plugin also works for any other country — all terminology, currency, date formats, and academic structure are fully customizable.

= Is there a free version available? =

Yes — this is the free version. Download it directly from WordPress.org. There are no hidden paywalls, no student caps, and no trial period. [School Management Pro](https://codeclove.com/plugins/codeclove-school-management-pro/) is an optional upgrade that adds online payments, timetable builder, SMS notifications, and revenue analytics.

== Screenshots ==

1. Dashboard — attendance summaries, key metrics, and recent activity at a glance.
2. Student directory — profiles, guardian details, and academic enrollments.
3. Daily attendance register — one-click marking with Present, Absent, Late, and Excused statuses.
4. Academic management — sessions, classes, units, and subjects with country presets.
5. Invoicing — define fee types, generate invoices, record offline payments.
6. Student profile and ID card — full academic record with printable dual-side ID card.
7. Roles and permissions — access control matrix for staff and administrators.
8. Command palette — global search for students, pages, shortcuts, and actions.
9. Dark mode — full dark theme for the admin interface.

== Source code ==

The JavaScript bundles in `assets/build/` are compiled from TypeScript and React source files.

Full source: https://github.com/Codeclove/codeclove-school-management

Third-party libraries in the compiled output:

* React 18 — MIT License — https://github.com/facebook/react
* React Router 6 — MIT License — https://github.com/remix-run/react-router
* Tailwind CSS — MIT License — https://github.com/tailwindlabs/tailwindcss
* shadcn/ui components — MIT License — https://github.com/shadcn-ui/ui
* Lucide React icons — ISC License — https://github.com/lucide-icons/lucide

All bundled libraries are open-source and GPL-compatible.

== Changelog ==

= 1.0.4 =
* Tweak: Force tag metadata re-index on WordPress.org.

= 1.0.3 =
* Tweak: Improved readme short description to fit WordPress.org 150-character limit.
* Tweak: Corrected "Tested up to" version to 7.1.2.
* Tweak: Updated plugin tags: replaced learning management and fees management with school erp and education management.
* Tweak: Added Donate link pointing to Pro upgrade page.

= 1.0.2 =
* Fix: Date picker calendar selection and event handling inside modal dialogs.
* Fix: Prevent modal dismissal when interacting with portaled overlays.
* Fix: Prevent text input focus from capturing keyboard typing in date fields.
* Tweak: Add ArrowDown keyboard shortcut to open calendar picker.

= 1.0.1 =
* Fix: Input sanitization at REST API controller boundaries.
* Fix: Remove deprecated print_emoji_styles hook before rendering the SPA shell.
* Fix: timetable queries in attendance and portal services

= 1.0.0 =
* Initial release.
* Academic structure: sessions, units, groups, subjects.
* Student directory with guardian profile management.
* Staff and faculty directory with role assignments.
* Daily student attendance marking and reports.
* Country presets for India, United States, and United Kingdom.
