# Master Requirements and Technical Specification
# Omran Mall — Integrated Employee and Operations Management Platform

**Project name:** Omran Mall Management System  
**Project type:** Enterprise platform for human resources, employee management, and daily branch operations.  
**Platforms:** Android, iOS, Web, central executive administration, branch-manager and supervisor interfaces.  
**Client technology:** Flutter / Dart, Riverpod, GoRouter.  
**Backend:** NestJS / TypeScript.  
**Database:** PostgreSQL; Redis where appropriate.  
**Primary language:** Arabic with full RTL support; English language support is also required.  
**Currency:** Jordanian dinar (JOD).  
**Time zone:** Asia/Amman.

> This document is the authoritative functional scope and technical requirements reference for the Omran Mall project. No requirement may be removed or materially changed without the project owner's approval. Keep this document in the repository and consult it during planning, implementation, testing, and handover.

---

## 1. Vision and Objectives

Build one integrated platform to manage the full employee lifecycle, from creating an employee record through separation. This is not merely an attendance application. It includes:

1. Employee and personnel records.
2. Attendance and departure.
3. Shifts and schedules.
4. Breaks, lunch, and smoking breaks.
5. Short leave and permission requests.
6. Leave and holidays.
7. Lateness, absence, and violations.
8. Payroll, entitlements, and deductions.
9. Daily tasks and instructions.
10. Announcements and internal communication.
11. Real-time notifications and alerts.
12. Performance and productivity evaluation.
13. Documents, contracts, and records.
14. Training and development.
15. Employee self-service and requests.
16. Branches, departments, and positions.
17. Reports and analytics.
18. Permissions, monitoring, and audit.
19. Archiving and employment history.
20. Assets, custody items, and equipment.

### Mandatory principles

- Deliver a real operational product, not a demo or a collection of mock screens.
- Support multiple branches from day one, even if the initial rollout uses one branch.
- Enforce branch data isolation and permissions on the server and database, not only in the UI.
- Maintain auditable records for every important operation.
- Support phones, tablets, and browsers.
- Keep employee workflows simple and management dashboards comprehensive.
- Support offline work only within safe, explicitly defined limits.
- Never lose data during app updates or server restarts.
- Provide live updates without requiring manual page refresh.
- Prioritize data security, attendance accuracy, and record integrity.

## 2. Technical and Engineering Architecture

### Applications
- Flutter for Android.
- Flutter for iOS.
- Flutter Web.
- Share code where practical while respecting platform-specific behavior.
- A website wrapped in a mobile shell must not be represented as a native Flutter application.

### Proposed backend architecture
- Flutter / Dart for client applications.
- Riverpod for state management.
- GoRouter for navigation and routing.
- NestJS / TypeScript for backend services and APIs.
- PostgreSQL as the primary database.
- Redis for caching, queues, and real-time workloads where needed.
- WebSocket for live updates.
- Firebase Cloud Messaging (FCM) for supported Android and web push notifications.
- Apple Push Notification service (APNs) for iOS.
- S3-compatible storage for images, documents, and attachments.
- Docker for consistent environments.
- OpenAPI for API documentation.
- CI/CD for controlled testing and deployment.
- Render or an equivalent reliable hosting platform.

### Logical components
1. Employee application.
2. Supervisor dashboard.
3. Branch manager dashboard.
4. HR dashboard.
5. Executive management dashboard.
6. Super Admin dashboard.
7. Backend API.
8. Database.
9. Notification service.
10. File and attachment service.
11. Reporting and analytics service.

Permissions must be enforced on the server and, where appropriate, at the database level. Hiding buttons in the UI is not sufficient.

## 3. Organization and Branch Structure

### Company hierarchy
Company → Branches → Departments → Operational units → Positions/job titles → Managers, supervisors, and employees.

### Branch data
Each branch has a name, code, address, contact details, responsible manager, departments, employees, work schedules, break policies, working hours, attendance and holiday settings, and branch-specific reports.

### Branch isolation
- A branch manager and their supervisors must not view or modify other branches' data.
- Executive management may access company-wide, multi-branch data only according to explicit permissions.
- Isolation must be enforced in backend services, queries, and database design.

### Employee transfers
Record the former and new branch, transfer date, reason, and approvals. Preserve employment and attendance history. Update access scopes without moving or deleting historical records.

## 4. Users, Roles, and Permissions

### Core roles
Employee, reception/customer service, cashier, cashier supervisor, department supervisor, shift supervisor, personnel officer, HR officer, branch manager, assistant manager, operations manager, area manager, finance manager, general manager, and Super Admin. Custom roles must also be supported.

### Permission actions
View, create, update, delete or archive, approve, reject, export, print, and manage settings.

### Permission scope
Operational unit, branch, department, request type, action type, and data sensitivity level.

A user may hold multiple roles and responsibilities. Explicit rules must prevent conflicting permissions and unauthorized privilege escalation.

## 5. Complete Employee Record

### Personal information
Photo, full name, employee number, national ID only when necessary and under restricted permissions, date of birth, gender only when necessary, nationality, phone, email, address, emergency contact, and marital status only if administratively required. Sensitive information must be visible only to authorized users.

### Employment information
Employee number, job title, department, branch, direct manager, hire date, contract type, employment status, base salary, work system/hours/days, shifts, probation period, contract end date, promotions, and latest employment change.

### Employment statuses
Active, on leave, on break, out on permission, absent, late, temporarily suspended, transferred, resigned, terminated, and archived.

### Documents
Upload identity documents, contracts, certificates, qualifications, employment documents, warnings, decisions, leave documents, and permitted financial documents. Store issue/expiry dates and support advance reminders.

### Employment history
Maintain a timeline of hiring, transfers, promotions, salary and title changes, leave, violations, rewards, training, evaluations, and decisions. Updating current information must not erase history.

### Photos and profile
Allow authorized photo upload from phone or computer, preview, crop, adjust, and replace. Display photos in lists and profiles; never expose them publicly outside the system.

### Employee self-service portal
Employees can view permitted information and request updates to selected details subject to management approval. They can view their employment details, manager, branch, department, schedule, attendance, leave balances, requests, permitted entitlements, evaluations, alerts, documents, assigned assets, and tasks.

## 6. Attendance and Departure

### Registration methods
- Mobile application.
- Branch-specific QR code.
- Location verification within an approved branch geofence.
- Future integration with attendance devices through an API.
- Authorized manual registration with a documented reason.

Server time is authoritative; the phone clock is not.

### Settings
Shift start/end, grace periods, lateness, early departure, rotating/night/part-time shifts, overtime, rest days, holidays, and flexible working hours.

### Daily record
Actual check-in/out times, shift, working hours, lateness, early departure, breaks, permissions, overtime, daily status, and notes.

### Statuses
Present, late, absent, on leave, holiday, on permission, incomplete shift, requires review, and overtime.

### Attendance corrections
An employee correction request must identify the original time (if available), proposed time, reason, requester, approver, approval time, and change. Never silently delete or overwrite historical records.

### Anti-tampering and offline behavior
Verify identity and branch when location is used; record operation source and device where appropriate; prevent duplicates; detect unusual patterns; and audit changes. Do not perform continuous location tracking without necessity, a disclosed policy, and appropriate legal approval. Attendance not yet confirmed by the server must remain clearly pending until verified.

## 7. Shifts and Scheduling

Shift types: morning, evening, night, flexible, part-time, temporary, and seasonal.

Schedules may be daily, weekly, monthly, or specific to an employee, department, or branch.

Features include start/end times, working and rest days, assigning multiple employees, copying previous schedules, bulk editing, conflict detection, employee notifications, shift-swap requests, and manager approval.

Show staffing shortages by department and shift and suggest suitable coverage without automatically approving changes.

## 8. Breaks, Lunch, and Smoking Breaks

### Types
Regular break, lunch, coffee, smoking break, emergency break, special break, and manager-defined types.

### Configurable type settings
Duration, daily limit, number of occurrences, cooldown interval, permitted times, excluded departments/employees, approval requirement, start/cancel/extension rules, deduction from working hours, and whether the break counts as working time.

### Request workflow
Employee selects a type and submits a request; supervisor is notified; request is approved or rejected; timer starts upon approval; remaining time is displayed; reminders are sent before and at expiry; and actual return is recorded.

### Live dashboard
Show employees currently on break, break type, start time, remaining time, expected return, pending/rejected/overdue requests, and number of employees away from each department.

### Conflict prevention
Set maximum simultaneous absences per department, protect cashier and other critical-role coverage, define blackout periods, and prevent breaks when adequate coverage is unavailable.

### Administrative control
Authorized managers can change durations, intervals, permitted times, limits, types, controls, approval rules, reminders, timers, and lateness policies. Changes take effect from a defined effective date and must not rewrite historical records.

## 9. Short Leave and Permission Requests

Types include personal errands, external work assignment, medical appointment, emergency, short permission, unpaid time, and custom types.

Workflow: select type, time, reason, and attachment if required; submit; notify the responsible approver; approve/reject; record actual exit and return; calculate duration and attendance impact.

The live dashboard shows employees outside the branch, reason, exit time, expected return, overdue status, requests, and history.

## 10. Leave and Holidays

Types include annual, sick, emergency, unpaid, maternity/paternity as applicable, special, official, compensatory, and custom leave.

Features include balances, accrual, usage, carry-over, start/end dates, day counts, holiday calculation according to policy, attachments, approvals, cancellation, amendment, and balance statements.

Provide branch/department/month calendars with conflict and staffing-coverage warnings. Policies must be configurable according to Jordanian labor law and company policy; legal rules must not be hard-coded as immutable assumptions.

## 11. Payroll, Entitlements, and Advances

### Payroll components
Base salary, allowances, rewards, overtime, deductions, advances, loans, withholdings, adjustments, and net salary.

### Functions
Prepare payroll, connect working hours to calculations, review lateness/absence/overtime according to approved policy, review and approve payroll, close periods, generate payslips, export reports, and retain a change history.

### Advances
Request amount, approval, repayment plan, installments, remaining balance, and advance statement.

### Controls
Restrict payroll data to authorized roles. Do not apply automatic deductions without an approved policy and human review where required. Maintain auditability and require payroll review before approval. This module complements rather than replaces an approved accounting system.

## 12. Tasks and Daily Instructions

Task types: daily, weekly, urgent, department-level, employee-specific, group, and shift-related.

Task fields: title, description, owner, branch, department, start, due date, priority, attachments, status, comments, completion evidence, and closure date.

Statuses: new, acknowledged, in progress, paused, completed, overdue, and cancelled.

The manager dashboard shows open, overdue, completed, assigned, completion-rate, and urgent tasks.

## 13. Announcements and Internal Communication

Message types: general announcement, instruction, branch circular, urgent notice, department notice, employee-specific notice, and management notice.

Support text, images, files, PDFs, links, publication/expiry dates, recipients, read confirmation, reader lists, and pinning important notices.

Messaging supports individual and administrative conversations, files, notifications, history, and issue reporting. Prefer one simple inbox experience; do not create many channels without a real need. Apply clear permissions and retention policies.

## 14. Real-Time Notifications and Alerts

Notifications should reach users while the application is in the background or closed, subject to platform capabilities, device settings, and user permissions.

### Notification types
Request approval/rejection, supervisor break requests, break-ending reminders and expiry, shift start and lateness, shift changes, new announcements and tasks, task due reminders, leave/permission decisions, administrative alerts, document expiry, and attendance corrections.

### Requirements
Real push delivery, sound and vibration subject to device settings, badges, deep links to the relevant screen, delivery status where available, duplicate prevention, notification history, preferences, configurable sounds for important categories, and retry handling after delivery failures.

### Platforms and testing
Android through FCM, iOS through APNs, and Web Push on supported browsers. Test on real devices. Sound cannot be guaranteed when the device is silent or its settings block it. Clearly explain and manage notification permissions.

## 15. Employee Home and Profile

The home screen displays photo, name, employee number, job title, branch, department, attendance status, shift, appropriate check-in/out action, break/permission/leave/correction actions, tasks, announcements, notifications, daily summary, remaining time, and current break.

The profile displays permitted personal and employment details, schedule, attendance, breaks, permissions, leave balance, requests, authorized documents, payslip when authorized, evaluations, tasks, alerts, and account settings.

Primary actions must be large, clear, and require few steps.

## 16. Self-Service and Request Center

Supported services include leave, permission, break, smoking break subject to policy, salary advance, salary certificate, employment letter, personal-data update, attendance correction, shift swap, rest day, overtime, complaint, suggestion, equipment/uniform request, issue report, HR appointment, training, grievance, and employment documents.

Provide one request center showing new, under review, approved, rejected, cancelled, and needs-more-information requests, including rejection reasons and comments.

## 17. Performance and Evaluation

Criteria may include punctuality, work quality, task completion, following instructions, customer service, teamwork, productivity, discipline, initiative, and development.

Evaluation cycles may be operational/as-needed, monthly, quarterly, annual, and probationary.

Provide configurable forms, clear scoring, manager and employee comments, approval, history, improvement plans, and goals. Do not use arbitrary automated evaluations or treat lateness/breaks alone as a measure of competence.

## 18. Violations and Rewards

Potential violations include lateness, absence, early departure, excessive break time, incomplete tasks, failure to follow instructions, safety breaches, and other company-defined cases.

Record type, description, date, employee, branch, reporter, evidence, employee response, management decision, and status.

Rewards include performance recognition, achievement, appreciation, promotion nomination, certificate of recognition, and approved financial reward.

Disciplinary actions and rewards require formal records and approvals and must comply with applicable law.

## 19. Assets, Custody, and Equipment

Manage uniforms, ID cards, keys, devices, phones, equipment, tools, financial custody, and other assigned items.

Each asset record includes asset number, type, description, serial number, issue date, recipient, condition, return date, return condition, notes, image/document, and issuing officer. Provide electronic handover and return forms.

## 20. Training and Development

Manage courses, schedules, attendance, results, certificates, skills, development plans, learning materials, tests, and each employee's training history. Training may be linked to promotion and evaluation.

## 21. Safety and Emergencies

Record incidents, injuries, hazards, safety procedures, emergency contacts, evacuation plans, drills, attachments, and corrective actions. Employees must be able to submit urgent reports to designated responsible personnel.

## 22. Recruitment and Offboarding

### Recruitment
Staffing request, job posting, applicants and CVs, interviews and evaluations, hiring decision, employee-record creation from accepted-candidate data, and branch/department assignment.

### Offboarding
Resignation or contract termination, final working day, settlement of entitlements, return of assigned assets, permission revocation, file archiving, and record retention. Do not delete employee data or history.

## 23. Branch Manager Dashboard

Provide an at-a-glance view without requiring clicks: total employees, present, absent, late, on break/lunch/permission, pending requests, overdue tasks, leave, and cases requiring intervention.

Include a live operational view of employee names, photos, departments, statuses, and latest actions.

Quick actions: add/edit employee, manual attendance and correction, break, approval, announcement, task, schedule, report, and break/shift settings.

Provide one request center filterable by type, employee, department, branch, date, and status. Every decision must be recorded.

## 24. Executive Management Dashboard

A separate dashboard shows company-wide and branch-level employee counts, attendance, absence, lateness, performance indicators, payroll cost, leave, turnover, vacancies, comparisons, manager performance, reports, alerts, and operational risks. Navigation from company to branch to department to employee must respect permissions.

## 25. Reports and Analytics

### Attendance reports
Daily, weekly, monthly, lateness, absence, early departure, hours, overtime, and corrections.

### Break and permission reports
Counts, durations, exceptions, averages by department/employee, and permissions.

### HR reports
Headcount, hiring, offboarding, transfers, leave, evaluations, training, violations, and rewards.

### Financial reports
Payroll, allowances, deductions, advances, overtime, and entitlements.

### Reporting features
Filters, date ranges, branch/department comparisons, Excel and PDF export, printing, saved reports, and scheduled delivery for authorized users.

## 26. System Administration and Settings

Configure company name, logo, colors, language, time zone, currency, policies, and notifications.

Configure working hours, shifts, grace periods, lateness, early departure, overtime, and rest days.

Configure break types, durations, intervals, permitted times, limits, restrictions, approvals, timers, and alert sounds.

Configure employees, employee-number format and sequence, job titles, departments, branches, statuses, and profile fields.

Configure approval workflows, approvers, levels, delegates, and escalation.

Authorized administrators should be able to add request types, fields, statuses, and alerts without code changes, through a secure and permission-controlled settings model.

## 27. Employee Number

Generate employee numbers automatically, sequentially, and uniquely. Never reuse a former employee's number. Allow an optional company/branch prefix and configurable format. The number is a permanent identifier and must not change when an employee transfers. Use safe database sequences/transactions and constraints to prevent duplicates under concurrent creation.

## 28. Search and Archiving

Search by name, number, phone, department, branch, request, document, task, violation, and leave. Provide advanced filters and enforce permissions on search results. Support controlled archiving and restoration; do not perform arbitrary permanent deletion.

## 29. Security and Privacy

### Authentication
Secure login, strong passwords stored using secure password hashing, session management, sign-out from all devices, account recovery, MFA for administrative accounts, and rate limiting for failed login attempts.

### Permissions and files
Enforce permissions on the server, isolate branches, prevent direct public file access, use temporary links for private files, and log access to sensitive data.

### Audit log
Record actor, action, record, previous and new values, timestamp, session/device where appropriate, and reason for change. Protect logs against unauthorized modification or deletion.

### Data protection
HTTPS, encryption for sensitive data, secrets in environment variables or a secrets manager, no API keys embedded in the client app, backups, retention policy, file permissions, API protection, input validation, protection against common attacks, and security updates.

### Initial administrator account
No default administrator with a known password, no publicly exposed setup page, and no open endpoint for creating administrators. Create the first administrator through a protected provisioning process. Rotate secrets if exposure is suspected.

## 30. Offline Operation

Allow safe access to recently cached information, shift schedules, cached personal details, request drafts, and an encrypted local queue for selected attendance operations only if policy approves.

When connectivity returns, synchronize, validate, prevent duplicates, resolve conflicts, display failures, and notify the user. Offline attendance must not become final until confirmed by the server.

## 31. User Experience and Design

Use Omran Mall branding, logo, and approved colors; clear interfaces; readable Arabic typography; full RTL; responsive layouts; light/dark modes; and text scaling.

Employee workflows should be fast and uncomplicated, while manager dashboards may be information-rich according to role.

Accessibility includes screen-reader support, sufficient contrast, appropriately sized controls, understandable messages, and never relying on color alone.

## 32. Data Model and Database

Proposed core entities:

1. Companies
2. Branches
3. Departments
4. Positions
5. Employees
6. EmployeeProfiles
7. EmployeeDocuments
8. EmployeeContracts
9. EmployeeHistory
10. Users
11. Roles
12. Permissions
13. UserRoles
14. Shifts
15. ShiftAssignments
16. AttendanceRecords
17. AttendanceCorrections
18. BreakTypes
19. BreakPolicies
20. BreakRequests
21. BreakSessions
22. LeaveTypes
23. LeaveBalances
24. LeaveRequests
25. DepartureRequests
26. OvertimeRecords
27. PayrollPeriods
28. PayrollRecords
29. Allowances
30. Deductions
31. Loans
32. Tasks
33. TaskAssignments
34. Announcements
35. Messages
36. Notifications
37. NotificationPreferences
38. Evaluations
39. Violations
40. Rewards
41. Assets
42. AssetAssignments
43. TrainingCourses
44. TrainingRecords
45. Incidents
46. ServiceRequests
47. AuditLogs
48. Attachments
49. SystemSettings
50. ApprovalWorkflows

Add appropriate keys, relationships, indexes, and constraints. Every applicable child record must carry a branch reference and be covered by branch isolation. Use database transactions for attendance, employee-number generation, payroll approval, and sensitive operations.

## 33. Future Integrations

Attendance devices, payroll, accounting, email, WhatsApp Business API, point of sale, inventory, HR systems, QR/NFC, BI, and electronic signatures. Integrations must use documented and secure interfaces; do not directly connect external systems to the database.

## 34. Testing and Quality Assurance

### Functional testing
Employee accounts, login, attendance, shifts, breaks, lunch, smoking breaks, permissions, leave, approvals, tasks, payroll, reports, and permissions.

### Authorization testing
- Employees cannot view sensitive information belonging to other employees.
- Supervisors cannot access other branches.
- Branch managers cannot modify another branch.
- Finance managers cannot alter attendance without permission.
- Super Admin actions remain within documented controls.
- API calls cannot bypass authorization.

### Notification testing
Test on real Android and iPhone devices with the app foregrounded, backgrounded, closed, and the device locked; with weak/lost connectivity and after reconnection; after permission changes and under battery-saving modes.

### Performance and recovery
Test high employee counts, concurrent attendance, simultaneous requests, large reports, images, and bulk notifications. Test database and attachment restoration, backups, server failure, and version migrations without data loss.

## 35. Deployment and Handover

### Deliverables
Complete source code, Git repository, Android/iOS/Web applications, backend, database, migrations, environment templates, Dockerfiles, CI/CD, OpenAPI documentation, and operating, deployment, administration, and employee guides.

### Ownership
All accounts and services must be owned or controlled by Omran Mall: GitHub, Render, database, Firebase, Apple Developer, Google Play Console, storage, domain, and service credentials. The project must not depend on a developer's personal account.

### Environments
Separate development, testing, and production configurations; controlled deployment; rollback capability; error/performance monitoring; and service-outage alerts.

### Quality evidence
Provide actual test reports for each function, not merely a statement that the system works.

## 36. Implementation Phases

1. **Foundation:** database, multi-branch structure, users and permissions, employee profile, authentication, core interfaces, and administration dashboard.
2. **Daily operations:** attendance, shifts, breaks/lunch/smoking, permissions, leave, and timers.
3. **Services and communication:** push notifications, requests, approvals, announcements, messages, and tasks.
4. **Human resources:** payroll, advances, documents, evaluations, violations, rewards, training, and assets.
5. **Management and analytics:** executive dashboard, reports, comparisons, analytics, exports, and archiving.
6. **Testing and release:** functional, authorization, notification, performance, and backup tests; platform releases; user training; and documentation handover.

Phases 1 and 2 may initially be piloted in one branch, provided the architecture supports multiple branches from day one.

## 37. Project Acceptance Criteria

The project is not complete until all of the following are verified:

1. All three application platforms work in real use.
2. Employees can sign in and use their profiles.
3. Managers can manage only employees within their authorized scope.
4. Attendance and departure are accurate.
5. Breaks and permissions follow configured policies.
6. Timers and alerts work without manual refresh.
7. Push notifications arrive when the app is closed, subject to platform conditions.
8. Requests follow a clear approval workflow.
9. Branch isolation is complete.
10. Employee numbers are sequential and unique.
11. Historical records are preserved.
12. Reports are correct and exportable.
13. Permissions are enforced by the backend.
14. Backup and restore have been tested.
15. No secrets are present in source code.
16. No public setup pages are exposed.
17. No decorative buttons or non-functional features remain.
18. Main workflows have been tested.
19. Accounts and repositories are under company ownership.
20. Operating, maintenance, and handover documentation is complete.

## 38. Mandatory Developer Instructions

1. Do not build only screens or claim completion prematurely.
2. Begin with requirements analysis, data model, and architecture.
3. Present the data model, permissions, and workflows for review before full implementation.
4. Do not use fake data in production.
5. No decorative/non-functional buttons.
6. Do not use local storage or SQLite as the central database.
7. Use a reliable central database.
8. Do not enforce permissions only in the client application.
9. Never change historical records without an audit log.
10. Do not delete employee data upon termination.
11. Managers must not need code changes to update policies.
12. Make administrative settings configurable.
13. Do not rely on manual page refresh.
14. Implement real push notifications.
15. Test workflows on real devices.
16. Do not deploy to production before testing.
17. Never expose secrets in GitHub or the application.
18. No default administrator account and no open initial setup.
19. Document services and integrations.
20. Do not consider the project complete until source code, data, documents, accounts, and real operation are handed over.

## 39. Future Intelligent Enhancements

An AI assistant for management within its permissions; an employee policy assistant; shift-shortage forecasting; schedule-conflict detection; staffing suggestions; lateness and absence analysis; contract/document expiry alerts; employee-satisfaction indicators; surveys; suggestions; rewards; e-learning; events; uniform and supplies requests; confidential complaints; and financial/operational integrations.

AI must not make disciplinary, financial, or other sensitive employment decisions without review by an authorized human.

## 40. Required Final Outcome

One unified platform for all Omran Mall operations:

- Employees can view their profile, photo, schedule, attendance, requests, breaks, leave, tasks, notifications, and self-service features.
- Supervisors can view their teams, requests, and live statuses.
- Branch managers can manage their branch, shifts, breaks, settings, and employees within their permissions.
- Executive management can view the company, branches, reports, and performance indicators.
- System administrators can manage the organization structure, permissions, settings, and integrations.

The goal is a secure, maintainable, scalable enterprise platform ready for real daily operations—not merely an attendance application.

### Required before full implementation
The developer must submit an implementation plan, cost and timeline estimate, architecture design, database design, and list of external dependencies. No requirement in this document may be omitted without the project owner's written approval.

---

## Document Control

- **Arabic source of truth:** `docs/MASTER_REQUIREMENTS_AR.md`
- **English companion:** `docs/MASTER_REQUIREMENTS_EN.md`
- **Status:** Primary functional scope reference; the Arabic document remains the original source and the English document is its companion translation.
- **Change control:** Do not change or remove core requirements without the project owner's approval.
- **Update method:** Add approved changes to a dated change log with the reason, preserving Git history.
- **Relationship to implementation planning:** This document defines *what the system must deliver*. The roadmap and architecture decisions define *how and when it will be built*. Documenting a requirement does not prove that the corresponding feature has been implemented.
