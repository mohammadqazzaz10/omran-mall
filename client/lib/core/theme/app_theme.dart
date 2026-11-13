import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Brand Colors for Omran Mall
  static const Color primaryNavy = Color(0xFF0D253F);
  static const Color primaryBlue = Color(0xFF01B4E4);
  static const Color accentGreen = Color(0xFF00A86B);
  static const Color warningAmber = Color(0xFFFFA000);
  static const Color alertRed = Color(0xFFD32F2F);

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryNavy,
        primary: primaryNavy,
        secondary: primaryBlue,
        tertiary: accentGreen,
        error: alertRed,
        background: const Color(0xFFF8F9FA),
        surface: Colors.white,
      ),
      scaffoldBackgroundColor: const Color(0xFFF4F6F9),
      textTheme: GoogleFonts.cairoTextTheme().apply(
        bodyColor: const Color(0xFF1F2937),
        displayColor: primaryNavy,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: primaryNavy,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
      ),
      cardTheme: CardTheme(
        elevation: 1,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        color: Colors.white,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryNavy,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryNavy,
        brightness: Brightness.dark,
        primary: primaryBlue,
        secondary: accentGreen,
        background: const Color(0xFF111827),
        surface: const Color(0xFF1F2937),
      ),
      scaffoldBackgroundColor: const Color(0xFF0F172A),
      textTheme: GoogleFonts.cairoTextTheme(ThemeData.dark().textTheme),
    );
  }
}
