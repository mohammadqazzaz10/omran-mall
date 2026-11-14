import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/auth_controller.dart';
import '../../l10n/app_localizations.dart';
import 'package:go_router/go_router.dart';

class RoleLandingScreen extends ConsumerWidget {
  const RoleLandingScreen({
    super.key,
    required this.title,
  });

  final String title;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          IconButton(
            tooltip: strings.logoutButton,
            onPressed: () => ref.read(authProvider.notifier).logout(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Card(
            child: ListTile(
              leading: const Icon(Icons.free_breakfast_outlined),
              title: Text(strings.breakManagementTitle),
              subtitle: Text(strings.pendingBreakRequestsTitle),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/breaks/manage'),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            isArabic(context)
                ? 'تم تسجيل الدخول والتحقق من صلاحيات الحساب.'
                : 'You are signed in and authorized.',
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  bool isArabic(BuildContext context) =>
      Localizations.localeOf(context).languageCode == 'ar';
}
