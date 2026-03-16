# Close2Source Mobile (Flutter)

This folder contains the Android-only Flutter application that partners with the existing Next.js web platform. Other platform folders are deprecated and can be pruned.

## Planned Stack
- Flutter 3.x
- firebase_core, firebase_auth, cloud_firestore, firebase_storage, firebase_messaging
- Riverpod / Provider for state (TBD)

## Getting Started
1. Ensure Flutter is installed and on PATH:
```
flutter doctor
```
2. (One time) Activate FlutterFire CLI:
```
dart pub global activate flutterfire_cli
```
3. Configure Firebase for this app (Android only):
```
flutterfire configure \
  --project=close2source-3o2we \
  --android-package-name com.close2source.sourceapp \
  --out=lib/firebase_options.dart \
  --platforms=android
```
This generates `firebase_options.dart` (trimmed now to Android only) and `android/app/google-services.json`.

## Creating the Project Structure
Inside this folder run:
```
flutter create .
```
If already created elsewhere, you can copy relevant platform folders in.

## Initialization Snippet (main.dart)
```dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const AppRoot());
}

class AppRoot extends StatelessWidget {
  const AppRoot({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Close2Source',
      theme: ThemeData(colorSchemeSeed: const Color(0xFFFF6A1A), brightness: Brightness.light),
      home: const Placeholder(),
    );
  }
}
```

## Emulators (Optional)
To use local emulators during development:
```dart
/* After Firebase.initializeApp */
// Firestore
FirebaseFirestore.instance.useFirestoreEmulator('localhost', 8080);
// Auth
await FirebaseAuth.instance.useAuthEmulator('localhost', 9099);
// Storage
FirebaseStorage.instance.useStorageEmulator('localhost', 9199);
```
Run emulators from repo root:
```
firebase emulators:start --only firestore,auth,storage
```

## Directory Suggestions
```
lib/
  main.dart
  firebase_options.dart (generated)
  models/
  services/
  features/
    auth/
    projects/
    updates/
    finance/
  widgets/
```

## Shared Schema Idea
Add JSON schemas in `shared/schema/` and generate both TS and Dart types to keep parity.

---
This README is a scaffold; expand as mobile features are implemented. (Android only build target.)
