import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/admin/admin_home_screen.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/auth/change_password_screen.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/role_landing_screen.dart';
import '../../features/auth/session_management_screen.dart';
import '../../features/employee/employee_home_screen.dart';
import '../../features/employee/employee_records_screen.dart';
import '../../features/breaks/breaks_home_screen.dart';
import '../../features/breaks/breaks_management_screen.dart';
import '../../features/attendance/attendance_screen.dart';
import '../../features/attendance/attendance_qr_display_screen.dart';
import '../../features/attendance/attendance_qr_scanner_screen.dart';
import '../../features/attendance/attendance_dashboard_screen.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../l10n/app_localizations.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  String homeFor(AuthState auth) {
    final roles = (auth.user?['roles'] as List? ?? const [])
        .whereType<Map>()
        .map((role) => role['code']?.toString() ?? '')
        .toSet();
    if (roles.contains('SUPER_ADMIN')) return '/admin';
    if (roles.contains('GENERAL_MANAGER')) return '/executive';
    if (roles.contains('HR_MANAGER')) return '/hr';
    if (roles.contains('BRANCH_MANAGER')) return '/branch-manager';
    if (roles.contains('SUPERVISOR')) return '/supervisor';
    return '/employee';
  }

  bool hasRole(AuthState auth, String roleCode) {
    final roles = (auth.user?['roles'] as List? ?? const [])
        .whereType<Map>()
        .map((role) => role['code']?.toString() ?? '')
        .toSet();
    return roles.contains(roleCode);
  }

  final router = GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final path = state.uri.path;

      if (auth.isLoading) return null;
      if (!auth.isAuthenticated) {
        return path == '/login' ? null : '/login';
      }
      if (auth.mustChangePassword) {
        return path == '/change-password' ? null : '/change-password';
      }
      if (path == '/login' || path == '/splash' || path == '/change-password') {
        return homeFor(auth);
      }
      if (path == '/admin' &&
          !hasRole(auth, 'SUPER_ADMIN') &&
          !hasRole(auth, 'GENERAL_MANAGER') &&
          !hasRole(auth, 'HR_MANAGER')) {
        return homeFor(auth);
      }
      if (path == '/executive' && !hasRole(auth, 'GENERAL_MANAGER')) {
        return homeFor(auth);
      }
      if (path == '/hr' && !hasRole(auth, 'HR_MANAGER')) {
        return homeFor(auth);
      }
      if (path == '/employee-records' &&
          !hasRole(auth, 'SUPER_ADMIN') &&
          !hasRole(auth, 'HR_MANAGER')) {
        return homeFor(auth);
      }
      if (path == '/branch-manager' && !hasRole(auth, 'BRANCH_MANAGER')) {
        return homeFor(auth);
      }
      if (path == '/supervisor' && !hasRole(auth, 'SUPERVISOR')) {
        return homeFor(auth);
      }
      if ((path == '/attendance/qr' || path == '/attendance/dashboard') &&
          !hasRole(auth, 'SUPER_ADMIN') &&
          !hasRole(auth, 'GENERAL_MANAGER') &&
          !hasRole(auth, 'HR_MANAGER') &&
          !hasRole(auth, 'HR_OFFICER') &&
          !hasRole(auth, 'PERSONNEL_OFFICER') &&
          !hasRole(auth, 'BRANCH_MANAGER') &&
          !hasRole(auth, 'ASSISTANT_MANAGER') &&
          !hasRole(auth, 'SUPERVISOR')) {
        return homeFor(auth);
      }
      if (path == '/breaks/manage' &&
          !hasRole(auth, 'SUPER_ADMIN') &&
          !hasRole(auth, 'GENERAL_MANAGER') &&
          !hasRole(auth, 'BRANCH_MANAGER') &&
          !hasRole(auth, 'SUPERVISOR')) {
        return homeFor(auth);
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        ),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/change-password',
        builder: (context, state) => const ChangePasswordScreen(),
      ),
      GoRoute(
        path: '/notifications',
        builder: (context, state) => const NotificationsScreen(),
      ),
      GoRoute(
        path: '/attendance',
        builder: (context, state) => const AttendanceScreen(),
      ),
      GoRoute(
        path: '/attendance/scan',
        builder: (context, state) => const AttendanceQrScannerScreen(),
      ),
      GoRoute(
        path: '/attendance/qr',
        builder: (context, state) => const AttendanceQrDisplayScreen(),
      ),
      GoRoute(
        path: '/attendance/dashboard',
        builder: (context, state) => const AttendanceDashboardScreen(),
      ),
      GoRoute(
        path: '/breaks',
        builder: (context, state) => const BreaksHomeScreen(),
      ),
      GoRoute(
        path: '/breaks/manage',
        builder: (context, state) => const BreaksManagementScreen(),
      ),
      GoRoute(
        path: '/employee',
        builder: (context, state) => const EmployeeHomeScreen(),
      ),
      GoRoute(
        path: '/employee-records',
        builder: (context, state) => const EmployeeRecordsScreen(),
      ),
      GoRoute(
        path: '/admin',
        builder: (context, state) => const AdminHomeScreen(),
      ),
      GoRoute(
        path: '/executive',
        builder: (context, state) => const AdminHomeScreen(),
      ),
      GoRoute(
        path: '/hr',
        builder: (context, state) => const AdminHomeScreen(),
      ),
      GoRoute(
        path: '/branch-manager',
        builder: (context, state) => RoleLandingScreen(
          title: AppLocalizations.of(context).branchManagerHome,
        ),
      ),
      GoRoute(
        path: '/supervisor',
        builder: (context, state) => RoleLandingScreen(
          title: AppLocalizations.of(context).supervisorHome,
        ),
      ),
      GoRoute(
        path: '/sessions',
        builder: (context, state) => const SessionManagementScreen(),
      ),
    ],
  );

  ref.listen<AuthState>(authProvider, (previous, next) {
    router.refresh();
  });
  ref.onDispose(router.dispose);
  return router;
});
