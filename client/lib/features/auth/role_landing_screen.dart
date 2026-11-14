import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/auth_controller.dart';
import '../../l10n/app_localizations.dart';

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
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            isArabic(context)
                ? 'تم تسجيل الدخول والتحقق من صلاحيات الحساب. يجري توصيل وحدات هذا الدور تباعاً.'
                : 'You are signed in and authorized. This role’s operational modules are being connected in the next implementation phase.',
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }

  bool isArabic(BuildContext context) =>
      Localizations.localeOf(context).languageCode == 'ar';
}
