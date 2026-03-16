// Firestore debug settings injected (kept minimal). If additional logging desired, add FirebaseFirestore.instance.enableNetwork/disableNetwork toggles in a debug-only zone.
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'services/firebase_init.dart';
import 'screens/auth_gate.dart';
import 'theme/branding.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initFirebase();
  // Apply verbose local settings only in debug mode
  if (kDebugMode) {
    FirebaseFirestore.instance.settings = const Settings(persistenceEnabled: true, cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED);
    // ignore: avoid_print
    print('[APP] Firestore debug settings applied');
  }
  runApp(const Close2SourceApp());
}

class Close2SourceApp extends StatelessWidget {
  const Close2SourceApp({super.key});
  @override
  Widget build(BuildContext context) {
    final base = ThemeData(brightness: Brightness.dark, useMaterial3: true);
    final scheme = ColorScheme.fromSeed(
      seedColor: Branding.accent,
      brightness: Brightness.dark,
    );
    return MaterialApp(
      title: 'Close2Source',
      theme: base.copyWith(
        colorScheme: scheme,
        scaffoldBackgroundColor: Branding.scaffoldDark,
        tabBarTheme: TabBarThemeData(
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white.withValues(alpha: 0.7),
          indicatorColor: Branding.accent,
          dividerColor: Colors.white.withValues(alpha: 0.12),
          indicatorSize: TabBarIndicatorSize.tab,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          foregroundColor: Colors.white,
          centerTitle: false,
          titleTextStyle: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.5,
            color: Colors.white,
          ),
        ),
        textTheme: base.textTheme.apply(
          bodyColor: Colors.white,
          displayColor: Colors.white,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Branding.scaffoldDarkHigh,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Branding.accent, width: 1.4),
          ),
          labelStyle: TextStyle(color: Colors.white.withValues(alpha: 0.7)),
        ),
        cardTheme: CardThemeData(
          color: Branding.scaffoldDarkHigh,
          shape: Branding.cardShape(),
          elevation: 2,
          margin: EdgeInsets.zero,
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: Branding.accent,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            textStyle: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      ),
      debugShowCheckedModeBanner: false,
      home: const AuthGate(),
    );
  }
}
