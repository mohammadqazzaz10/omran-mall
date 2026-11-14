import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omran_mall/core/localization/app_locale_provider.dart';
import 'package:omran_mall/main.dart';

void main() {
  testWidgets('app opens in Arabic with RTL direction', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(child: OmranMallApp()),
    );
    await tester.pumpAndSettle();

    final loginText = find.text('تسجيل الدخول — عمران مول');
    expect(loginText, findsOneWidget);
    expect(
      Directionality.of(tester.element(loginText)),
      TextDirection.rtl,
    );
  });

  testWidgets('app can open in English with LTR direction', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appLocaleProvider.overrideWith((ref) => const Locale('en', 'US')),
        ],
        child: const OmranMallApp(),
      ),
    );
    await tester.pumpAndSettle();

    final loginText = find.text('Sign in — Omran Mall');
    expect(loginText, findsOneWidget);
    expect(
      Directionality.of(tester.element(loginText)),
      TextDirection.ltr,
    );
  });
}
