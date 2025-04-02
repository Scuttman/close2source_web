import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import '../data/models/profile.dart';
import '../data/models/spending_entry.dart';

class SpendingSyncService {
  final _firestore = FirebaseFirestore.instance;
  final _storage = FirebaseStorage.instance;

  Future<void> syncPendingTransactions() async {
    try {
      final profilesSnapshot = await _firestore
          .collection('Profiles')
          .get(const GetOptions(source: Source.cache));

      for (final doc in profilesSnapshot.docs) {
        final profile = Profile.fromFirestore(doc);
        final updatedTransactions = <SpendingEntry>[];

        bool hasChanges = false;

        for (final tx in profile.transactionList) {
          if (tx.isUploaded == true) {
            updatedTransactions.add(tx);
            continue;
          }

          final newUrls = <String>[];

          for (final path in tx.receiptImages) {
            if (!path.startsWith('http')) {
              final file = File(path);
              if (await file.exists()) {
                final fileName = path.split('/').last;
                final ref = _storage.ref().child(
                "/AppUsers/Close2Source/ProjectImages/$fileName");
                await ref.putFile(file);
                final url = await ref.getDownloadURL();
                newUrls.add(url);
              }
            } else {
              newUrls.add(path); // already uploaded
            }
          }

          updatedTransactions.add(SpendingEntry(
            id: tx.id,
            description: tx.description,
            category: tx.category,
            amount: tx.amount,
            date: tx.date,
            receiptImages: newUrls,
            isUploaded: true,
            profileId: profile.profileId,
          ));

          hasChanges = true;
        }

        if (hasChanges) {
          await _firestore.collection('Profiles').doc(profile.profileId).update({
            'transactionList': updatedTransactions.map((e) => e.toJson()).toList(),
            'lastUpdated': FieldValue.serverTimestamp(),
          });

          print('✅ Synced transactions for profile ${profile.profileId}');
        }
      }
    } catch (e) {
      print('❌ Error during sync: $e');
    }
  }
}