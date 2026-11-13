import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omran_mall/main.dart';

void main() {
  testWidgets('app opens the Arabic login route with RTL direction', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: OmranMallApp(),
      ),
    );
    await tester.pumpAndSettle();

    final loginText = find.text('تسجيل الدخول - عمران مول');
    expect(loginText, findsOneWidget);
    expect(
      Directionality.of(tester.element(loginText)),
      TextDirection.rtl,
    );
  });
}
