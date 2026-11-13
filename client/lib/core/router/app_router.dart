import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../l10n/app_localizations.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/login',
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => Scaffold(
          body: Center(child: Text(AppLocalizations.of(context).loginTitle)),
        ),
      ),
      GoRoute(
        path: '/employee',
        builder: (context, state) => Scaffold(
          body: Center(child: Text(AppLocalizations.of(context).employeeHome)),
        ),
      ),
      GoRoute(
        path: '/supervisor',
        builder: (context, state) => Scaffold(
          body: Center(child: Text(AppLocalizations.of(context).supervisorHome)),
        ),
      ),
      GoRoute(
        path: '/branch-manager',
        builder: (context, state) => Scaffold(
          body: Center(child: Text(AppLocalizations.of(context).branchManagerHome)),
        ),
      ),
      GoRoute(
        path: '/hr',
        builder: (context, state) => Scaffold(
          body: Center(child: Text(AppLocalizations.of(context).hrHome)),
        ),
      ),
      GoRoute(
        path: '/executive',
        builder: (context, state) => Scaffold(
          body: Center(child: Text(AppLocalizations.of(context).executiveHome)),
        ),
      ),
      GoRoute(
        path: '/admin',
        builder: (context, state) => Scaffold(
          body: Center(child: Text(AppLocalizations.of(context).adminHome)),
        ),
      ),
    ],
  );
});
