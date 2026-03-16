import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../firebase_options.dart';

/// Initialize Firebase and ensure Firestore offline persistence is enabled across platforms.
/// On iOS/Android persistence is on by default, but we set explicitly for clarity.
/// On web we must enable persistence; if multi-tab fails we gracefully fall back.
Future<void> initFirebase() async {
  // Avoid duplicate-app errors during hot reload or repeated calls.
  try {
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    }
  } catch (_) {
    // If initialization raced, proceed.
  }

  final firestore = FirebaseFirestore.instance;
  // Explicit settings (you can tune cacheSizeBytes if needed)
  firestore.settings = const Settings(
    persistenceEnabled: true,
    cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
  );
  // NOTE: For web multi-tab environments you could use enablePersistence() with synchronizeTabs.
  // The web plugin auto attempts persistence, but we rely on the above for consistency.
}
