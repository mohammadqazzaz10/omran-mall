import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../admin/admin_repository.dart';
import 'employee_records_repository.dart';

class EmployeeRecordsScreen extends ConsumerStatefulWidget {
  const EmployeeRecordsScreen({super.key});

  @override
  ConsumerState<EmployeeRecordsScreen> createState() =>
      _EmployeeRecordsScreenState();
}

class _EmployeeRecordsScreenState extends ConsumerState<EmployeeRecordsScreen> {
  late final Future<List<Map<String, dynamic>>> _branchesFuture;
  Future<List<Map<String, dynamic>>>? _employeesFuture;
  Future<_EmployeeRecordsBundle>? _recordsFuture;
  String? _branchId;
  String? _employeeId;
  bool _branchInitialized = false;
  bool _employeeInitialized = false;

  bool get _isArabic =>
      Localizations.localeOf(context).languageCode == 'ar';

  String _text(String ar, String en) => _isArabic ? ar : en;

  @override
  void initState() {
    super.initState();
    _branchesFuture = ref.read(adminRepositoryProvider).listBranches();
  }

  void _selectBranch(String? branchId) {
    if (branchId == null) return;
    setState(() {
      _branchId = branchId;
      _employeeId = null;
      _employeeInitialized = false;
      _recordsFuture = null;
      _employeesFuture =
          ref.read(adminRepositoryProvider).listEmployees(
                branchId,
                activeOnly: false,
              );
    });
  }

  void _selectEmployee(String? employeeId) {
    final branchId = _branchId;
    if (branchId == null || employeeId == null) return;
    setState(() {
      _employeeId = employeeId;
      _recordsFuture = _loadRecords(branchId, employeeId);
    });
  }

  Future<_EmployeeRecordsBundle> _loadRecords(
    String branchId,
    String employeeId,
  ) async {
    final repository = ref.read(employeeRecordsRepositoryProvider);
    final results = await Future.wait<dynamic>([
      repository.getProfile(branchId, employeeId),
      repository.listDocuments(branchId, employeeId),
      repository.listContracts(branchId, employeeId),
      repository.listHistory(branchId, employeeId),
    ]);
    return _EmployeeRecordsBundle(
      profile: results[0] as Map<String, dynamic>,
      documents: results[1] as List<Map<String, dynamic>>,
      contracts: results[2] as List<Map<String, dynamic>>,
      history: results[3] as List<Map<String, dynamic>>,
    );
  }

  void _reloadRecords() {
    final branchId = _branchId;
    final employeeId = _employeeId;
    if (branchId == null || employeeId == null) return;
    setState(() {
      _recordsFuture = _loadRecords(branchId, employeeId);
    });
  }

  Future<void> _editProfile(Map<String, dynamic> profile) async {
    final branchId = _branchId;
    final employeeId = _employeeId;
    if (branchId == null || employeeId == null) return;

    const fields = <String, String>{
      'bankName': 'اسم البنك|Bank name',
      'bankIban': 'رقم IBAN|IBAN',
      'socialSecurityNumber': 'رقم الضمان الاجتماعي|Social security number',
      'taxIdentificationNumber': 'الرقم الضريبي|Tax identification number',
      'educationLevel': 'المؤهل العلمي|Education level',
      'specialization': 'التخصص|Specialization',
      'graduationYear': 'سنة التخرج|Graduation year',
      'addressCity': 'المدينة|City',
      'addressArea': 'المنطقة|Area',
      'addressStreet': 'العنوان التفصيلي|Street address',
      'notes': 'ملاحظات الموارد البشرية|HR notes',
    };
    final controllers = <String, TextEditingController>{};
    for (final key in fields.keys) {
      controllers[key] = TextEditingController(
        text: profile[_snakeCase(key)]?.toString() ?? '',
      );
    }
    final formKey = GlobalKey<FormState>();

    try {
      final saved = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(_text('تعديل البيانات الإضافية', 'Edit HR profile data')),
          content: SizedBox(
            width: 520,
            child: Form(
              key: formKey,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: fields.entries.map((entry) {
                    final labels = entry.value.split('|');
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: TextFormField(
                        controller: controllers[entry.key],
                        maxLines: entry.key == 'notes' ||
                                entry.key == 'addressStreet'
                            ? 3
                            : 1,
                        keyboardType: entry.key == 'graduationYear'
                            ? TextInputType.number
                            : TextInputType.text,
                        decoration: InputDecoration(
                          labelText: _text(labels[0], labels[1]),
                          border: const OutlineInputBorder(),
                        ),
                        validator: entry.key == 'graduationYear'
                            ? (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return null;
                                }
                                final year = int.tryParse(value.trim());
                                if (year == null || year < 1900 || year > 2100) {
                                  return _text('أدخل سنة صحيحة', 'Enter a valid year');
                                }
                                return null;
                              }
                            : null,
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: Text(_text('إلغاء', 'Cancel')),
            ),
            FilledButton(
              onPressed: () {
                if (formKey.currentState!.validate()) {
                  Navigator.pop(dialogContext, true);
                }
              },
              child: Text(_text('حفظ', 'Save')),
            ),
          ],
        ),
      );
      if (saved != true) return;
      final changes = <String, dynamic>{};
      for (final entry in controllers.entries) {
        final value = entry.value.text.trim();
        if (entry.key == 'graduationYear') {
          changes[entry.key] = value.isEmpty ? null : int.parse(value);
        } else {
          changes[entry.key] = value.isEmpty ? null : value;
        }
      }
      await ref.read(employeeRecordsRepositoryProvider).upsertProfile(
            branchId,
            employeeId,
            changes,
          );
      _reloadRecords();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_text('تم حفظ الملف الوظيفي', 'Employee record saved'))),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    } finally {
      for (final controller in controllers.values) {
        controller.dispose();
      }
    }
  }

  String _snakeCase(String value) {
    return value.replaceAllMapped(
      RegExp(r'[A-Z]'),
      (match) => '_${match.group(0)!.toLowerCase()}',
    );
  }

  Future<void> _createContract() async {
    final branchId = _branchId;
    final employeeId = _employeeId;
    if (branchId == null || employeeId == null) return;

    final startDate = TextEditingController(
      text: DateTime.now().toIso8601String().substring(0, 10),
    );
    final endDate = TextEditingController();
    final salary = TextEditingController();
    final hours = TextEditingController(text: '8');
    final days = TextEditingController(text: '6');
    final formKey = GlobalKey<FormState>();
    var contractType = 'full_time';

    try {
      final saved = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            title: Text(_text('إضافة عقد وظيفي', 'Add employment contract')),
            content: SizedBox(
              width: 460,
              child: Form(
                key: formKey,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      DropdownButtonFormField<String>(
                        value: contractType,
                        decoration: InputDecoration(
                          labelText: _text('نوع العقد', 'Contract type'),
                          border: const OutlineInputBorder(),
                        ),
                        items: [
                          DropdownMenuItem(
                            value: 'full_time',
                            child: Text(_text('دوام كامل', 'Full time')),
                          ),
                          DropdownMenuItem(
                            value: 'part_time',
                            child: Text(_text('دوام جزئي', 'Part time')),
                          ),
                          DropdownMenuItem(
                            value: 'seasonal',
                            child: Text(_text('موسمي', 'Seasonal')),
                          ),
                          DropdownMenuItem(
                            value: 'temporary',
                            child: Text(_text('مؤقت', 'Temporary')),
                          ),
                          DropdownMenuItem(
                            value: 'hourly',
                            child: Text(_text('بالساعة', 'Hourly')),
                          ),
                        ],
                        onChanged: (value) {
                          if (value != null) {
                            setDialogState(() => contractType = value);
                          }
                        },
                      ),
                      const SizedBox(height: 10),
                      _dateField(startDate, _text('تاريخ البداية (YYYY-MM-DD)', 'Start date (YYYY-MM-DD)')),
                      const SizedBox(height: 10),
                      _dateField(endDate, _text('تاريخ النهاية (اختياري)', 'End date (optional)'), required: false),
                      const SizedBox(height: 10),
                      _numberField(salary, _text('الراتب الأساسي بالدينار', 'Basic salary (JOD)'), decimals: true),
                      const SizedBox(height: 10),
                      _numberField(hours, _text('ساعات العمل يومياً', 'Working hours per day'), decimals: true),
                      const SizedBox(height: 10),
                      _numberField(days, _text('أيام العمل أسبوعياً', 'Working days per week')),
                    ],
                  ),
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: Text(_text('إلغاء', 'Cancel')),
              ),
              FilledButton(
                onPressed: () {
                  if (formKey.currentState!.validate()) {
                    Navigator.pop(dialogContext, true);
                  }
                },
                child: Text(_text('حفظ العقد', 'Save contract')),
              ),
            ],
          ),
        ),
      );
      if (saved != true) return;
      await ref.read(employeeRecordsRepositoryProvider).createContract(
        branchId,
        employeeId,
        {
          'contractType': contractType,
          'startDate': startDate.text.trim(),
          if (endDate.text.trim().isNotEmpty) 'endDate': endDate.text.trim(),
          'basicSalary': double.parse(salary.text.trim()),
          'workingHoursPerDay': double.parse(hours.text.trim()),
          'workingDaysPerWeek': int.parse(days.text.trim()),
        },
      );
      _reloadRecords();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_text('تم إنشاء العقد', 'Contract created'))),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    } finally {
      startDate.dispose();
      endDate.dispose();
      salary.dispose();
      hours.dispose();
      days.dispose();
    }
  }

  Widget _dateField(
    TextEditingController controller,
    String label, {
    bool required = true,
  }) {
    return TextFormField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
      validator: (value) {
        if (!required && (value == null || value.trim().isEmpty)) return null;
        if (value == null ||
            !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value.trim())) {
          return _text('استخدم الصيغة YYYY-MM-DD', 'Use YYYY-MM-DD');
        }
        return null;
      },
    );
  }

  Widget _numberField(
    TextEditingController controller,
    String label, {
    bool decimals = false,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
      validator: (value) {
        final number = decimals
            ? double.tryParse(value?.trim() ?? '')
            : int.tryParse(value?.trim() ?? '');
        if (number == null || number <= 0) {
          return _text('أدخل قيمة صحيحة أكبر من صفر', 'Enter a valid positive value');
        }
        return null;
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: Text(_text('الملف الوظيفي الشامل', 'Employee records')),
          bottom: TabBar(
            isScrollable: true,
            tabs: [
              Tab(text: _text('البيانات', 'Profile')),
              Tab(text: _text('الوثائق', 'Documents')),
              Tab(text: _text('العقود', 'Contracts')),
              Tab(text: _text('التاريخ الوظيفي', 'History')),
            ],
          ),
        ),
        body: FutureBuilder<List<Map<String, dynamic>>>(
          future: _branchesFuture,
          builder: (context, branchSnapshot) {
            if (branchSnapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (branchSnapshot.hasError) {
              return Center(
                child: OutlinedButton(
                  onPressed: () => setState(() {}),
                  child: Text(_text('إعادة المحاولة', 'Retry')),
                ),
              );
            }
            final branches = branchSnapshot.data ?? const [];
            if (branches.isEmpty) {
              return Center(
                child: Text(_text('لا توجد فروع متاحة', 'No branches available')),
              );
            }
            if (!_branchInitialized) {
              _branchInitialized = true;
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted && _branchId == null) {
                  _selectBranch(branches.first['id'].toString());
                }
              });
            }
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  child: DropdownButtonFormField<String>(
                    value: _branchId ?? branches.first['id'].toString(),
                    decoration: InputDecoration(
                      labelText: _text('الفرع', 'Branch'),
                      border: const OutlineInputBorder(),
                    ),
                    items: branches.map((branch) {
                      return DropdownMenuItem(
                        value: branch['id'].toString(),
                        child: Text(
                          branch['name_ar']?.toString() ??
                              branch['code'].toString(),
                        ),
                      );
                    }).toList(),
                    onChanged: _selectBranch,
                  ),
                ),
                if (_employeesFuture != null)
                  FutureBuilder<List<Map<String, dynamic>>>(
                    future: _employeesFuture,
                    builder: (context, employeeSnapshot) {
                      if (employeeSnapshot.connectionState ==
                          ConnectionState.waiting) {
                        return const LinearProgressIndicator();
                      }
                      if (employeeSnapshot.hasError) {
                        return Padding(
                          padding: const EdgeInsets.all(12),
                          child: Text(employeeSnapshot.error.toString()),
                        );
                      }
                      final employees = employeeSnapshot.data ?? const [];
                      if (employees.isEmpty) {
                        return Padding(
                          padding: const EdgeInsets.all(16),
                          child: Text(
                            _text('لا يوجد موظفون في هذا الفرع', 'No employees in this branch'),
                          ),
                        );
                      }
                      if (!_employeeInitialized) {
                        _employeeInitialized = true;
                        WidgetsBinding.instance.addPostFrameCallback((_) {
                          if (mounted && _employeeId == null) {
                            _selectEmployee(employees.first['id'].toString());
                          }
                        });
                      }
                      return Padding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                        child: DropdownButtonFormField<String>(
                          value: _employeeId ?? employees.first['id'].toString(),
                          isExpanded: true,
                          decoration: InputDecoration(
                            labelText: _text('الموظف', 'Employee'),
                            border: const OutlineInputBorder(),
                          ),
                          items: employees.map((employee) {
                            final name = [
                              employee['first_name_ar'],
                              employee['second_name_ar'],
                              employee['third_name_ar'],
                              employee['last_name_ar'],
                            ].where((part) => part != null && part.toString().isNotEmpty).join(' ');
                            return DropdownMenuItem(
                              value: employee['id'].toString(),
                              child: Text(
                                '${employee['employee_code']} — $name',
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          }).toList(),
                          onChanged: _selectEmployee,
                        ),
                      );
                    },
                  ),
                const Divider(height: 1),
                Expanded(
                  child: _recordsFuture == null
                      ? Center(
                          child: Text(_text('اختر موظفاً لعرض ملفه', 'Select an employee to view their record')),
                        )
                      : FutureBuilder<_EmployeeRecordsBundle>(
                          future: _recordsFuture,
                          builder: (context, snapshot) {
                            if (snapshot.connectionState ==
                                ConnectionState.waiting) {
                              return const Center(
                                child: CircularProgressIndicator(),
                              );
                            }
                            if (snapshot.hasError) {
                              return Center(
                                child: OutlinedButton(
                                  onPressed: _reloadRecords,
                                  child: Text(_text('إعادة المحاولة', 'Retry')),
                                ),
                              );
                            }
                            final bundle = snapshot.data!;
                            return TabBarView(
                              children: [
                                _profileTab(bundle.profile),
                                _documentsTab(bundle.documents),
                                _contractsTab(bundle.contracts),
                                _historyTab(bundle.history),
                              ],
                            );
                          },
                        ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _profileTab(Map<String, dynamic> profile) {
    final rows = <(String, String)>[
      ('bank_name', _text('اسم البنك', 'Bank name')),
      ('bank_iban', 'IBAN'),
      ('social_security_number', _text('رقم الضمان الاجتماعي', 'Social security number')),
      ('tax_identification_number', _text('الرقم الضريبي', 'Tax identification number')),
      ('education_level', _text('المؤهل العلمي', 'Education level')),
      ('specialization', _text('التخصص', 'Specialization')),
      ('graduation_year', _text('سنة التخرج', 'Graduation year')),
      ('address_city', _text('المدينة', 'City')),
      ('address_area', _text('المنطقة', 'Area')),
      ('address_street', _text('العنوان', 'Address')),
      ('notes', _text('ملاحظات', 'Notes')),
    ];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Align(
          alignment: AlignmentDirectional.centerEnd,
          child: FilledButton.tonalIcon(
            onPressed: () => _editProfile(profile),
            icon: const Icon(Icons.edit_outlined),
            label: Text(_text('تعديل البيانات', 'Edit profile data')),
          ),
        ),
        const SizedBox(height: 8),
        Card(
          child: Column(
            children: rows.map((row) {
              return ListTile(
                dense: true,
                title: Text(row.$2),
                subtitle: SelectableText(
                  profile[row.$1]?.toString().isNotEmpty == true
                      ? profile[row.$1].toString()
                      : '—',
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _documentsTab(List<Map<String, dynamic>> documents) {
    if (documents.isEmpty) {
      return Center(
        child: Text(_text('لا توجد وثائق مسجلة لهذا الموظف', 'No documents are registered for this employee')),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: ListTile(
            leading: const Icon(Icons.info_outline),
            title: Text(_text('رفع الملفات غير متاح بعد', 'File upload is not available yet')),
            subtitle: Text(
              _text(
                'تظهر هنا بيانات الوثائق المسجلة فقط. سيتم تفعيل الرفع والتنزيل بعد ربط التخزين الخاص الآمن.',
                'Only registered document metadata is shown. Secure upload and download will be enabled after private storage integration.',
              ),
            ),
          ),
        ),
        ...documents.map((document) => Card(
              child: ListTile(
                leading: const Icon(Icons.description_outlined),
                title: Text(document['title']?.toString() ?? '—'),
                subtitle: Text(
                  '${document['document_type'] ?? '—'} • ${_text('الانتهاء', 'Expires')}: ${document['expiry_date'] ?? '—'}',
                ),
                trailing: const Icon(Icons.lock_outline),
              ),
            )),
      ],
    );
  }

  Widget _contractsTab(List<Map<String, dynamic>> contracts) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Align(
          alignment: AlignmentDirectional.centerEnd,
          child: FilledButton.tonalIcon(
            onPressed: _createContract,
            icon: const Icon(Icons.add),
            label: Text(_text('إضافة عقد', 'Add contract')),
          ),
        ),
        const SizedBox(height: 8),
        if (contracts.isEmpty)
          Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              _text('لا توجد عقود مسجلة', 'No contracts are registered'),
              textAlign: TextAlign.center,
            ),
          ),
        ...contracts.map((contract) => Card(
              child: ListTile(
                leading: Icon(
                  contract['is_current'] == true
                      ? Icons.verified_outlined
                      : Icons.history,
                ),
                title: Text(
                  '${contract['contract_type']} • ${contract['basic_salary']} JOD',
                ),
                subtitle: Text(
                  '${contract['start_date']} — ${contract['end_date'] ?? _text('مفتوح', 'Open')}',
                ),
                trailing: contract['is_current'] == true
                    ? Chip(label: Text(_text('حالي', 'Current')))
                    : null,
              ),
            )),
      ],
    );
  }

  Widget _historyTab(List<Map<String, dynamic>> history) {
    if (history.isEmpty) {
      return Center(
        child: Text(_text('لا توجد أحداث في السجل الوظيفي', 'No employment history events')),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: history.length,
      itemBuilder: (context, index) {
        final item = history[index];
        return Card(
          child: ListTile(
            leading: const Icon(Icons.history),
            title: Text(item['event_type']?.toString() ?? '—'),
            subtitle: Text(
              '${item['effective_date'] ?? '—'}
${item['reason'] ?? ''}',
            ),
            isThreeLine: true,
          ),
        );
      },
    );
  }
}

class _EmployeeRecordsBundle {
  const _EmployeeRecordsBundle({
    required this.profile,
    required this.documents,
    required this.contracts,
    required this.history,
  });

  final Map<String, dynamic> profile;
  final List<Map<String, dynamic>> documents;
  final List<Map<String, dynamic>> contracts;
  final List<Map<String, dynamic>> history;
}
