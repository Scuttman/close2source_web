import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class OrganizationService {
  OrganizationService._();
  static final instance = OrganizationService._();
  final _db = FirebaseFirestore.instance;

  Future<String> generateUniqueOrganizationCode({int attempts = 10}) async {
    for (int i = 0; i < attempts; i++) {
      final code = _generateCode();
      final snap = await _db
          .collection('organizations')
          .where('orgId', isEqualTo: code)
          .limit(1)
          .get();
      if (snap.docs.isEmpty) return code;
    }
    throw Exception('Could not generate a unique organization code. Please try again.');
  }

  String _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final rnd = Random.secure();
    String body = List.generate(7, (_) => chars[rnd.nextInt(chars.length)]).join();
    return 'O-$body';
  }

  Future<DocumentReference<Map<String, dynamic>>> createOrganizationProfile({
    required String name,
    String? bio,
    String? website,
    String? contactEmail,
    String? contactNumber,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not signed in');
    final orgId = await generateUniqueOrganizationCode();
    final ref = _db.collection('organizations').doc();
    final now = FieldValue.serverTimestamp();
    await ref.set({
      'name': name,
      'bio': bio ?? '',
      'orgId': orgId,
      'ownerUid': user.uid,
      'teamUids': [user.uid],
      if ((website ?? '').isNotEmpty) 'website': (website ?? '').trim(),
      if ((contactEmail ?? '').isNotEmpty) 'contactEmail': (contactEmail ?? '').trim(),
      if ((contactNumber ?? '').isNotEmpty) 'contactNumber': (contactNumber ?? '').trim(),
      'createdAt': now,
      'updatedAt': now,
    });
    return ref;
  }

  /// Link current user to an existing organization by its org code (e.g., O-XXXXXXX).
  /// Adds the user to teamUids array. No-op if already a member.
  Future<void> linkOrganizationByCode(String code) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not signed in');
    final normalized = code.trim().toUpperCase();
    final qs = await _db
        .collection('organizations')
        .where('orgId', isEqualTo: normalized)
        .limit(1)
        .get();
    if (qs.docs.isEmpty) throw Exception('Organization not found');
    final ref = qs.docs.first.reference;
    await ref.update({
      'teamUids': FieldValue.arrayUnion([user.uid]),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }
}
