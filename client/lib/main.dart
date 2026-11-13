import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    const ProviderScope(
      child: OmranMallApp(),
    ),
  );
}

class OmranMallApp extends ConsumerWidget {
  const OmranMallApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'عمران مول - المنصة المتكاملة لإدارة الموظفين والعمليات',
      debugShowCheckedModeBanner: false,
      
      // Strict Arabic Localization with RTL default
      locale: const Locale('ar', 'JO'),
      supportedLocales: const [
        Locale('ar', 'JO'),
        Locale('en', 'US'),
      ],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],

      // Theme Management
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.light,

      // Routing with Role Guards
      routerConfig: router,
    );
  }
}
