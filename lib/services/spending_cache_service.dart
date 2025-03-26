import 'package:hive/hive.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'dart:io';
import '../data/models/spending_entry.dart';

class SpendingCacheService {
  static const _boxName = 'spending_cache';

  /// Initialize Hive box
  static Future<void> init() async {
    if (!Hive.isAdapterRegistered(0)) {
      Hive.registerAdapter(SpendingEntryAdapter());
    }
    await Hive.openBox<SpendingEntry>(_boxName);
  }

  /// Save locally when offline or Firebase fails
  static Future<void> saveLocally(SpendingEntry entry) async {
    final box = Hive.box<SpendingEntry>(_boxName);
    await box.put(entry.id, entry);
  }

  /// Get unsynced entries
  static List<SpendingEntry> getUnsyncedEntries() {
    final box = Hive.box<SpendingEntry>(_boxName);
    return box.values.toList();
  }

  /// Sync all unsynced spendings to Firestore
  static Future<void> syncToFirestore() async {
    final box = Hive.box<SpendingEntry>(_boxName);
    final entries = box.values.toList();

    for (var entry in entries) {
      try {
        // Upload receipt image
        final receiptRef = FirebaseStorage.instance
            .ref()
            .child('receipts')
            .child('${entry.id}.jpg');

        final file = File(entry.localImagePath!);
        await receiptRef.putFile(file);
        final receiptUrl = await receiptRef.getDownloadURL();

        // Save to Firestore
        await FirebaseFirestore.instance
            .collection('spendings')
            .doc(entry.id)
            .set({
              'description': entry.description,
              'category': entry.category,
              'amount': entry.amount,
              'date': DateTime.parse(entry.date),
              'receiptUrl': receiptUrl,
              'createdAt': FieldValue.serverTimestamp(),
            });

        // Delete local copy if synced
        await box.delete(entry.id);
      } catch (e) {
        print('❌ Sync failed for ${entry.id}: $e');
        continue;
      }
    }
  }

  /// Delete a local cache entry (optional use)
  static Future<void> delete(String id) async {
    final box = Hive.box<SpendingEntry>(_boxName);
    await box.delete(id);
  }
}
