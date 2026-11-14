import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../auth/auth_controller.dart';
import 'admin_repository.dart';

class AdminHomeScreen extends ConsumerStatefulWidget {
  const AdminHomeScreen({super.key});

  @override
  ConsumerState<AdminHomeScreen> createState() => _AdminHomeScreenState();
}

class _AdminHomeScreenState extends ConsumerState<AdminHomeScreen> {
  late Future<_AdminData> _data;

  Set<String> get _roleCodes {
    final user = ref.read(authProvider).user ?? {};
    final roles = user['roles'];
    if (roles is! List) return {};
    return roles
        .whereType<Map>()
        .map((role) => role['code']?.toString() ?? '')
        .where((code) => code.isNotEmpty)
        .toSet();
  }

  bool get _canManageBranches =>
      _roleCodes.contains('SUPER_ADMIN') ||
      _roleCodes.contains('GENERAL_MANAGER');

  bool get _canManageUsers =>
      _roleCodes.contains('SUPER_ADMIN') || _roleCodes.contains('HR_MANAGER');

  bool get _canManageEmployeeRecords =>
      _roleCodes.contains('SUPER_ADMIN') || _roleCodes.contains('HR_MANAGER');

  bool get _canTransferEmployees =>
      _roleCodes.contains('SUPER_ADMIN') ||
      _roleCodes.contains('GENERAL_MANAGER') ||
      _roleCodes.contains('HR_MANAGER');

  bool get _canManageBreaks =>
      _roleCodes.contains('SUPER_ADMIN') ||
      _roleCodes.contains('GENERAL_MANAGER');

  bool get _canViewRoles =>
      _roleCodes.contains('SUPER_ADMIN') ||
      _roleCodes.contains('GENERAL_MANAGER');

  bool get _canManageRoles => _roleCodes.contains('SUPER_ADMIN');

  @override
  void initState() {
    super.initState();
    _data = _load();
  }

  Future<_AdminData> _load() async {
    final repository = ref.read(adminRepositoryProvider);
    final branches = await repository.listBranches();
    final users = await repository.listUsers();
    final roles = _canViewRoles
        ? await repository.listRoles()
        : <Map<String, dynamic>>[];
    final permissions = _canManageRoles
        ? await repository.listPermissions()
        : <Map<String, dynamic>>[];
    return _AdminData(
      branches: branches,
      users: (users['items'] as List? ?? const [])
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList(),
      totalUsers: (users['total'] as num?)?.toInt() ?? 0,
      roles: roles,
      permissions: permissions,
    );
  }

  void _reload() {
    setState(() => _data = _load());
  }

  Future<void> _createBranch() async {
    final strings = AppLocalizations.of(context);
    final code = TextEditingController();
    final name = TextEditingController();
    final formKey = GlobalKey<FormState>();
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(strings.createBranchButton),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: code,
                decoration: InputDecoration(labelText: strings.branchCodeLabel),
                validator: (value) => value == null || value.trim().isEmpty
                    ? strings.branchCodeLabel
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: name,
                decoration:
                    InputDecoration(labelText: strings.branchNameArLabel),
                validator: (value) => value == null || value.trim().isEmpty
                    ? strings.branchNameArLabel
                    : null,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(strings.cancelButton),
          ),
          FilledButton(
            onPressed: () {
              if (formKey.currentState!.validate()) {
                Navigator.pop(dialogContext, true);
              }
            },
            child: Text(strings.createButton),
          ),
        ],
      ),
    );
    if (result != true) return;
    try {
      await ref.read(adminRepositoryProvider).createBranch(
            code: code.text.trim(),
            nameAr: name.text.trim(),
          );
      _reload();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    } finally {
      code.dispose();
      name.dispose();
    }
  }

  Future<void> _createEmployeeAccount(
    List<Map<String, dynamic>> branches,
  ) async {
    if (branches.isEmpty) return;
    final strings = AppLocalizations.of(context);
    final repository = ref.read(adminRepositoryProvider);
    final username = TextEditingController();
    final formKey = GlobalKey<FormState>();
    String roleCode = 'EMPLOYEE';
    String branchId = branches.first['id'].toString();
    List<Map<String, dynamic>> employees = [];
    String? employeeId;
    bool loadingEmployees = true;

    try {
      final initialEmployees = await repository.listEmployees(branchId);
      employees = initialEmployees
          .where((employee) => employee['user_id'] == null)
          .toList();
      employeeId = employees.isEmpty ? null : employees.first['id'].toString();
      loadingEmployees = false;

      final result = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            title: Text(strings.createUserButton),
            content: Form(
              key: formKey,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextFormField(
                      controller: username,
                      decoration:
                          InputDecoration(labelText: strings.usernameLabel),
                      validator: (value) =>
                          value == null || value.trim().length < 3
                              ? strings.usernameLabel
                              : null,
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: roleCode,
                      decoration:
                          InputDecoration(labelText: strings.roleLabel),
                      items: const [
                        DropdownMenuItem(
                          value: 'EMPLOYEE',
                          child: Text('EMPLOYEE'),
                        ),
                        DropdownMenuItem(
                          value: 'CASHIER',
                          child: Text('CASHIER'),
                        ),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          setDialogState(() => roleCode = value);
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: branchId,
                      decoration:
                          InputDecoration(labelText: strings.branchLabel),
                      items: branches
                          .map(
                            (branch) => DropdownMenuItem<String>(
                              value: branch['id'].toString(),
                              child: Text(
                                branch['name_ar']?.toString() ??
                                    branch['code'].toString(),
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (value) async {
                        if (value == null) return;
                        setDialogState(() {
                          branchId = value;
                          loadingEmployees = true;
                          employees = [];
                          employeeId = null;
                        });
                        try {
                          final result =
                              await repository.listEmployees(branchId);
                          if (!dialogContext.mounted) return;
                          setDialogState(() {
                            employees = result
                                .where((employee) => employee['user_id'] == null)
                                .toList();
                            employeeId = employees.isEmpty
                                ? null
                                : employees.first['id'].toString();
                            loadingEmployees = false;
                          });
                        } catch (_) {
                          if (!dialogContext.mounted) return;
                          setDialogState(() => loadingEmployees = false);
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    if (loadingEmployees)
                      const Padding(
                        padding: EdgeInsets.all(12),
                        child: CircularProgressIndicator(),
                      )
                    else if (employees.isEmpty)
                      Text(
                        isArabic(context)
                            ? 'لا يوجد موظفون غير مرتبطين بحساب في هذا الفرع'
                            : 'No employees without an account were found in this branch.',
                        textAlign: TextAlign.center,
                      )
                    else
                      DropdownButtonFormField<String>(
                        value: employeeId,
                        decoration: InputDecoration(
                          labelText: strings.employeeCodeLabel,
                        ),
                        items: employees
                            .map(
                              (employee) => DropdownMenuItem<String>(
                                value: employee['id'].toString(),
                                child: Text(
                                  employee['employee_code'].toString() +
                                      ' — ' +
                                      [
                                        employee['first_name_ar'],
                                        employee['second_name_ar'],
                                        employee['last_name_ar'],
                                      ]
                                          .where((part) =>
                                              part != null &&
                                              part.toString().isNotEmpty)
                                          .join(' '),
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: (value) {
                          setDialogState(() => employeeId = value);
                        },
                        validator: (value) =>
                            value == null ? strings.employeeCodeLabel : null,
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
                onPressed: loadingEmployees || employees.isEmpty
                    ? null
                    : () {
                        if (formKey.currentState!.validate()) {
                          Navigator.pop(dialogContext, true);
                        }
                      },
                child: Text(strings.createButton),
              ),
            ],
          ),
        ),
      );
      if (result != true || employeeId == null) return;

      final created = await repository.createUser(
        username: username.text.trim(),
        roleCode: roleCode,
        branchIds: [branchId],
        primaryBranchId: branchId,
        employeeId: employeeId!,
      );
      final password = created['temporaryPassword']?.toString() ?? '';
      _reload();
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(strings.temporaryPasswordLabel),
          content: SelectableText(password),
          actions: [
            TextButton(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: password));
                if (dialogContext.mounted) Navigator.pop(dialogContext);
              },
              child: Text(isArabic(context) ? 'نسخ وإغلاق' : 'Copy and close'),
            ),
          ],
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    } finally {
      username.dispose();
    }
  }


  Future<void> _transferEmployee(
    List<Map<String, dynamic>> branches,
  ) async {
    final activeBranches = branches
        .where((branch) => branch['is_active'] == true)
        .toList();
    if (activeBranches.length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            isArabic(context)
                ? 'يلزم وجود فرعين نشطين على الأقل لإجراء النقل'
                : 'At least two active branches are required for a transfer.',
          ),
        ),
      );
      return;
    }

    final strings = AppLocalizations.of(context);
    final repository = ref.read(adminRepositoryProvider);
    final reason = TextEditingController();
    final formKey = GlobalKey<FormState>();
    String sourceBranchId = activeBranches.first['id'].toString();
    String targetBranchId = activeBranches
        .firstWhere((branch) => branch['id'].toString() != sourceBranchId)['id']
        .toString();
    String? employeeId;
    String? targetDepartmentId;
    String? targetPositionId;
    String? targetDirectManagerId;
    var sourceEmployees = <Map<String, dynamic>>[];
    var targetDepartments = <Map<String, dynamic>>[];
    var targetPositions = <Map<String, dynamic>>[];
    var targetEmployees = <Map<String, dynamic>>[];
    var loading = true;

    try {
      final initial = await Future.wait([
        repository.listEmployees(sourceBranchId, activeOnly: false),
        repository.listDepartments(targetBranchId),
        repository.listPositions(targetBranchId),
        repository.listEmployees(targetBranchId),
      ]);
      sourceEmployees = initial[0];
      targetDepartments = initial[1];
      targetPositions = initial[2];
      targetEmployees = initial[3];
      if (!mounted) return;
      employeeId = sourceEmployees.isEmpty
          ? null
          : sourceEmployees.first['id'].toString();
      targetDepartmentId = targetDepartments.isEmpty
          ? null
          : targetDepartments.first['id'].toString();
      final availablePositions = targetPositions
          .where((item) => item['department_id']?.toString() == targetDepartmentId)
          .toList();
      targetPositionId = availablePositions.isEmpty
          ? null
          : availablePositions.first['id'].toString();
      loading = false;

      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setDialogState) {
            final departments = targetDepartments;
            final positions = targetPositions
                .where((item) =>
                    item['department_id']?.toString() == targetDepartmentId)
                .toList();
            return AlertDialog(
              title: Text(
                isArabic(context) ? 'نقل موظف بين الفروع' : 'Transfer employee',
              ),
              content: SizedBox(
                width: 480,
                child: Form(
                  key: formKey,
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        DropdownButtonFormField<String>(
                          value: sourceBranchId,
                          decoration: InputDecoration(
                            labelText: isArabic(context) ? 'فرع المصدر' : 'Source branch',
                          ),
                          items: activeBranches.map((branch) {
                            final id = branch['id'].toString();
                            return DropdownMenuItem(
                              value: id,
                              child: Text(
                                branch['name_ar']?.toString() ?? branch['code'].toString(),
                              ),
                            );
                          }).toList(),
                          onChanged: (value) async {
                            if (value == null) return;
                            final nextTarget = value == targetBranchId
                                ? activeBranches.firstWhere(
                                    (branch) => branch['id'].toString() != value,
                                  )['id'].toString()
                                : targetBranchId;
                            setDialogState(() {
                              sourceBranchId = value;
                              targetBranchId = nextTarget;
                              employeeId = null;
                              targetDepartmentId = null;
                              targetPositionId = null;
                              targetDirectManagerId = null;
                              loading = true;
                            });
                            try {
                              final data = await Future.wait([
                                repository.listEmployees(sourceBranchId, activeOnly: false),
                                repository.listDepartments(targetBranchId),
                                repository.listPositions(targetBranchId),
                                repository.listEmployees(targetBranchId),
                              ]);
                              if (!dialogContext.mounted) return;
                              setDialogState(() {
                                sourceEmployees = data[0];
                                targetDepartments = data[1];
                                targetPositions = data[2];
                                targetEmployees = data[3];
                                employeeId = sourceEmployees.isEmpty
                                    ? null
                                    : sourceEmployees.first['id'].toString();
                                targetDepartmentId = targetDepartments.isEmpty
                                    ? null
                                    : targetDepartments.first['id'].toString();
                                final matches = targetPositions.where((item) =>
                                    item['department_id']?.toString() ==
                                    targetDepartmentId);
                                targetPositionId = matches.isEmpty
                                    ? null
                                    : matches.first['id'].toString();
                                loading = false;
                              });
                            } catch (_) {
                              if (dialogContext.mounted) {
                                setDialogState(() => loading = false);
                              }
                            }
                          },
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          value: employeeId,
                          decoration: InputDecoration(
                            labelText: isArabic(context) ? 'الموظف المراد نقله' : 'Employee to transfer',
                          ),
                          items: sourceEmployees.map((employee) {
                            final fullName = [
                              employee['first_name_ar'],
                              employee['second_name_ar'],
                              employee['third_name_ar'],
                              employee['last_name_ar'],
                            ].where((part) => part != null && part.toString().isNotEmpty)
                                .join(' ');
                            return DropdownMenuItem(
                              value: employee['id'].toString(),
                              child: Text(
                                employee['employee_code'].toString() + ' — ' + fullName,
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          }).toList(),
                          onChanged: loading ? null : (value) {
                            setDialogState(() => employeeId = value);
                          },
                          validator: (value) => value == null
                              ? (isArabic(context) ? 'اختر الموظف' : 'Select an employee')
                              : null,
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          value: targetBranchId,
                          decoration: InputDecoration(
                            labelText: isArabic(context) ? 'الفرع الجديد' : 'Destination branch',
                          ),
                          items: activeBranches
                              .where((branch) => branch['id'].toString() != sourceBranchId)
                              .map((branch) => DropdownMenuItem(
                                    value: branch['id'].toString(),
                                    child: Text(
                                      branch['name_ar']?.toString() ?? branch['code'].toString(),
                                    ),
                                  ))
                              .toList(),
                          onChanged: (value) async {
                            if (value == null) return;
                            setDialogState(() {
                              targetBranchId = value;
                              targetDepartmentId = null;
                              targetPositionId = null;
                              targetDirectManagerId = null;
                              loading = true;
                            });
                            try {
                              final data = await Future.wait([
                                repository.listDepartments(value),
                                repository.listPositions(value),
                                repository.listEmployees(value),
                              ]);
                              if (!dialogContext.mounted) return;
                              setDialogState(() {
                                targetDepartments = data[0];
                                targetPositions = data[1];
                                targetEmployees = data[2];
                                targetDepartmentId = targetDepartments.isEmpty
                                    ? null
                                    : targetDepartments.first['id'].toString();
                                final matches = targetPositions.where((item) =>
                                    item['department_id']?.toString() ==
                                    targetDepartmentId);
                                targetPositionId = matches.isEmpty
                                    ? null
                                    : matches.first['id'].toString();
                                loading = false;
                              });
                            } catch (_) {
                              if (dialogContext.mounted) {
                                setDialogState(() => loading = false);
                              }
                            }
                          },
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          value: targetDepartmentId,
                          decoration: InputDecoration(
                            labelText: isArabic(context) ? 'القسم الجديد' : 'Destination department',
                          ),
                          items: departments.map((item) => DropdownMenuItem(
                                value: item['id'].toString(),
                                child: Text(item['name_ar']?.toString() ?? item['code'].toString()),
                              )).toList(),
                          onChanged: loading ? null : (value) {
                            setDialogState(() {
                              targetDepartmentId = value;
                              final matches = targetPositions.where((item) =>
                                  item['department_id']?.toString() == value);
                              targetPositionId = matches.isEmpty
                                  ? null
                                  : matches.first['id'].toString();
                            });
                          },
                          validator: (value) => value == null
                              ? (isArabic(context) ? 'اختر القسم' : 'Select a department')
                              : null,
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          value: positions.any((item) => item['id'].toString() == targetPositionId)
                              ? targetPositionId
                              : null,
                          decoration: InputDecoration(
                            labelText: isArabic(context) ? 'المسمى الوظيفي الجديد' : 'Destination position',
                          ),
                          items: positions.map((item) => DropdownMenuItem(
                                value: item['id'].toString(),
                                child: Text(item['title_ar']?.toString() ?? item['code'].toString()),
                              )).toList(),
                          onChanged: loading ? null : (value) {
                            setDialogState(() => targetPositionId = value);
                          },
                          validator: (value) => value == null
                              ? (isArabic(context) ? 'اختر المسمى الوظيفي' : 'Select a position')
                              : null,
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String?>(
                          value: targetDirectManagerId,
                          decoration: InputDecoration(
                            labelText: isArabic(context)
                                ? 'المدير المباشر الجديد (اختياري)'
                                : 'New direct manager (optional)',
                          ),
                          items: [
                            DropdownMenuItem<String?>(
                              value: null,
                              child: Text(isArabic(context) ? 'بدون مدير مباشر' : 'No direct manager'),
                            ),
                            ...targetEmployees.map((employee) {
                              final fullName = [
                                employee['first_name_ar'],
                                employee['second_name_ar'],
                                employee['last_name_ar'],
                              ].where((part) => part != null && part.toString().isNotEmpty)
                                  .join(' ');
                              return DropdownMenuItem<String?>(
                                value: employee['id'].toString(),
                                child: Text(fullName),
                              );
                            }),
                          ],
                          onChanged: loading ? null : (value) {
                            setDialogState(() => targetDirectManagerId = value);
                          },
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: reason,
                          minLines: 2,
                          maxLines: 4,
                          decoration: InputDecoration(
                            labelText: isArabic(context) ? 'سبب النقل' : 'Transfer reason',
                          ),
                          validator: (value) => value == null || value.trim().length < 10
                              ? (isArabic(context)
                                  ? 'اكتب سبباً لا يقل عن 10 أحرف'
                                  : 'Enter a reason of at least 10 characters')
                              : null,
                        ),
                        if (loading)
                          const Padding(
                            padding: EdgeInsets.only(top: 12),
                            child: LinearProgressIndicator(),
                          ),
                        const SizedBox(height: 8),
                        Text(
                          isArabic(context)
                              ? 'لن تُنقل صلاحيات الفرع القديم تلقائياً. يجب إسناد صلاحيات الفرع الجديد بصورة مستقلة.'
                              : 'Old-branch permissions are not copied. Assign destination permissions separately.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: Text(strings.cancelButton),
                ),
                FilledButton(
                  onPressed: loading
                      ? null
                      : () {
                          if (formKey.currentState!.validate() &&
                              employeeId != null &&
                              targetDepartmentId != null &&
                              targetPositionId != null) {
                            Navigator.pop(dialogContext, true);
                          }
                        },
                  child: Text(isArabic(context) ? 'تنفيذ النقل' : 'Transfer'),
                ),
              ],
            );
          },
        ),
      );

      if (confirmed != true || employeeId == null || targetDepartmentId == null || targetPositionId == null) {
        return;
      }
      await repository.transferEmployee(
        sourceBranchId: sourceBranchId,
        employeeId: employeeId!,
        targetBranchId: targetBranchId,
        targetDepartmentId: targetDepartmentId!,
        targetPositionId: targetPositionId!,
        targetDirectManagerId: targetDirectManagerId,
        reason: reason.text.trim(),
      );
      if (!mounted) return;
      _reload();
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isArabic(context) ? 'تم تنفيذ نقل الموظف بنجاح' : 'Employee transfer completed.',
            ),
          ),
        );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    } finally {
      reason.dispose();
    }
  }


  Future<void> _manageRole(
    List<Map<String, dynamic>> permissions, {
    Map<String, dynamic>? role,
  }) async {
    final arabic = isArabic(context);
    final code = TextEditingController(text: role?['code']?.toString() ?? 'CUSTOM_');
    final nameAr = TextEditingController(text: role?['name_ar']?.toString() ?? '');
    final nameEn = TextEditingController(text: role?['name_en']?.toString() ?? '');
    final description = TextEditingController(text: role?['description']?.toString() ?? '');
    final formKey = GlobalKey<FormState>();
    final allowedPermissions = permissions.where((permission) {
      final scope = permission['scope']?.toString();
      final module = permission['module']?.toString();
      return ['branch', 'department', 'own'].contains(scope) &&
          !['companies', 'users', 'roles', 'sessions'].contains(module);
    }).toList();
    final selected = <String>{
      ...((role?['permission_codes'] as List?) ?? const [])
          .map((value) => value.toString()),
    };
    try {
      final saved = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            title: Text(
              role == null
                  ? (arabic ? 'إنشاء دور مخصص' : 'Create custom role')
                  : (arabic ? 'تعديل الدور المخصص' : 'Edit custom role'),
            ),
            content: SizedBox(
              width: 560,
              child: Form(
                key: formKey,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (role == null)
                        TextFormField(
                          controller: code,
                          decoration: InputDecoration(
                            labelText: arabic ? 'رمز الدور' : 'Role code',
                            helperText: 'CUSTOM_...',
                          ),
                          validator: (value) {
                            final text = value?.trim() ?? '';
                            return RegExp(r'^CUSTOM_[A-Z0-9_]{1,43}$').hasMatch(text)
                                ? null
                                : (arabic
                                    ? 'استخدم رمزاً يبدأ بـ CUSTOM_ وأحرفاً إنجليزية كبيرة'
                                    : 'Use CUSTOM_ followed by uppercase letters, numbers or underscores');
                          },
                        ),
                      TextFormField(
                        controller: nameAr,
                        decoration: InputDecoration(
                          labelText: arabic ? 'اسم الدور بالعربية' : 'Arabic role name',
                        ),
                        validator: (value) => value == null || value.trim().length < 2
                            ? (arabic ? 'أدخل اسم الدور' : 'Enter a role name')
                            : null,
                      ),
                      TextFormField(
                        controller: nameEn,
                        decoration: InputDecoration(
                          labelText: arabic ? 'اسم الدور بالإنجليزية' : 'English role name',
                        ),
                      ),
                      TextFormField(
                        controller: description,
                        maxLines: 2,
                        decoration: InputDecoration(
                          labelText: arabic ? 'الوصف' : 'Description',
                        ),
                      ),
                      const SizedBox(height: 16),
                      Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: Text(
                          arabic ? 'الصلاحيات المسموح بها' : 'Allowed permissions',
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (allowedPermissions.isEmpty)
                        Text(arabic ? 'لا توجد صلاحيات متاحة' : 'No permissions available')
                      else
                        ...allowedPermissions.map((permission) {
                          final permissionCode = permission['code'].toString();
                          return CheckboxListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            value: selected.contains(permissionCode),
                            title: Text(permissionCode),
                            subtitle: Text(
                              '${permission['description_ar'] ?? ''} · ${permission['scope']}',
                            ),
                            onChanged: (checked) {
                              setDialogState(() {
                                if (checked == true) {
                                  selected.add(permissionCode);
                                } else {
                                  selected.remove(permissionCode);
                                }
                              });
                            },
                          );
                        }),
                    ],
                  ),
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: Text(AppLocalizations.of(context).cancelButton),
              ),
              FilledButton(
                onPressed: () {
                  if (formKey.currentState!.validate() &&
                      (role != null || selected.isNotEmpty)) {
                    Navigator.pop(dialogContext, true);
                  }
                },
                child: Text(arabic ? 'حفظ' : 'Save'),
              ),
            ],
          ),
        ),
      );
      if (saved != true) return;
      final repository = ref.read(adminRepositoryProvider);
      if (role == null) {
        await repository.createRole(
          code: code.text.trim(),
          nameAr: nameAr.text.trim(),
          nameEn: nameEn.text.trim(),
          description: description.text.trim(),
          permissionCodes: selected.toList(),
        );
      } else {
        await repository.updateRole(
          role['id'].toString(),
          nameAr: nameAr.text.trim(),
          nameEn: nameEn.text.trim(),
          description: description.text.trim(),
          permissionCodes: selected.toList(),
        );
      }
      if (mounted) _reload();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    } finally {
      code.dispose();
      nameAr.dispose();
      nameEn.dispose();
      description.dispose();
    }
  }


  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(strings.adminDashboardTitle),
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
      body: FutureBuilder<_AdminData>(
        future: _data,
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
          final data = snapshot.data!;
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    _SummaryCard(
                      title: strings.branchesTitle,
                      value: data.branches.length.toString(),
                      icon: Icons.storefront_outlined,
                    ),
                    _SummaryCard(
                      title: strings.usersTitle,
                      value: data.totalUsers.toString(),
                      icon: Icons.people_outline,
                    ),
                    if (_canViewRoles)
                      _SummaryCard(
                        title: strings.rolesTitle,
                        value: data.roles.length.toString(),
                        icon: Icons.admin_panel_settings_outlined,
                      ),
                  ],
                ),
                const SizedBox(height: 20),
                if (_canTransferEmployees)
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.swap_horiz),
                      title: Text(
                        isArabic(context)
                            ? 'نقل موظف بين الفروع'
                            : 'Transfer employee between branches',
                      ),
                      subtitle: Text(
                        isArabic(context)
                            ? 'مع حفظ السجل الوظيفي وإعادة ضبط صلاحيات الفرع'
                            : 'Preserve employment history and reset branch-scoped access',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => _transferEmployee(data.branches),
                    ),
                  ),
                if (_canManageEmployeeRecords)
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.folder_shared_outlined),
                      title: Text(
                        isArabic(context)
                            ? 'الملفات الوظيفية الشاملة'
                            : 'Comprehensive employee records',
                      ),
                      subtitle: Text(
                        isArabic(context)
                            ? 'البيانات الإضافية والوثائق والعقود والسجل الوظيفي'
                            : 'HR profile data, documents, contracts, and employment history',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/employee-records'),
                    ),
                  ),
                if (_canManageBreaks)
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.free_breakfast_outlined),
                      title: Text(strings.breakManagementTitle),
                      subtitle: Text(strings.pendingBreakRequestsTitle),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/breaks/manage'),
                    ),
                  ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        strings.branchesTitle,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    if (_canManageBranches)
                      IconButton.filledTonal(
                        tooltip: strings.createBranchButton,
                        onPressed: _createBranch,
                        icon: const Icon(Icons.add),
                      ),
                  ],
                ),
                ...data.branches.map(
                  (branch) => Card(
                    child: ListTile(
                      leading: const Icon(Icons.store_outlined),
                      title: Text(
                        branch['name_ar']?.toString() ??
                            branch['code'].toString(),
                      ),
                      subtitle: Text(branch['code'].toString()),
                      trailing: Icon(
                        branch['is_active'] == true
                            ? Icons.check_circle_outline
                            : Icons.pause_circle_outline,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        strings.usersTitle,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    if (_canManageUsers)
                      IconButton.filledTonal(
                        tooltip: strings.createUserButton,
                        onPressed: () => _createEmployeeAccount(data.branches),
                        icon: const Icon(Icons.person_add_alt_1),
                      ),
                  ],
                ),
                ...data.users.map(
                  (user) {
                    final roles = (user['roles'] as List? ?? const [])
                        .whereType<Map>()
                        .map((role) => role['code'].toString())
                        .toSet()
                        .join(', ');
                    return Card(
                      child: ListTile(
                        leading: const Icon(Icons.person_outline),
                        title: Text(user['username'].toString()),
                        subtitle: Text(roles.isEmpty ? '—' : roles),
                        trailing: Icon(
                          user['is_active'] == true
                              ? Icons.check_circle_outline
                              : Icons.block_outlined,
                        ),
                      ),
                    );
                  },
                ),
                if (_canViewRoles) ...[
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          strings.rolesTitle,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ),
                      if (_canManageRoles)
                        IconButton(
                          tooltip: isArabic(context) ? 'إنشاء دور مخصص' : 'Create custom role',
                          onPressed: () => _manageRole(data.permissions),
                          icon: const Icon(Icons.add_circle_outline),
                        ),
                    ],
                  ),
                  ...data.roles.map(
                    (role) => Card(
                      child: ListTile(
                        leading: const Icon(Icons.security_outlined),
                        title: Text(role['name_ar']?.toString() ??
                            role['code'].toString()),
                        subtitle: Text(role['code'].toString()),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(role['permissions_count'].toString()),
                            if (_canManageRoles && role['is_system_role'] != true)
                              IconButton(
                                tooltip: isArabic(context) ? 'تعديل الدور' : 'Edit role',
                                onPressed: () => _manageRole(data.permissions, role: role),
                                icon: const Icon(Icons.edit_outlined),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

bool isArabic(BuildContext context) =>
    Localizations.localeOf(context).languageCode == 'ar';

class _AdminData {
  const _AdminData({
    required this.branches,
    required this.users,
    required this.totalUsers,
    required this.roles,
    required this.permissions,
  });

  final List<Map<String, dynamic>> branches;
  final List<Map<String, dynamic>> users;
  final int totalUsers;
  final List<Map<String, dynamic>> roles;
  final List<Map<String, dynamic>> permissions;
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.title,
    required this.value,
    required this.icon,
  });

  final String title;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 160,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon),
              const SizedBox(height: 10),
              Text(value, style: Theme.of(context).textTheme.headlineSmall),
              Text(title),
            ],
          ),
        ),
      ),
    );
  }
}
