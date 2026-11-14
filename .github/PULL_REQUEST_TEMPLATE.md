## ملخص التغيير
ما الذي تغير ولماذا؟

## النطاق
- [ ] Backend
- [ ] Flutter
- [ ] Database / Migration
- [ ] Security / Permissions
- [ ] Documentation
- [ ] Infrastructure

## تتبع المتطلبات والمبادئ
- [ ] تحديد أرقام الأقسام والمتطلبات ذات الصلة من مصفوفة التتبع.
- [ ] توضيح أثر التغيير على مبادئ القسم 01 (VSN-01 إلى VSN-10).
- [ ] توثيق سبب «لا ينطبق» لأي مبدأ غير ذي صلة.
- [ ] تحديث `docs/REQUIREMENTS_TRACEABILITY_AR.md` وحالة المتطلبات المتأثرة.
- [ ] لا توجد شاشة أو جدول أو Mock معروض على أنه ميزة مكتملة.

## التحقق والاختبارات
- [ ] Unit tests
- [ ] Integration / E2E tests
- [ ] Flutter analyze / tests
- [ ] Database migration tested from clean database
- [ ] Branch isolation tests (positive and negative)
- [ ] WebSocket / file / report scope tests where applicable
- [ ] Offline / retry / duplicate-request tests where applicable
- [ ] Manual verification (اذكر التفاصيل والبيئة والنتيجة)

## الأمان والبيانات
- [ ] لا أسرار أو بيانات شخصية حقيقية في التغيير
- [ ] الصلاحيات ونطاق الفرع مفحوصان على الخادم
- [ ] Audit log محدث عند الحاجة
- [ ] لا توجد تغييرات مالية/قانونية دون اعتماد
- [ ] فحص المدخلات والملفات والسجلات والبيانات الحساسة
- [ ] لا ادعاء بدعم Push أو Offline أو منصة دون اختبار مطابق

## التشغيل والتسليم
- [ ] متغيرات البيئة موثقة
- [ ] خطة migration والنسخ الاحتياطي والرجوع موثقة
- [ ] لا أثر جانبي على الإنتاج قبل الموافقة
- [ ] CI ناجح على نفس commit المقترح للمراجعة
- [ ] لا يتم النشر إلى Render ضمن أعمال التطوير المرحلية
