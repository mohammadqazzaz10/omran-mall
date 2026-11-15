import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/auth_controller.dart';
import '../../l10n/app_localizations.dart';
import 'employee_repository.dart';

class EmployeeHomeScreen extends ConsumerStatefulWidget {
  const EmployeeHomeScreen({super.key});

  @override
  ConsumerState<EmployeeHomeScreen> createState() => _EmployeeHomeScreenState();
}

class _EmployeeHomeScreenState extends ConsumerState<EmployeeHomeScreen> {
  late Future<Map<String, dynamic>> _profile;

  @override
  void initState() {
    super.initState();
    _profile = ref.read(employeeRepositoryProvider).getOwnProfile();
  }

  void _reload() {
    setState(() {
      _profile = ref.read(employeeRepositoryProvider).getOwnProfile();
    });
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(strings.employeeHome),
        actions: [
          IconButton(
            tooltip: strings.sessionsTitle,
            onPressed: () => context.push('/sessions'),
            icon: const Icon(Icons.devices_outlined),
          ),
          IconButton(
            tooltip: strings.logoutButton,
            onPressed: () => ref.read(authProvider.notifier).logout(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => _reload(),
        child: FutureBuilder<Map<String, dynamic>>(
          future: _profile,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  const Icon(Icons.info_outline, size: 44),
                  const SizedBox(height: 12),
                  Text(strings.noEmployeeProfile, textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: _reload,
                    child: Text(strings.retryButton),
                  ),
                ],
              );
            }
            final profile = snapshot.data ?? <String, dynamic>{};
            final name = [
              profile['first_name_ar'],
              profile['second_name_ar'],
              profile['third_name_ar'],
              profile['last_name_ar'],
            ].where((part) => part != null && part.toString().isNotEmpty).join(' ');
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name.isEmpty ? strings.welcomeTitle : name,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 12),
                        _InfoRow(
                          label: strings.employeeCodeLabel,
                          value: profile['employee_code']?.toString() ?? '—',
                        ),
                        _InfoRow(
                          label: strings.branchLabel,
                          value: profile['branch_name_ar']?.toString() ?? '—',
                        ),
                        _InfoRow(
                          label: strings.departmentLabel,
                          value: profile['department_name_ar']?.toString() ?? '—',
                        ),
                        _InfoRow(
                          label: strings.positionLabel,
                          value: profile['position_title_ar']?.toString() ?? '—',
                        ),
                        _InfoRow(
                          label: strings.mobilePhoneLabel,
                          value: profile['mobile_phone']?.toString() ?? '—',
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.notifications_outlined),
                    title: Text(Localizations.localeOf(context).languageCode == 'ar' ? 'الإشعارات' : 'Notifications'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/notifications'),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.access_time),
                    title: Text(Localizations.localeOf(context).languageCode == 'ar' ? 'الحضور والانصراف' : 'Attendance'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/attendance'),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.free_breakfast_outlined),
                    title: Text(strings.breaksTitle),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/breaks'),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.devices),
                    title: Text(strings.sessionsTitle),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/sessions'),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
