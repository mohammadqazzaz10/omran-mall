import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/auth_controller.dart';
import '../../features/auth/auth_repository.dart';
import '../../l10n/app_localizations.dart';

class SessionManagementScreen extends ConsumerStatefulWidget {
  const SessionManagementScreen({super.key});

  @override
  ConsumerState<SessionManagementScreen> createState() =>
      _SessionManagementScreenState();
}

class _SessionManagementScreenState
    extends ConsumerState<SessionManagementScreen> {
  late Future<List<Map<String, dynamic>>> _sessions;

  @override
  void initState() {
    super.initState();
    _sessions = ref.read(authRepositoryProvider).sessions();
  }

  void _reload() {
    setState(() {
      _sessions = ref.read(authRepositoryProvider).sessions();
    });
  }

  Future<void> _revoke(String id) async {
    await ref.read(authRepositoryProvider).revokeSession(id);
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(strings.sessionsTitle)),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _sessions,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: OutlinedButton(
                onPressed: _reload,
                child: Text(strings.retryButton),
              ),
            );
          }
          final items = snapshot.data ?? const [];
          if (items.isEmpty) {
            return Center(child: Text(strings.sessionsTitle));
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final session = items[index];
                final isCurrent = session['is_current'] == true;
                final device = session['device_name']?.toString();
                final userAgent = session['user_agent']?.toString();
                final title = (device != null && device.isNotEmpty)
                    ? device
                    : (userAgent != null && userAgent.isNotEmpty
                        ? userAgent
                        : 'Device session');
                return Card(
                  child: ListTile(
                    leading: Icon(
                      isCurrent ? Icons.phone_android : Icons.devices,
                    ),
                    title: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis),
                    subtitle: Text(
                      (isCurrent ? strings.currentSessionLabel : '') +
                          (session['ip_address'] == null
                              ? ''
                              : ' • ' + session['ip_address'].toString()),
                    ),
                    trailing: isCurrent
                        ? const Icon(Icons.verified_user_outlined)
                        : IconButton(
                            tooltip: strings.revokeSessionButton,
                            onPressed: () => _revoke(session['id'].toString()),
                            icon: const Icon(Icons.logout),
                          ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
