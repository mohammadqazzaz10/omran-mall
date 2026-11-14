import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_controller.dart';
import 'attendance_repository.dart';

class AttendanceScreen extends ConsumerStatefulWidget {
  const AttendanceScreen({super.key});

  @override
  ConsumerState<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends ConsumerState<AttendanceScreen> {
  late Future<List<Map<String, dynamic>>> _records;
  bool _busy = false;

  String? get _branchId {
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

  bool get _canManageQr {
    final roles = (ref.read(authProvider).user?['roles'] as List? ?? const [])
        .whereType<Map>()
        .map((role) => role['code']?.toString() ?? '')
        .toSet();
    return roles.any((role) => {
      'SUPER_ADMIN',
      'GENERAL_MANAGER',
      'HR_MANAGER',
      'BRANCH_MANAGER',
      'SUPERVISOR',
    }.contains(role));
  }

  bool get _isArabic => Localizations.localeOf(context).languageCode == 'ar';
  String _t(String ar, String en) => _isArabic ? ar : en;

  @override
  void initState() {
    super.initState();
    _records = _load();
  }

  Future<List<Map<String, dynamic>>> _load() {
    final branch = _branchId;
    if (branch == null) return Future.value(const []);
    return ref.read(attendanceRepositoryProvider).myRecords(branch);
  }

  void _reload() {
    if (mounted) setState(() => _records = _load());
  }

  Future<void> _record(bool checkIn) async {
    final branch = _branchId;
    if (branch == null || _busy) return;
    setState(() => _busy = true);
    try {
      final repository = ref.read(attendanceRepositoryProvider);
      if (checkIn) {
        await repository.checkIn(branch);
      } else {
        await repository.checkOut(branch);
      }
      _reload();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(checkIn
              ? _t('تم تسجيل حضورك بنجاح', 'Check-in recorded')
              : _t('تم تسجيل انصرافك بنجاح', 'Check-out recorded')),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _date(dynamic value) {
    if (value == null) return '—';
    final parsed = DateTime.tryParse(value.toString());
    if (parsed == null) return value.toString();
    final local = parsed.toLocal();
    return local.year.toString().padLeft(4, '0') + '-' +
        local.month.toString().padLeft(2, '0') + '-' +
        local.day.toString().padLeft(2, '0');
  }

  String _time(dynamic value) {
    if (value == null) return '—';
    final parsed = DateTime.tryParse(value.toString());
    if (parsed == null) return value.toString();
    final local = parsed.toLocal();
    return local.hour.toString().padLeft(2, '0') + ':' +
        local.minute.toString().padLeft(2, '0');
  }

  String _status(String value) {
    switch (value) {
      case 'late':
        return _t('متأخر', 'Late');
      case 'needs_review':
        return _t('بحاجة للمراجعة', 'Needs review');
      case 'absent':
        return _t('غائب', 'Absent');
      case 'on_leave':
        return _t('إجازة', 'On leave');
      case 'holiday':
        return _t('عطلة', 'Holiday');
      default:
        return _t('حاضر', 'Present');
    }
  }

  @override
  Widget build(BuildContext context) {
    final branch = _branchId;
    return Scaffold(
      appBar: AppBar(title: Text(_t('الحضور والانصراف', 'Attendance'))),
      body: branch == null
          ? Center(child: Text(_t('لا يوجد فرع مرتبط بحسابك', 'No branch is linked to your account')))
          : FutureBuilder<List<Map<String, dynamic>>>(
              future: _records,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_t('تعذر تحميل سجل الحضور', 'Could not load attendance')),
                        const SizedBox(height: 8),
                        OutlinedButton(onPressed: _reload, child: Text(_t('إعادة المحاولة', 'Retry'))),
                      ],
                    ),
                  );
                }
                final records = snapshot.data ?? const <Map<String, dynamic>>[];
                final open = records.any((record) =>
                    record['check_in_time'] != null && record['check_out_time'] == null);
                return RefreshIndicator(
                  onRefresh: () async => _reload(),
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                open ? _t('لديك دوام مفتوح حالياً', 'You have an active work session')
                                    : _t('لم تسجل حضوراً مفتوحاً', 'No active work session'),
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: 12),
                              FilledButton.icon(
                                onPressed: _busy || open ? null : () => _record(true),
                                icon: const Icon(Icons.login),
                                label: Text(_t('تسجيل الحضور', 'Check in')),
                              ),
                              const SizedBox(height: 8),
                              OutlinedButton.icon(
                                onPressed: _busy || !open ? null : () => _record(false),
                                icon: const Icon(Icons.logout),
                                label: Text(_t('تسجيل الانصراف', 'Check out')),
                              ),
                              const SizedBox(height: 8),
                              OutlinedButton.icon(
                                onPressed: _busy
                                    ? null
                                    : () async {
                                        final recorded = await context.push<bool>('/attendance/scan');
                                        if (recorded == true) _reload();
                                      },
                                icon: const Icon(Icons.qr_code_scanner),
                                label: Text(_t('مسح رمز QR للحضور', 'Scan attendance QR')),
                              ),
                              if (_canManageQr) ...[
                                const SizedBox(height: 8),
                                OutlinedButton.icon(
                                  onPressed: _busy
                                      ? null
                                      : () => context.push('/attendance/qr'),
                                  icon: const Icon(Icons.qr_code_2),
                                  label: Text(_t('عرض رمز QR للفرع', 'Display branch QR')),
                                ),
                              ],
                              if (_canManageQr) ...[
                                const SizedBox(height: 8),
                                OutlinedButton.icon(
                                  onPressed: _busy
                                      ? null
                                      : () => context.push('/attendance/dashboard'),
                                  icon: const Icon(Icons.monitor_heart_outlined),
                                  label: Text(_t('لوحة متابعة الحضور', 'Attendance dashboard')),
                                ),
                              ],
                              if (_busy) const Padding(
                                padding: EdgeInsets.only(top: 12),
                                child: LinearProgressIndicator(),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(_t('سجل آخر الحركات', 'Recent attendance'),
                          style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 8),
                      if (records.isEmpty)
                        Card(child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: Text(_t('لا توجد سجلات حضور بعد', 'No attendance records yet')),
                        )),
                      for (final record in records)
                        Card(
                          child: ListTile(
                            leading: const Icon(Icons.event_available_outlined),
                            title: Text(_date(record['work_date'])),
                            subtitle: Text(
                              _t('الحضور: ', 'In: ') + _time(record['check_in_time']) +
                              '  •  ' + _t('الانصراف: ', 'Out: ') + _time(record['check_out_time']) +
                              '\n' + _t('الحالة: ', 'Status: ') + _status(record['status']?.toString() ?? ''),
                            ),
                            isThreeLine: true,
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
