import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omran_mall/core/localization/app_locale_provider.dart';
import 'package:omran_mall/core/network/api_client.dart';
import 'package:omran_mall/features/auth/auth_controller.dart';
import 'package:omran_mall/features/auth/auth_repository.dart';
import 'package:omran_mall/main.dart';
import 'package:flutter/foundation.dart';

class _SignedOutAuthRepository extends AuthRepository {
  _SignedOutAuthRepository()
      : super(ApiClient(baseUrl: 'http://localhost/api/v1/'));

  @override
  Future<String?> readRefreshToken() async => null;
}

List<Override> _testOverrides({Locale? locale}) => [
      authProvider.overrideWith(
        (ref) => AuthController(_SignedOutAuthRepository()),
      ),
      if (locale != null)
        appLocaleProvider.overrideWith((ref) => locale),
    ];

void main() {
  testWidgets('app opens in Arabic with RTL direction', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: _testOverrides(),
        child: const OmranMallApp(),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    final loginText = find.text('تسجيل الدخول — عمران مول');
    expect(loginText, findsOneWidget);
    expect(
      Directionality.of(tester.element(loginText)),
      TextDirection.rtl,
    );
  });

  testWidgets('debug build can enter offline preview without signing in', (tester) async {
    expect(kDebugMode, isTrue);
    await tester.pumpWidget(
      ProviderScope(
        overrides: _testOverrides(),
        child: const OmranMallApp(),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    final previewButton = find.text('استعراض التطبيق دون تسجيل الدخول');
    expect(previewButton, findsOneWidget);
    await tester.tap(previewButton);
    await tester.pumpAndSettle();

    expect(find.text('معاينة عمران مول'), findsOneWidget);
    expect(find.text('استعراض أقسام النظام'), findsOneWidget);

    // The module list is scrollable; move the lazily built attendance row
    // into the viewport before asserting that it is present.
    final attendanceModule = find.text('الحضور والانصراف و QR');
    await tester.scrollUntilVisible(attendanceModule, 250);
    expect(attendanceModule, findsOneWidget);
  });

  testWidgets('app can open in English with LTR direction', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: _testOverrides(locale: const Locale('en', 'US')),
        child: const OmranMallApp(),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    final loginText = find.text('Sign in — Omran Mall');
    expect(loginText, findsOneWidget);
    expect(
      Directionality.of(tester.element(loginText)),
      TextDirection.ltr,
    );
  });
}
