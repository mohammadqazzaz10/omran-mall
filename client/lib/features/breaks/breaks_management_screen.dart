import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/auth_controller.dart';
import '../admin/admin_repository.dart';
import '../../l10n/app_localizations.dart';
import 'breaks_realtime_service.dart';
import 'breaks_repository.dart';

class BreaksManagementScreen extends ConsumerStatefulWidget {
  const BreaksManagementScreen({super.key});

  @override
  ConsumerState<BreaksManagementScreen> createState() =>
      _BreaksManagementScreenState();
}

class _BreaksManagementScreenState
    extends ConsumerState<BreaksManagementScreen> {
  late Future<_BreakManagementData> _data;
  StreamSubscription<Map<String, dynamic>>? _events;
  List<Map<String, dynamic>> _availableBranches = [];
  String? _selectedBranchId;

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

  bool _hasCompanyWideBranchAccess() {
    final user = ref.read(authProvider).user ?? {};
    final roles = (user['roles'] as List? ?? const []).whereType<Map>();
    return roles.any((role) =>
        ['SUPER_ADMIN', 'GENERAL_MANAGER'].contains(role['code']) &&
        role['branchId'] == null &&
        role['departmentId'] == null);
  }

  String? _branchId() {
    if (_hasCompanyWideBranchAccess()) return _selectedBranchId;
    final user = ref.read(authProvider).user ?? {};
    final primary = user['primaryBranchId']?.toString();
    if (primary != null && primary.isNotEmpty) return primary;
    final roles = (user['roles'] as List? ?? const []).whereType<Map>();
    for (final role in roles) {
      final branch = role['branchId']?.toString();
      if (branch != null && branch.isNotEmpty) return branch;
    }
    return null;
  }

  Future<_BreakManagementData> _load() async {
    if (_hasCompanyWideBranchAccess()) {
      _availableBranches =
          await ref.read(adminRepositoryProvider).listBranches();
      if (_selectedBranchId == null ||
          !_availableBranches.any((branch) =>
              branch['id'].toString() == _selectedBranchId)) {
        final user = ref.read(authProvider).user ?? {};
        final primary = user['primaryBranchId']?.toString();
        _selectedBranchId = _availableBranches.any(
          (branch) => branch['id'].toString() == primary,
        )
            ? primary
            : (_availableBranches.isEmpty
                ? null
                : _availableBranches.first['id'].toString());
      }
    }
    final branchId = _branchId();
    if (branchId == null) {
      return const _BreakManagementData(
        branchId: null,
        live: {},
        types: [],
      );
    }
    final repository = ref.read(breaksRepositoryProvider);
    final results = await Future.wait([
      repository.live(branchId),
      repository.listTypes(branchId),
    ]);
    return _BreakManagementData(
      branchId: branchId,
      live: results[0] as Map<String, dynamic>,
      types: results[1] as List<Map<String, dynamic>>,
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

  Future<void> _approve(String branchId, String requestId) async {
    try {
      await ref.read(breaksRepositoryProvider).approveRequest(
            branchId: branchId,
            requestId: requestId,
          );
      _reload();
    } catch (error) {
      _showError(error);
    }
  }

  Future<void> _reject(String branchId, String requestId) async {
    final strings = AppLocalizations.of(context);
    final reason = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(strings.rejectButton),
        content: TextField(
          controller: reason,
          minLines: 2,
          maxLines: 4,
          decoration: InputDecoration(labelText: strings.rejectButton),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(strings.cancelButton),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(strings.rejectButton),
          ),
        ],
      ),
    );
    if (result != true) {
      reason.dispose();
      return;
    }
    try {
      await ref.read(breaksRepositoryProvider).rejectRequest(
            branchId: branchId,
            requestId: requestId,
            reason: reason.text.trim().isEmpty
                ? strings.rejectButton
                : reason.text.trim(),
          );
      _reload();
    } catch (error) {
      _showError(error);
    } finally {
      reason.dispose();
    }
  }

  void _showError(Object error) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(error.toString())),
    );
  }

  Future<void> _editType(
    String branchId, {
    Map<String, dynamic>? existing,
  }) async {
    final strings = AppLocalizations.of(context);
    final code = TextEditingController(
      text: existing?['code']?.toString() ?? '',
    );
    final name = TextEditingController(
      text: existing?['name_ar']?.toString() ?? '',
    );
    final defaultDuration = TextEditingController(
      text: (existing?['default_duration_minutes'] ?? 15).toString(),
    );
    final maximum = TextEditingController(
      text: (existing?['max_duration_minutes'] ?? 30).toString(),
    );
    final quota = TextEditingController(
      text: (existing?['daily_quota_times'] ?? 1).toString(),
    );
    final cooldown = TextEditingController(
      text: (existing?['cooldown_between_breaks_minutes'] ?? 60).toString(),
    );
    final concurrent = TextEditingController(
      text: (existing?['max_simultaneous_per_department'] ?? 1).toString(),
    );
    final notifyBeforeEnd = TextEditingController(
      text: (existing?['notify_before_end_minutes'] ?? 3).toString(),
    );
    final start = TextEditingController(
      text: existing?['allowed_start_time']?.toString().substring(0, 5) ?? '',
    );
    final end = TextEditingController(
      text: existing?['allowed_end_time']?.toString().substring(0, 5) ?? '',
    );
    final blackout = TextEditingController(
      text: _blackoutText(existing?['blackout_periods']),
    );
    bool requiresApproval = existing?['requires_approval'] != false;
    bool deduct = existing?['deduct_from_work_hours'] == true;
    bool earlyReturn = existing?['allow_early_return'] != false;
    bool isActive = existing?['is_active'] != false;

    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(
            existing == null
                ? strings.createBreakTypeButton
                : strings.breakTypesTitle,
          ),
          content: SizedBox(
            width: 480,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _FormField(
                    controller: code,
                    label: strings.breakTypeCodeLabel,
                  ),
                  _FormField(
                    controller: name,
                    label: strings.breakTypeNameLabel,
                  ),
                  _FormField(
                    controller: defaultDuration,
                    label: strings.defaultDurationLabel,
                    numeric: true,
                  ),
                  _FormField(
                    controller: maximum,
                    label: strings.maximumDurationLabel,
                    numeric: true,
                  ),
                  _FormField(
                    controller: quota,
                    label: strings.dailyQuotaLabel,
                    numeric: true,
                  ),
                  _FormField(
                    controller: cooldown,
                    label: strings.cooldownLabel,
                    numeric: true,
                  ),
                  _FormField(
                    controller: concurrent,
                    label: strings.maxConcurrentLabel,
                    numeric: true,
                  ),
                  _FormField(
                    controller: start,
                    label: 'وقت البداية HH:MM',
                  ),
                  _FormField(
                    controller: end,
                    label: 'وقت النهاية HH:MM',
                  ),
                  _FormField(
                    controller: blackout,
                    label: 'فترات المنع HH:MM-HH:MM, ...',
                  ),
                  _FormField(
                    controller: notifyBeforeEnd,
                    label: strings.remainingTimeLabel,
                    numeric: true,
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: requiresApproval,
                    title: Text(strings.requiresApprovalLabel),
                    onChanged: (value) => setDialogState(
                      () => requiresApproval = value ?? false,
                    ),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: deduct,
                    title: Text(strings.deductFromWorkHoursLabel),
                    onChanged: (value) =>
                        setDialogState(() => deduct = value ?? false),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: earlyReturn,
                    title: Text(strings.allowEarlyReturnLabel),
                    onChanged: (value) =>
                        setDialogState(() => earlyReturn = value ?? false),
                  ),
                  if (existing != null)
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: isActive,
                      title: Text(strings.isActiveLabel),
                      onChanged: (value) =>
                          setDialogState(() => isActive = value ?? false),
                    ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: Text(strings.cancelButton),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: Text(strings.saveBreakTypeButton),
            ),
          ],
        ),
      ),
    );

    if (result == true && mounted) {
      final startValue = start.text.trim();
      final endValue = end.text.trim();
      if ((startValue.isEmpty) != (endValue.isEmpty)) {
        _showError(StateError('يجب تحديد بداية ونهاية الوقت المسموح معاً'));
      } else {
        final data = <String, dynamic>{
          'code': code.text.trim(),
          'nameAr': name.text.trim(),
          'defaultDurationMinutes': int.tryParse(defaultDuration.text) ?? 15,
          'maxDurationMinutes': int.tryParse(maximum.text) ?? 30,
          'dailyQuotaTimes': int.tryParse(quota.text) ?? 1,
          'cooldownBetweenBreaksMinutes': int.tryParse(cooldown.text) ?? 60,
          'maxSimultaneousPerDepartment': int.tryParse(concurrent.text) ?? 1,
          'notifyBeforeEndMinutes':
              int.tryParse(notifyBeforeEnd.text) ?? 3,
          'requiresApproval': requiresApproval,
          'deductFromWorkHours': deduct,
          'allowEarlyReturn': earlyReturn,
          'allowedStartTime': startValue.isEmpty ? null : startValue,
          'allowedEndTime': endValue.isEmpty ? null : endValue,
          'blackoutPeriods': _parseBlackouts(blackout.text),
          if (existing != null) 'isActive': isActive,
        };
        try {
          if (existing == null) {
            await ref.read(breaksRepositoryProvider).createType(
                  branchId: branchId,
                  data: data,
                );
          } else {
            await ref.read(breaksRepositoryProvider).updateType(
                  branchId: branchId,
                  typeId: existing['id'].toString(),
                  data: data,
                );
          }
          _reload();
        } catch (error) {
          _showError(error);
        }
      }
    }

    for (final controller in [
      code,
      name,
      defaultDuration,
      maximum,
      quota,
      cooldown,
      concurrent,
      notifyBeforeEnd,
      start,
      end,
      blackout,
    ]) {
      controller.dispose();
    }
  }

  String _blackoutText(dynamic value) {
    if (value is! List) return '';
    return value
        .whereType<Map>()
        .map((item) => item['start'].toString() + '-' + item['end'].toString())
        .join(', ');
  }

  List<Map<String, String>> _parseBlackouts(String value) {
    final result = <Map<String, String>>[];
    for (final part in value.split(',')) {
      final pair = part.trim().split('-');
      if (pair.length != 2) continue;
      final start = pair[0].trim();
      final end = pair[1].trim();
      if (RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(start) &&
          RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(end)) {
        result.add({'start': start, 'end': end});
      }
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(strings.breaksTitle),
          actions: [
            IconButton(
              onPressed: _reload,
              icon: const Icon(Icons.refresh),
            ),
          ],
          bottom: TabBar(
            tabs: [
              Tab(text: strings.liveBreaksTitle),
              Tab(text: strings.breakTypesTitle),
            ],
          ),
        ),
        body: FutureBuilder<_BreakManagementData>(
          future: _data,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return Center(
                child: Text(snapshot.error.toString()),
              );
            }
            final data = snapshot.data!;
            if (data.branchId == null) {
              return Center(child: Text(strings.branchNotAvailable));
            }
            final active = (data.live['activeSessions'] as List? ?? const [])
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item))
                .toList();
            final pending = (data.live['pendingRequests'] as List? ?? const [])
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item))
                .toList();

            return TabBarView(
              children: [
                RefreshIndicator(
                  onRefresh: () async {
                    _reload();
                    await _data;
                  },
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _branchSelector(data.branchId!),
                      Text(
                        strings.pendingBreakRequestsTitle,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      if (pending.isEmpty)
                        Text(strings.noActiveBreak)
                      else
                        ...pending.map(
                          (request) => Card(
                            child: ListTile(
                              title: Text(
                                request['first_name_ar'].toString() +
                                    ' ' +
                                    request['last_name_ar'].toString(),
                              ),
                              subtitle: Text(
                                request['break_type_name_ar'].toString() +
                                    ' — ' +
                                    request['requested_duration_minutes']
                                        .toString() +
                                    'm',
                              ),
                              trailing: Wrap(
                                spacing: 4,
                                children: [
                                  IconButton(
                                    tooltip: strings.approveButton,
                                    onPressed: () => _approve(
                                      data.branchId!,
                                      request['id'].toString(),
                                    ),
                                    icon: const Icon(
                                      Icons.check_circle_outline,
                                    ),
                                  ),
                                  IconButton(
                                    tooltip: strings.rejectButton,
                                    onPressed: () => _reject(
                                      data.branchId!,
                                      request['id'].toString(),
                                    ),
                                    icon: const Icon(Icons.cancel_outlined),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      const SizedBox(height: 20),
                      Text(
                        strings.liveBreaksTitle,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      if (active.isEmpty)
                        Text(strings.noActiveBreak)
                      else
                        ...active.map(
                          (session) => Card(
                            child: ListTile(
                              leading: const Icon(Icons.timer_outlined),
                              title: Text(
                                session['first_name_ar'].toString() +
                                    ' ' +
                                    session['last_name_ar'].toString(),
                              ),
                              subtitle: Text(
                                session['break_type_name_ar'].toString() +
                                    ' — ' +
                                    session['department_name_ar'].toString(),
                              ),
                              trailing: Text(
                                _remaining(session['remaining_seconds']),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    FilledButton.icon(
                      onPressed: () => _editType(data.branchId!),
                      icon: const Icon(Icons.add),
                      label: Text(strings.createBreakTypeButton),
                    ),
                    const SizedBox(height: 12),
                    ...data.types.map(
                      (type) => Card(
                        child: ListTile(
                          title: Text(type['name_ar'].toString()),
                          subtitle: Text(
                            type['default_duration_minutes'].toString() +
                                ' / ' +
                                type['max_duration_minutes'].toString() +
                                ' ' +
                                strings.breakDurationMinutes,
                          ),
                          leading: Icon(
                            type['is_active'] == true
                                ? Icons.check_circle_outline
                                : Icons.pause_circle_outline,
                          ),
                          trailing: IconButton(
                            tooltip: strings.breakTypesTitle,
                            onPressed: () => _editType(
                              data.branchId!,
                              existing: type,
                            ),
                            icon: const Icon(Icons.edit_outlined),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _branchSelector(String branchId) {
    if (_availableBranches.length < 2) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: DropdownButtonFormField<String>(
        value: branchId,
        decoration: InputDecoration(
          labelText: AppLocalizations.of(context).branchesTitle,
          border: const OutlineInputBorder(),
        ),
        items: _availableBranches
            .map((branch) => DropdownMenuItem<String>(
                  value: branch['id'].toString(),
                  child: Text(branch['name_ar']?.toString() ??
                      branch['code'].toString()),
                ))
            .toList(),
        onChanged: (value) {
          if (value == null) return;
          setState(() => _selectedBranchId = value);
          _reload();
        },
      ),
    );
  }

  String _remaining(dynamic seconds) {
    final value = (seconds as num?)?.toInt() ?? 0;
    final minutes = value ~/ 60;
    final rest = value % 60;
    return minutes.toString() + ':' + rest.toString().padLeft(2, '0');
  }
}

class _BreakManagementData {
  const _BreakManagementData({
    required this.branchId,
    required this.live,
    required this.types,
  });

  final String? branchId;
  final Map<String, dynamic> live;
  final List<Map<String, dynamic>> types;
}

class _FormField extends StatelessWidget {
  const _FormField({
    required this.controller,
    required this.label,
    this.numeric = false,
  });

  final TextEditingController controller;
  final String label;
  final bool numeric;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        keyboardType: numeric ? TextInputType.number : TextInputType.text,
        decoration: InputDecoration(labelText: label),
      ),
    );
  }
}
