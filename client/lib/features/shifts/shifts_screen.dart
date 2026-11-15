import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import 'shifts_repository.dart';

class ShiftsScreen extends ConsumerStatefulWidget {
  const ShiftsScreen({super.key});

  @override
  ConsumerState<ShiftsScreen> createState() => _ShiftsScreenState();
}

class _ShiftsScreenState extends ConsumerState<ShiftsScreen> {
  late DateTime _from;
  late Future<_ScheduleData> _data;

  bool get _isArabic => Localizations.localeOf(context).languageCode == 'ar';
  String _t(String ar, String en) => _isArabic ? ar : en;

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

  bool get _canManage {
    final roles = (ref.read(authProvider).user?['roles'] as List? ?? const [])
        .whereType<Map>()
        .map((role) => role['code']?.toString() ?? '')
        .toSet();
    return roles.any({
      'SUPER_ADMIN',
      'GENERAL_MANAGER',
      'BRANCH_MANAGER',
      'ASSISTANT_MANAGER',
      'SUPERVISOR',
      'HR_MANAGER',
      'HR_OFFICER',
      'PERSONNEL_OFFICER',
    }.contains);
  }

  String _date(DateTime value) =>
      '${value.year.toString().padLeft(4, '0')}-'
      '${value.month.toString().padLeft(2, '0')}-'
      '${value.day.toString().padLeft(2, '0')}';

  @override
  void initState() {
    super.initState();
    _from = DateTime.now();
    _from = DateTime(_from.year, _from.month, _from.day);
    _data = _load();
  }

  Future<_ScheduleData> _load() async {
    final branch = _branchId;
    if (branch == null) {
      return const _ScheduleData(assignments: [], templates: []);
    }
    final repository = ref.read(shiftsRepositoryProvider);
    final from = _date(_from);
    final to = _date(_from.add(const Duration(days: 13)));
    if (_canManage) {
      final values = await Future.wait([
        repository.listTemplates(branch),
        repository.listSchedule(branch, from: from, to: to),
      ]);
      return _ScheduleData(
        templates: values[0],
        assignments: values[1],
      );
    }
    final assignments =
        await repository.mySchedule(branch, from: from, to: to);
    return _ScheduleData(assignments: assignments, templates: const []);
  }

  void _reload() {
    if (mounted) setState(() => _data = _load());
  }

  Future<void> _createTemplate() async {
    final branch = _branchId;
    if (branch == null) return;
    final code = TextEditingController();
    final name = TextEditingController();
    final start = TextEditingController(text: '08:00');
    final end = TextEditingController(text: '16:00');
    final formKey = GlobalKey<FormState>();
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(_t('إضافة وردية', 'Add shift template')),
        content: Form(
          key: formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: code,
                  decoration: InputDecoration(labelText: _t('رمز الوردية', 'Shift code')),
                  validator: (value) => value == null || value.trim().length < 2
                      ? _t('أدخل رمزاً صحيحاً', 'Enter a valid code')
                      : null,
                ),
                TextFormField(
                  controller: name,
                  decoration: InputDecoration(labelText: _t('اسم الوردية', 'Shift name')),
                  validator: (value) => value == null || value.trim().length < 2
                      ? _t('أدخل اسم الوردية', 'Enter a shift name')
                      : null,
                ),
                TextFormField(
                  controller: start,
                  decoration: InputDecoration(labelText: _t('وقت البداية HH:MM', 'Start time HH:MM')),
                ),
                TextFormField(
                  controller: end,
                  decoration: InputDecoration(labelText: _t('وقت النهاية HH:MM', 'End time HH:MM')),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(_t('إلغاء', 'Cancel')),
          ),
          FilledButton(
            onPressed: () {
              if (formKey.currentState!.validate()) {
                Navigator.pop(dialogContext, true);
              }
            },
            child: Text(_t('حفظ', 'Save')),
          ),
        ],
      ),
    );
    if (accepted == true) {
      try {
        await ref.read(shiftsRepositoryProvider).createTemplate(
              branch,
              code: code.text.trim(),
              nameAr: name.text.trim(),
              startTime: start.text.trim(),
              endTime: end.text.trim(),
            );
        _reload();
      } catch (error) {
        _showError(error);
      }
    }
    code.dispose();
    name.dispose();
    start.dispose();
    end.dispose();
  }

  Future<void> _createAssignment(List<Map<String, dynamic>> templates) async {
    final branch = _branchId;
    if (branch == null || templates.isEmpty) return;
    try {
      final employees =
          await ref.read(shiftsRepositoryProvider).listEmployees(branch);
      if (!mounted) return;
      if (employees.isEmpty) {
        _showError(_t('لا يوجد موظفون فعالون في الفرع', 'No active employees found'));
        return;
      }
      String employeeId = employees.first['id'].toString();
      String shiftId = templates.first['id'].toString();
      DateTime workDate = _from;
      final accepted = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            title: Text(_t('إسناد وردية لموظف', 'Assign a shift')),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  value: employeeId,
                  isExpanded: true,
                  decoration: InputDecoration(labelText: _t('الموظف', 'Employee')),
                  items: employees.map((employee) {
                    final name = [
                      employee['first_name_ar'],
                      employee['second_name_ar'],
                      employee['last_name_ar'],
                    ].where((part) => part != null).join(' ');
                    return DropdownMenuItem(
                      value: employee['id'].toString(),
                      child: Text(name.isEmpty
                          ? employee['employee_code']?.toString() ?? '—'
                          : name),
                    );
                  }).toList(),
                  onChanged: (value) {
                    if (value != null) setDialogState(() => employeeId = value);
                  },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: shiftId,
                  isExpanded: true,
                  decoration: InputDecoration(labelText: _t('الوردية', 'Shift')),
                  items: templates.map((shift) => DropdownMenuItem(
                    value: shift['id'].toString(),
                    child: Text(shift['name_ar']?.toString() ?? ''),
                  )).toList(),
                  onChanged: (value) {
                    if (value != null) setDialogState(() => shiftId = value);
                  },
                ),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(_t('تاريخ العمل', 'Work date')),
                  subtitle: Text(_date(workDate)),
                  trailing: const Icon(Icons.calendar_month),
                  onTap: () async {
                    final selected = await showDatePicker(
                      context: context,
                      initialDate: workDate,
                      firstDate: DateTime.now().subtract(const Duration(days: 1)),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (selected != null) {
                      setDialogState(() => workDate = selected);
                    }
                  },
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: Text(_t('إلغاء', 'Cancel')),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: Text(_t('إسناد', 'Assign')),
              ),
            ],
          ),
        ),
      );
      if (accepted == true) {
        await ref.read(shiftsRepositoryProvider).createAssignment(
              branch,
              employeeId: employeeId,
              shiftId: shiftId,
              workDate: _date(workDate),
            );
        _reload();
      }
    } catch (error) {
      _showError(error);
    }
  }

  Future<void> _publish() async {
    final branch = _branchId;
    if (branch == null) return;
    try {
      final result = await ref.read(shiftsRepositoryProvider).publish(
            branch,
            from: _date(_from),
            to: _date(_from.add(const Duration(days: 13))),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_t(
            'تم نشر ${result['publishedCount'] ?? 0} إسناد',
            'Published ${result['publishedCount'] ?? 0} assignments',
          )),
        ),
      );
      _reload();
    } catch (error) {
      _showError(error);
    }
  }

  void _showError(Object error) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(error.toString())),
    );
  }

  @override
  Widget build(BuildContext context) {
    final branch = _branchId;
    return Scaffold(
      appBar: AppBar(
        title: Text(_t('الورديات والجداول', 'Shifts & schedules')),
        actions: [
          IconButton(
            tooltip: _t('تحديث', 'Refresh'),
            onPressed: _reload,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      floatingActionButton: _canManage
          ? FloatingActionButton(
              onPressed: () async {
                final data = await _data;
                if (!mounted) return;
                await _createAssignment(data.templates);
              },
              child: const Icon(Icons.person_add_alt_1),
            )
          : null,
      body: branch == null
          ? Center(child: Text(_t('لا يوجد فرع مرتبط بالحساب', 'No branch linked to this account')))
          : FutureBuilder<_ScheduleData>(
              future: _data,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_t('تعذر تحميل الجدول', 'Could not load schedule')),
                        TextButton(onPressed: _reload, child: Text(_t('إعادة المحاولة', 'Retry'))),
                      ],
                    ),
                  );
                }
                final data = snapshot.data ?? const _ScheduleData(assignments: [], templates: []);
                return RefreshIndicator(
                  onRefresh: () async {
                    final next = _load();
                    setState(() => _data = next);
                    await next;
                  },
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Card(
                        child: ListTile(
                          leading: const Icon(Icons.date_range),
                          title: Text(_t('الفترة القادمة: 14 يوماً', 'Next 14 days')),
                          subtitle: Text('${_date(_from)} — ${_date(_from.add(const Duration(days: 13)))}'),
                        ),
                      ),
                      if (_canManage) ...[
                        Row(
                          children: [
                            Expanded(child: Text(_t('قوالب الورديات', 'Shift templates'), style: Theme.of(context).textTheme.titleMedium)),
                            TextButton.icon(
                              onPressed: _createTemplate,
                              icon: const Icon(Icons.add),
                              label: Text(_t('إضافة', 'Add')),
                            ),
                          ],
                        ),
                        if (data.templates.isEmpty)
                          Text(_t('لا توجد قوالب ورديات بعد', 'No shift templates yet')),
                        for (final shift in data.templates)
                          Card(
                            child: ListTile(
                              leading: const Icon(Icons.schedule),
                              title: Text(shift['name_ar']?.toString() ?? ''),
                              subtitle: Text('${shift['start_time']} – ${shift['end_time']} • ${shift['code']}'),
                            ),
                          ),
                        const SizedBox(height: 8),
                        FilledButton.icon(
                          onPressed: _publish,
                          icon: const Icon(Icons.publish),
                          label: Text(_t('نشر جدول الفترة', 'Publish period schedule')),
                        ),
                      ],
                      const SizedBox(height: 12),
                      Text(_t('جدول الورديات', 'Shift schedule'), style: Theme.of(context).textTheme.titleMedium),
                      if (data.assignments.isEmpty)
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(20),
                            child: Text(_t('لا توجد إسنادات في هذه الفترة', 'No assignments in this period')),
                          ),
                        ),
                      for (final item in data.assignments)
                        Card(
                          child: ListTile(
                            leading: Icon(item['is_day_off'] == true ? Icons.weekend : Icons.access_time),
                            title: Text(_canManage
                                ? '${item['first_name_ar'] ?? ''} ${item['last_name_ar'] ?? ''}'
                                : item['shift_name']?.toString() ?? _t('يوم عطلة', 'Day off')),
                            subtitle: Text(
                              '${item['work_date']} • ${item['shift_name'] ?? _t('يوم عطلة', 'Day off')}\n'
                              '${item['scheduled_start_at'] ?? '—'} – ${item['scheduled_end_at'] ?? '—'}',
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

class _ScheduleData {
  const _ScheduleData({required this.assignments, required this.templates});

  final List<Map<String, dynamic>> assignments;
  final List<Map<String, dynamic>> templates;
}
