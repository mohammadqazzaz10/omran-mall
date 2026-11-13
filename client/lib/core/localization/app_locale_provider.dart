import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Arabic is the default application language; users may switch to English.
final appLocaleProvider = StateProvider<Locale?>(
  (ref) => const Locale('ar', 'JO'),
);
