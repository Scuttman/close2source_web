import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';

class IndividualService {
  IndividualService._();
  static final instance = IndividualService._();
  final _db = FirebaseFirestore.instance;

  Future<String> generateUniqueIndividualCode({int attempts = 10}) async {
    for (int i = 0; i < attempts; i++) {
      final code = _generateCode();
      final snap = await _db
          .collection('individuals')
          .where('individualId', isEqualTo: code)
          .limit(1)
          .get();
      if (snap.docs.isEmpty) return code;
    }
    throw Exception('Could not generate a unique individual code. Please try again.');
  }

  String _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final rnd = Random.secure();
    String body = List.generate(7, (_) => chars[rnd.nextInt(chars.length)]).join();
    return 'I-$body';
  }

  Future<DocumentReference<Map<String,dynamic>>> createIndividualProfile({
    required String ownerUid,
    required String name,
  }) async {
    final code = await generateUniqueIndividualCode();
    final ref = _db.collection('individuals').doc();
    await ref.set({
      'id': ref.id,
      'individualId': code,
      'ownerUid': ownerUid,
      'name': name,
      'bio': '',
      'photoURL': '',
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    return ref;
  }

  Future<DocumentReference<Map<String,dynamic>>> linkIndividualByCode({
    required String code,
    required String userUid,
  }) async {
    final q = await _db.collection('individuals').where('individualId', isEqualTo: code).limit(1).get();
    if (q.docs.isEmpty) {
      throw Exception('No profile found for that code.');
    }
    final ref = q.docs.first.reference;
    await _db.runTransaction((tx) async {
      final snap = await tx.get(ref);
      if (!snap.exists) throw Exception('Profile not found.');
      final data = snap.data() as Map<String,dynamic>;
      final currentOwner = (data['ownerUid'] ?? '').toString();
      if (currentOwner.isEmpty || currentOwner == userUid) {
        tx.update(ref, {
          'ownerUid': userUid,
          'updatedAt': FieldValue.serverTimestamp(),
        });
      } else {
        throw Exception('This profile is already owned by another account.');
      }
    });
    return ref;
  }
}
