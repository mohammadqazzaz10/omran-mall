import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/login',
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('تسجيل الدخول - عمران مول')),
        ),
      ),
      GoRoute(
        path: '/employee',
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('لوحة الموظف الرئيسية والخدمات الذاتية')),
        ),
      ),
      GoRoute(
        path: '/supervisor',
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('لوحة المشرف المباشرة والمؤقتات الحية')),
        ),
      ),
      GoRoute(
        path: '/branch-manager',
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('لوحة تحكم مدير الفرع وإدارة الورديات والاستراحات')),
        ),
      ),
      GoRoute(
        path: '/hr',
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('لوحة الموارد البشرية ومسير الرواتب')),
        ),
      ),
      GoRoute(
        path: '/executive',
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('لوحة الإدارة العليا وتحليلات الفروع')),
        ),
      ),
      GoRoute(
        path: '/admin',
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('لوحة مدير النظام الأعلى Super Admin')),
        ),
      ),
    ],
  );
});
