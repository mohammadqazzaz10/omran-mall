import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/auth_controller.dart';
import '../../l10n/app_localizations.dart';
import '../employee/employee_repository.dart';
import 'breaks_realtime_service.dart';
import 'breaks_repository.dart';

class BreaksHomeScreen extends ConsumerStatefulWidget {
  const BreaksHomeScreen({super.key});

  @override
  ConsumerState<BreaksHomeScreen> createState() => _BreaksHomeScreenState();
}

class _BreaksHomeScreenState extends ConsumerState<BreaksHomeScreen> {
  late Future<_BreakHomeData> _data;
  StreamSubscription<Map<String, dynamic>>? _events;

  @override
  void initState() {
    super.initState();
    _data = _load();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final realtime = ref.read(breaksRealtimeProvider);
      _events = realtime.events.listen((_) {
        if (mounted) _reload();
      });
      unawaited(realtime.connect());
    });
  }

  Future<_BreakHomeData> _load() async {
    final auth = ref.read(authProvider).user ?? {};
    Map<String, dynamic>? profile;
    try {
      profile = await ref.read(employeeRepositoryProvider).getOwnProfile();
    } catch (_) {
      profile = null;
    }
    final branchId = profile?['branch_id']?.toString() ??
        auth['primaryBranchId']?.toString();
    if (branchId == null || branchId.isEmpty) {
      return const _BreakHomeData(branchId: null, types: [], status: {});
    }
    final repository = ref.read(breaksRepositoryProvider);
    final results = await Future.wait([
      repository.listTypes(branchId),
      repository.myStatus(branchId),
    ]);
    return _BreakHomeData(
      branchId: branchId,
      types: results[0] as List<Map<String, dynamic>>,
      status: results[1] as Map<String, dynamic>,
    );
  }

  void _reload() {
    if (!mounted) return;
    setState(() => _data = _load());
  }

  @override
  void dispose() {
    _events?.cancel();
    super.dispose();
  }

  Future<void> _requestBreak(
    String branchId,
    List<Map<String, dynamic>> types,
  ) async {
    final strings = AppLocalizations.of(context);
    final available = types.where((type) => type['is_active'] == true).toList();
    if (available.isEmpty) return;

    String selectedTypeId = available.first['id'].toString();
    int duration =
        (available.first['default_duration_minutes'] as num?)?.toInt() ?? 15;
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) {
          final selected = available.firstWhere(
            (type) => type['id'].toString() == selectedTypeId,
          );
          final maximum =
              (selected['max_duration_minutes'] as num?)?.toInt() ?? 60;
          return AlertDialog(
            title: Text(strings.requestBreakButton),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  value: selectedTypeId,
                  decoration:
                      InputDecoration(labelText: strings.breakOptionsTitle),
                  items: available
                      .map(
                        (type) => DropdownMenuItem<String>(
                          value: type['id'].toString(),
                          child: Text(
                            type['name_ar']?.toString() ??
                                type['name_en']?.toString() ??
                                type['code'].toString(),
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    if (value == null) return;
                    setDialogState(() {
                      selectedTypeId = value;
                      final next = available.firstWhere(
                        (type) => type['id'].toString() == value,
                      );
                      duration =
                          (next['default_duration_minutes'] as num?)
                                  ?.toInt() ??
                              15;
                    });
                  },
                ),
                const SizedBox(height: 16),
                Text(strings.breakDurationMinutes),
                Slider(
                  value: duration.clamp(1, maximum).toDouble(),
                  min: 1,
                  max: maximum.toDouble(),
                  divisions: maximum > 1 ? maximum - 1 : null,
                  label: duration.toString(),
                  onChanged: (value) =>
                      setDialogState(() => duration = value.round()),
                ),
                Text(duration.toString()),
                if (selected['requires_approval'] == true) ...[
                  const SizedBox(height: 8),
                  Text(
                    strings.breakRequestPending,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: Text(strings.cancelButton),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: Text(strings.submitBreakRequest),
              ),
            ],
          );
        },
      ),
    );
    if (result != true || !mounted) return;
    try {
      final response = await ref.read(breaksRepositoryProvider).requestBreak(
            branchId: branchId,
            breakTypeId: selectedTypeId,
            durationMinutes: duration,
          );
      if (!mounted) return;
      final session = response['session'];
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            session == null
                ? strings.breakRequestPending
                : strings.breakRequestApproved,
          ),
        ),
      );
      _reload();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
  }

  Future<void> _endBreak(String branchId, String sessionId) async {
    final strings = AppLocalizations.of(context);
    try {
      await ref.read(breaksRepositoryProvider).endSession(
            branchId: branchId,
            sessionId: sessionId,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(strings.breakEndedMessage)),
      );
      _reload();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(strings.breaksTitle),
        actions: [
          IconButton(
            tooltip: strings.breaksRefresh,
            onPressed: _reload,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: FutureBuilder<_BreakHomeData>(
        future: _data,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(snapshot.error.toString(), textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: _reload,
                      child: Text(strings.retryButton),
                    ),
                  ],
                ),
              ),
            );
          }
          final data = snapshot.data!;
          if (data.branchId == null) {
            return Center(child: Text(strings.branchNotAvailable));
          }
          final active = data.status['activeSession'] is Map
              ? Map<String, dynamic>.from(data.status['activeSession'] as Map)
              : null;
          final requests = (data.status['requests'] as List? ?? const [])
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList();

          return RefreshIndicator(
            onRefresh: () async {
              _reload();
              await _data;
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          strings.activeBreakTitle,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 12),
                        if (active == null)
                          Text(strings.noActiveBreak)
                        else ...[
                          Text(
                            active['break_type_name_ar']?.toString() ?? '',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 8),
                          _BreakCountdown(
                            expectedEnd:
                                active['expected_end_time']?.toString(),
                            label: strings.remainingTimeLabel,
                          ),
                          const SizedBox(height: 12),
                          FilledButton.icon(
                            onPressed: () => _endBreak(
                              data.branchId!,
                              active['id'].toString(),
                            ),
                            icon: const Icon(Icons.stop_circle_outlined),
                            label: Text(strings.endBreakButton),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: active == null
                      ? () => _requestBreak(data.branchId!, data.types)
                      : null,
                  icon: const Icon(Icons.free_breakfast_outlined),
                  label: Text(strings.requestBreakButton),
                ),
                const SizedBox(height: 20),
                Text(
                  strings.breakOptionsTitle,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                if (data.types.where((type) => type['is_active'] == true).isEmpty)
                  Text(strings.noBreakTypes)
                else
                  ...data.types
                      .where((type) => type['is_active'] == true)
                      .map(
                        (type) => Card(
                          child: ListTile(
                            leading: const Icon(Icons.coffee_outlined),
                            title: Text(
                              type['name_ar']?.toString() ??
                                  type['name_en']?.toString() ??
                                  type['code'].toString(),
                            ),
                            subtitle: Text(
                              type['default_duration_minutes'].toString() +
                                  ' / ' +
                                  type['max_duration_minutes'].toString() +
                                  ' ' +
                                  strings.breakDurationMinutes,
                            ),
                            trailing: type['requires_approval'] == true
                                ? const Icon(Icons.verified_user_outlined)
                                : const Icon(Icons.check_circle_outline),
                          ),
                        ),
                      ),
                const SizedBox(height: 20),
                Text(
                  strings.pendingBreakRequestsTitle,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                if (requests.isEmpty)
                  Text(strings.noActiveBreak)
                else
                  ...requests.map(
                    (request) => Card(
                      child: ListTile(
                        title: Text(
                          request['break_type_name_ar']?.toString() ?? '',
                        ),
                        subtitle: Text(
                          request['status']?.toString() == 'pending'
                              ? strings.breakRequestPending
                              : request['status']?.toString() == 'approved'
                                  ? strings.breakRequestApproved
                                  : request['status']?.toString() == 'rejected'
                                      ? strings.breakRequestRejected
                                      : request['status']?.toString() ?? '',
                        ),
                        trailing: Text(
                          request['requested_duration_minutes'].toString() +
                              'm',
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _BreakHomeData {
  const _BreakHomeData({
    required this.branchId,
    required this.types,
    required this.status,
  });

  final String? branchId;
  final List<Map<String, dynamic>> types;
  final Map<String, dynamic> status;
}

class _BreakCountdown extends StatefulWidget {
  const _BreakCountdown({
    required this.expectedEnd,
    required this.label,
  });

  final String? expectedEnd;
  final String label;

  @override
  State<_BreakCountdown> createState() => _BreakCountdownState();
}

class _BreakCountdownState extends State<_BreakCountdown> {
  Timer? _timer;
  int _remainingSeconds = 0;

  @override
  void initState() {
    super.initState();
    _update();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _update());
  }

  void _update() {
    final end = DateTime.tryParse(widget.expectedEnd ?? '')?.toLocal();
    final remaining =
        end == null ? 0 : end.difference(DateTime.now()).inSeconds;
    if (mounted) setState(() => _remainingSeconds = remaining.clamp(0, 86400).toInt());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final minutes = _remainingSeconds ~/ 60;
    final seconds = _remainingSeconds % 60;
    final value = minutes.toString() +
        ':' +
        seconds.toString().padLeft(2, '0');
    return Row(
      children: [
        const Icon(Icons.timer_outlined),
        const SizedBox(width: 8),
        Text(widget.label + ': ' + value),
      ],
    );
  }
}
