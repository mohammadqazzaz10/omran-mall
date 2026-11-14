import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import 'attendance_repository.dart';

class AttendanceDashboardScreen extends ConsumerStatefulWidget {
  const AttendanceDashboardScreen({super.key});

  @override
  ConsumerState<AttendanceDashboardScreen> createState() =>
      _AttendanceDashboardScreenState();
}

class _AttendanceDashboardScreenState
    extends ConsumerState<AttendanceDashboardScreen> {
  late DateTime _workDate;
  late Future<List<Map<String, dynamic>>> _records;
  Timer? _refreshTimer;

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

  bool get _isArabic => Localizations.localeOf(context).languageCode == 'ar';
  String _t(String ar, String en) => _isArabic ? ar : en;

  String get _dateKey =>
      '${_workDate.year.toString().padLeft(4, '0')}-'
      '${_workDate.month.toString().padLeft(2, '0')}-'
      '${_workDate.day.toString().padLeft(2, '0')}';

  @override
  void initState() {
    super.initState();
    _workDate = DateTime.now().toUtc().add(const Duration(hours: 3));
    _records = _load();
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) _reload();
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<List<Map<String, dynamic>>> _load() {
    final branch = _branchId;
    if (branch == null) return Future.value(const []);
    return ref.read(attendanceRepositoryProvider).branchRecords(branch, _dateKey);
  }

  void _reload() {
    if (mounted) setState(() => _records = _load());
  }

  Future<void> _chooseDate() async {
    final selected = await showDatePicker(
      context: context,
      initialDate: _workDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().toUtc().add(const Duration(hours: 3, days: 1)),
    );
    if (selected != null && mounted) {
      setState(() {
        _workDate = selected;
        _records = _load();
      });
    }
  }

  String _time(dynamic value) {
    if (value == null) return '—';
    final parsed = DateTime.tryParse(value.toString());
    if (parsed == null) return value.toString();
    final local = parsed.toUtc().add(const Duration(hours: 3));
    return '${local.hour.toString().padLeft(2, '0')}:'
        '${local.minute.toString().padLeft(2, '0')}';
  }

  String _employeeName(Map<String, dynamic> record) {
    final parts = [
      record['first_name_ar'],
      record['second_name_ar'],
      record['last_name_ar'],
    ].where((value) => value != null && value.toString().trim().isNotEmpty);
    return parts.join(' ');
  }

  String _status(String? value) {
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
      appBar: AppBar(
        title: Text(_t('متابعة الحضور', 'Attendance dashboard')),
        actions: [
          IconButton(
            tooltip: _t('تحديث', 'Refresh'),
            onPressed: _reload,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: branch == null
          ? Center(
              child: Text(_t(
                'لا يوجد فرع مرتبط بحسابك',
                'No branch is linked to your account',
              )),
            )
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
                        Text(_t('تعذر تحميل بيانات الحضور', 'Could not load attendance')),
                        const SizedBox(height: 8),
                        OutlinedButton(
                          onPressed: _reload,
                          child: Text(_t('إعادة المحاولة', 'Retry')),
                        ),
                      ],
                    ),
                  );
                }
                final records = snapshot.data ?? const <Map<String, dynamic>>[];
                final present = records.where((r) => r['status'] == 'present').length;
                final late = records.where((r) => r['status'] == 'late').length;
                final review = records.where((r) => r['status'] == 'needs_review').length;
                return RefreshIndicator(
                  onRefresh: () async => _reload(),
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Card(
                        child: ListTile(
                          leading: const Icon(Icons.calendar_today),
                          title: Text(_dateKey),
                          subtitle: Text(_t('تحديث تلقائي كل 30 ثانية', 'Auto-refresh every 30 seconds')),
                          trailing: const Icon(Icons.edit_calendar),
                          onTap: _chooseDate,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _CountChip(label: _t('إجمالي السجلات', 'Records'), count: records.length),
                          _CountChip(label: _t('حاضر', 'Present'), count: present),
                          _CountChip(label: _t('متأخر', 'Late'), count: late),
                          _CountChip(label: _t('مراجعة', 'Review'), count: review),
                        ],
                      ),
                      const SizedBox(height: 16),
                      if (records.isEmpty)
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(20),
                            child: Text(
                              _t('لا توجد سجلات حضور لهذا التاريخ', 'No attendance records for this date'),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                      for (final record in records)
                        Card(
                          child: ListTile(
                            leading: Icon(
                              record['check_out_time'] == null
                                  ? Icons.timelapse
                                  : Icons.event_available,
                            ),
                            title: Text(
                              _employeeName(record).isEmpty
                                  ? record['employee_code']?.toString() ?? '—'
                                  : _employeeName(record),
                            ),
                            subtitle: Text(
                              '${record['employee_code'] ?? ''} • '
                              '${record['department_name_ar'] ?? ''}\n'
                              '${_t('دخول', 'In')}: ${_time(record['check_in_time'])}  •  '
                              '${_t('خروج', 'Out')}: ${_time(record['check_out_time'])}\n'
                              '${_t('الحالة', 'Status')}: ${_status(record['status']?.toString())}',
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

class _CountChip extends StatelessWidget {
  const _CountChip({required this.label, required this.count});

  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text('$label: $count'),
      avatar: const Icon(Icons.people_alt_outlined, size: 18),
    );
  }
}
