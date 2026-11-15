import 'package:flutter/material.dart';

/// A local-only, read-only preview. It deliberately has no repositories,
/// providers, network clients, or persistence.
class PreviewHomeScreen extends StatelessWidget {
  const PreviewHomeScreen({super.key});

  static const _modules = <_PreviewModule>[
    _PreviewModule('dashboard', 'لوحة التحكم', 'Dashboard', Icons.dashboard_outlined,
        'ملخص الفروع والموظفين ومؤشرات التشغيل.', 'Branches, employees, and operational indicators.'),
    _PreviewModule('branches', 'الفروع والأقسام', 'Branches & Departments', Icons.storefront_outlined,
        'استعراض الفروع والأقسام والهيكل التنظيمي.', 'Browse branches, departments, and the organization structure.'),
    _PreviewModule('employees', 'الموظفون والملفات الوظيفية', 'Employees & Records', Icons.people_alt_outlined,
        'ملفات الموظفين والبيانات الوظيفية والعقود.', 'Employee profiles, employment data, and contracts.'),
    _PreviewModule('attendance', 'الحضور والانصراف و QR', 'Attendance & QR', Icons.qr_code_scanner,
        'استعراض الحضور والانصراف والتحقق برمز QR.', 'Preview attendance, check-out, and QR verification.'),
    _PreviewModule('shifts', 'الورديات والجداول', 'Shifts & Scheduling', Icons.calendar_month_outlined,
        'تخطيط الورديات وتوزيع الموظفين وتغطية الفروع.', 'Plan shifts, assign employees, and review branch coverage.'),
    _PreviewModule('breaks', 'الاستراحات', 'Breaks', Icons.free_breakfast_outlined,
        'طلبات الاستراحة ومتابعة حالتها.', 'Break requests and their statuses.'),
    _PreviewModule('notifications', 'الإشعارات', 'Notifications', Icons.notifications_active_outlined,
        'مركز الإشعارات والتنبيهات التشغيلية.', 'Notification center and operational alerts.'),
    _PreviewModule('reports', 'التقارير والمؤشرات', 'Reports & Analytics', Icons.bar_chart_outlined,
        'ملخصات وتقارير الأداء والتشغيل.', 'Operational and performance summaries.'),
    _PreviewModule('settings', 'الإعدادات والصلاحيات', 'Settings & Permissions', Icons.settings_outlined,
        'إعدادات النظام والأدوار والصلاحيات.', 'System settings, roles, and permissions.'),
  ];

  @override
  Widget build(BuildContext context) {
    final ar = Localizations.localeOf(context).languageCode == 'ar';
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(ar ? 'معاينة عمران مول' : 'Omran Mall Preview'),
        actions: [
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 12),
            child: Center(
              child: Chip(
                avatar: const Icon(Icons.visibility_outlined, size: 16),
                label: Text(ar ? 'وضع المعاينة' : 'Preview mode'),
              ),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: theme.colorScheme.primaryContainer,
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(ar ? 'مرحباً بك في عمران مول' : 'Welcome to Omran Mall',
                      style: theme.textTheme.headlineSmall),
                  const SizedBox(height: 8),
                  Text(ar
                      ? 'هذه معاينة محلية للواجهات باستخدام بيانات تجريبية. لا يوجد اتصال بالخادم ولا يتم حفظ أي تغييرات.'
                      : 'This is a local UI preview with sample data. It does not connect to a server or save changes.'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(ar ? 'نظرة عامة تجريبية' : 'Sample overview',
              style: theme.textTheme.titleLarge),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _MetricCard(label: ar ? 'الفروع' : 'Branches', value: '4', icon: Icons.storefront_outlined),
              _MetricCard(label: ar ? 'الموظفون' : 'Employees', value: '128', icon: Icons.people_outline),
              _MetricCard(label: ar ? 'حضور اليوم' : 'Present today', value: '112', icon: Icons.how_to_reg_outlined),
            ],
          ),
          const SizedBox(height: 22),
          Text(ar ? 'استعراض أقسام النظام' : 'Explore system modules',
              style: theme.textTheme.titleLarge),
          const SizedBox(height: 8),
          ..._modules.map((module) => Card(
                child: ListTile(
                  leading: CircleAvatar(child: Icon(module.icon)),
                  title: Text(ar ? module.ar : module.en),
                  subtitle: Text(ar ? module.descriptionAr : module.descriptionEn),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => _PreviewModuleScreen(module: module),
                  )),
                ),
              )),
          const SizedBox(height: 12),
          Text(
            ar
                ? 'تنبيه: الأرقام والأسماء المعروضة افتراضية للمعاينة فقط.'
                : 'Note: all names and figures shown are fictional preview data.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _PreviewModule {
  const _PreviewModule(this.id, this.ar, this.en, this.icon,
      this.descriptionAr, this.descriptionEn);
  final String id;
  final String ar;
  final String en;
  final IconData icon;
  final String descriptionAr;
  final String descriptionEn;
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.label, required this.value, required this.icon});
  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: 145,
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon),
                const SizedBox(height: 8),
                Text(value, style: Theme.of(context).textTheme.headlineSmall),
                Text(label),
              ],
            ),
          ),
        ),
      );
}

class _PreviewModuleScreen extends StatelessWidget {
  const _PreviewModuleScreen({required this.module});
  final _PreviewModule module;

  @override
  Widget build(BuildContext context) {
    final ar = Localizations.localeOf(context).languageCode == 'ar';
    final records = _sampleRecords(module.id, ar);
    return Scaffold(
      appBar: AppBar(title: Text(ar ? module.ar : module.en)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: CircleAvatar(child: Icon(module.icon)),
              title: Text(ar ? module.ar : module.en),
              subtitle: Text(ar ? module.descriptionAr : module.descriptionEn),
            ),
          ),
          const SizedBox(height: 12),
          ...records.map((record) => Card(
                child: ListTile(
                  leading: const Icon(Icons.article_outlined),
                  title: Text(record.$1),
                  subtitle: Text(record.$2),
                  trailing: const Icon(Icons.visibility_outlined),
                ),
              )),
          const SizedBox(height: 12),
          const _ReadOnlyNotice(),
        ],
      ),
    );
  }

  List<(String, String)> _sampleRecords(String id, bool ar) {
    switch (id) {
      case 'branches':
        return ar
            ? [('فرع الإدارة الرئيسية', 'عمّان · نشط'), ('فرع المدينة', 'عمّان · نشط'), ('فرع السوق', 'الزرقاء · نشط')]
            : [('Head Office Branch', 'Amman · Active'), ('City Branch', 'Amman · Active'), ('Market Branch', 'Zarqa · Active')];
      case 'employees':
        return ar
            ? [('أحمد محمد', 'موظف مبيعات · فرع الإدارة'), ('سارة خالد', 'أمينة صندوق · فرع المدينة'), ('محمود علي', 'مشرف · فرع السوق')]
            : [('Ahmad Mohammad', 'Sales employee · Head Office'), ('Sara Khaled', 'Cashier · City Branch'), ('Mahmoud Ali', 'Supervisor · Market Branch')];
      case 'attendance':
        return ar
            ? [('أحمد محمد', 'حاضر · 08:02'), ('سارة خالد', 'حاضر · 08:11'), ('محمود علي', 'متأخر · 08:35')]
            : [('Ahmad Mohammad', 'Present · 08:02'), ('Sara Khaled', 'Present · 08:11'), ('Mahmoud Ali', 'Late · 08:35')];
      case 'shifts':
        return ar
            ? [('الوردية الصباحية', '08:00 – 16:00 · 12 موظفاً'), ('الوردية المسائية', '16:00 – 00:00 · 9 موظفين'), ('الوردية الليلية', '00:00 – 08:00 · 4 موظفين')]
            : [('Morning shift', '08:00 – 16:00 · 12 employees'), ('Evening shift', '16:00 – 00:00 · 9 employees'), ('Night shift', '00:00 – 08:00 · 4 employees')];
      case 'breaks':
        return ar
            ? [('طلب استراحة #104', 'قيد المراجعة'), ('طلب استراحة #103', 'تمت الموافقة'), ('طلب استراحة #102', 'مكتمل')]
            : [('Break request #104', 'Under review'), ('Break request #103', 'Approved'), ('Break request #102', 'Completed')];
      case 'notifications':
        return ar
            ? [('تذكير ببدء الوردية', 'اليوم · 07:45'), ('تحديث جدول الموظفين', 'أمس · 17:20')]
            : [('Shift start reminder', 'Today · 07:45'), ('Employee schedule updated', 'Yesterday · 17:20')];
      case 'reports':
        return ar
            ? [('تقرير الحضور اليومي', 'نسبة الحضور التجريبية: 87.5%'), ('تقرير تغطية الفروع', '3 فروع بتغطية مكتملة')]
            : [('Daily attendance report', 'Sample attendance rate: 87.5%'), ('Branch coverage report', '3 branches fully covered')];
      case 'settings':
        return ar
            ? [('إدارة الأدوار', 'مدير نظام · مدير فرع · مشرف · موظف'), ('الصلاحيات', 'عرض تجريبي للصلاحيات')]
            : [('Role management', 'System admin · Branch manager · Supervisor · Employee'), ('Permissions', 'Sample permissions overview')];
      default:
        return ar
            ? [('إجمالي الفروع', '4 فروع تجريبية'), ('إجمالي الموظفين', '128 موظفاً تجريبياً'), ('طلبات تحتاج متابعة', '6 طلبات')]
            : [('Total branches', '4 sample branches'), ('Total employees', '128 sample employees'), ('Items needing attention', '6 items')];
    }
  }
}

class _ReadOnlyNotice extends StatelessWidget {
  const _ReadOnlyNotice();

  @override
  Widget build(BuildContext context) {
    final ar = Localizations.localeOf(context).languageCode == 'ar';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            const Icon(Icons.info_outline),
            const SizedBox(width: 10),
            Expanded(
              child: Text(ar
                  ? 'هذه بيانات وهمية للعرض فقط. العمليات الفعلية غير مفعّلة في وضع المعاينة.'
                  : 'These are fictional sample records. Real operations are disabled in preview mode.'),
            ),
          ],
        ),
      ),
    );
  }
}
