import 'dart:io';
import 'package:hive/hive.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../data/models/spending_entry.dart';

class SpendingCacheService {
  static const _boxName = 'spending_cache';
  static Box<SpendingEntry>? _box;

  /// Initialize Hive and open the spending cache box
  static Future<void> init() async {
    if (!Hive.isAdapterRegistered(SpendingEntryAdapter().typeId)) {
      Hive.registerAdapter(SpendingEntryAdapter());
    }
    _box = await Hive.openBox<SpendingEntry>(_boxName);

    // Auto-sync on network reconnect
    Connectivity().onConnectivityChanged.listen((ConnectivityResult result) {
      if (result != ConnectivityResult.none) {
        syncToFirestore();
      }
    });
  }

  /// Save spending entry locally (offline mode or Firestore failure)
  static Future<void> saveLocally(SpendingEntry entry) async {
    await _box?.put(entry.id, entry);
    print('✅ Saved locally: ${entry.id}');
  }

  /// Get all unsynced entries
  static List<SpendingEntry> getUnsyncedEntries() {
    return _box?.values.toList() ?? [];
  }

  /// Sync local entries with Firestore
  static Future<void> syncToFirestore() async {
    if (_box == null) {
      print('⚠️ Hive box not initialized.');
      return;
    }

    final entries = _box!.values.toList();

    for (var entry in entries) {
      try {
        String? receiptUrl;

        if (entry.localImagePath != null && entry.localImagePath!.isNotEmpty) {
          final file = File(entry.localImagePath!);
          if (!await file.exists()) {
            print('❌ Receipt file missing for ${entry.id}');
            continue;
          }

          final storageRef = FirebaseStorage.instance.ref(
            'receipts/${entry.id}.jpg',
          );

          await storageRef.putFile(file);
          receiptUrl = await storageRef.getDownloadURL();
        }

        await FirebaseFirestore.instance
            .collection('spendings')
            .doc(entry.id)
            .set({
              'description': entry.description,
              'category': entry.category,
              'amount': entry.amount,
              'date': DateTime.parse(entry.date),
              'receiptUrl': receiptUrl ?? '',
              'createdAt': FieldValue.serverTimestamp(),
            });

        await _box!.delete(entry.id);
        print('✅ Synced successfully: ${entry.id}');
      } catch (e, stackTrace) {
        print('❌ Error syncing ${entry.id}: $e\nStackTrace: $stackTrace');
        continue;
      }
    }
  }

  /// Delete an entry from local cache manually (if needed)
  static Future<void> delete(String id) async {
    await _box?.delete(id);
    print('🗑️ Deleted locally: $id');
  }
}
