import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class BudgetCategory {
  final String id;
  final String profileId;
  final String name;
  final String type; // income | expense | transfer
  final double amount; // planned budget amount
  final int order;
  final bool active;
  final String currency; // ISO 4217 (e.g., USD, GBP)
  final Timestamp? createdAt;
  final Timestamp? updatedAt;
  final String? createdBy;

  const BudgetCategory({
    required this.id,
    required this.profileId,
    required this.name,
    required this.type,
    required this.amount,
    required this.order,
    required this.active,
    required this.currency,
    this.createdAt,
    this.updatedAt,
    this.createdBy,
  });

  factory BudgetCategory.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    return BudgetCategory(
      id: doc.id,
      profileId: (d['profileId'] ?? '').toString(),
      name: (d['name'] ?? '').toString(),
      type: (d['type'] ?? 'expense').toString(),
      amount: (d['amount'] is num) ? (d['amount'] as num).toDouble() : 0.0,
      order: (d['order'] is num) ? (d['order'] as num).toInt() : 0,
      active: d['active'] == true,
      currency: (d['currency'] ?? '').toString(),
      createdAt: d['createdAt'] is Timestamp ? d['createdAt'] as Timestamp : null,
      updatedAt: d['updatedAt'] is Timestamp ? d['updatedAt'] as Timestamp : null,
      createdBy: (d['createdBy'] ?? '').toString().isNotEmpty ? (d['createdBy'] ?? '').toString() : null,
    );
  }

  Map<String, dynamic> toMap() => {
        'profileId': profileId,
        'name': name,
        'type': type,
        'amount': amount,
        'order': order,
        'active': active,
    'currency': currency,
        if (createdAt != null) 'createdAt': createdAt,
        if (updatedAt != null) 'updatedAt': updatedAt,
        if (createdBy != null) 'createdBy': createdBy,
      };
}

class BudgetService {
  BudgetService._();
  static final instance = BudgetService._();

  final _db = FirebaseFirestore.instance;

  CollectionReference<Map<String, dynamic>> _cats(String profileId) => _db.collection('profiles').doc(profileId).collection('budgetCategories');

  Stream<List<BudgetCategory>> watchCategories(String profileId, {String? type}) {
    Query<Map<String, dynamic>> q = _cats(profileId).where('active', isEqualTo: true).orderBy('order');
    if (type != null) q = q.where('type', isEqualTo: type);
    return q.snapshots().map((s) => s.docs.map(BudgetCategory.fromDoc).toList());
  }

  Future<void> upsertCategory({
    required String profileId,
    String? id,
    required String name,
    required String type,
    required double amount,
    required String currency,
    int? order,
    bool active = true,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not signed in');
    final now = FieldValue.serverTimestamp();
    if (id == null) {
      // Create
      final ref = _cats(profileId).doc();
      await ref.set({
        'profileId': profileId,
        'name': name.trim(),
        'type': (type == 'income') ? 'income' : (type == 'transfer') ? 'transfer' : 'expense',
        'amount': amount,
        'order': order ?? 0,
        'active': active,
        'currency': currency.trim().toUpperCase(),
        'createdAt': now,
        'updatedAt': now,
        'createdBy': user.uid,
      });
    } else {
      await _cats(profileId).doc(id).update({
        'name': name.trim(),
        'type': (type == 'income') ? 'income' : (type == 'transfer') ? 'transfer' : 'expense',
        'amount': amount,
        if (order != null) 'order': order,
        'active': active,
        'currency': currency.trim().toUpperCase(),
        'updatedAt': now,
      });
    }
  }

  Future<void> deleteCategory({required String profileId, required String id}) async {
    await _cats(profileId).doc(id).delete();
  }

  Future<void> reorder({required String profileId, required List<BudgetCategory> categories}) async {
    final batch = _db.batch();
    for (int i = 0; i < categories.length; i++) {
      batch.update(_cats(profileId).doc(categories[i].id), {'order': i, 'updatedAt': FieldValue.serverTimestamp()});
    }
    await batch.commit();
  }
}
