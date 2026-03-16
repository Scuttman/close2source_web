import 'package:cloud_firestore/cloud_firestore.dart';

/// Simple one-off migration helper you can run from a debug button / dev screen.
/// Responsibilities:
/// 1. Ensure each projectAccount has currentBalance (if missing => openingBalance).
/// 2. Ensure accountType exists (default 'bank').
/// 3. (Optional heavier) Recompute currentBalance from transactions if [recomputeBalances] true.
///    This iterates transactions chronologically and sums effects.
class FinanceMigrationTool {
  FinanceMigrationTool._();
  static final instance = FinanceMigrationTool._();
  final _db = FirebaseFirestore.instance;

  Future<void> run({bool recomputeBalances = false}) async {
    final batch = _db.batch();
    final accounts = await _db.collection('projectAccounts').get();
    for (final a in accounts.docs) {
      final data = a.data();
      bool needsUpdate = false;
      final update = <String, dynamic>{};
      if (!data.containsKey('currentBalance')) {
        update['currentBalance'] = (data['openingBalance'] is num) ? (data['openingBalance'] as num).toDouble() : 0.0;
        needsUpdate = true;
      }
      if (!data.containsKey('accountType')) {
        update['accountType'] = 'bank';
        needsUpdate = true;
      }
      if (needsUpdate) {
        batch.update(a.reference, update);
      }
    }
    await batch.commit();

    if (recomputeBalances) {
      // Recompute by project so we don't hold too many docs in memory globally.
      final projectGroups = <String, List<QueryDocumentSnapshot<Map<String, dynamic>>>>{};
      for (final a in accounts.docs) {
        final pid = (a.data()['projectId'] ?? '').toString();
        projectGroups.putIfAbsent(pid, () => []).add(a);
      }
      for (final entry in projectGroups.entries) {
        final projectId = entry.key;
        final accDocs = entry.value;
        final txSnap = await _db
            .collection('projectTransactions')
            .where('projectId', isEqualTo: projectId)
            .orderBy('effectiveDate')
            .get();
        final balances = <String, double>{};
        // seed with opening/current
        for (final a in accDocs) {
          final data = a.data();
            balances[a.id] = (data['openingBalance'] is num)
                ? (data['openingBalance'] as num).toDouble()
                : 0.0;
        }
        for (final t in txSnap.docs) {
          final d = t.data();
          final type = (d['type'] ?? '').toString();
          if (d['reversed'] == true) continue; // ignore reversed for current balance snapshot
          final primary = (d['primaryAccountId'] ?? '').toString();
          final secondary = (d['secondaryAccountId'] ?? '').toString();
          final amount = (d['amount'] is num) ? (d['amount'] as num).toDouble() : 0.0;
          final secondaryAmount = (d['secondaryAmount'] is num) ? (d['secondaryAmount'] as num).toDouble() : null;
          balances.putIfAbsent(primary, () => 0);
          switch (type) {
            case 'income':
              balances[primary] = (balances[primary] ?? 0) + amount;
              break;
            case 'expense':
              balances[primary] = (balances[primary] ?? 0) - amount;
              break;
            case 'transfer':
              balances[primary] = (balances[primary] ?? 0) - amount;
              if (secondary.isNotEmpty) {
                balances.putIfAbsent(secondary, () => 0);
                if (secondaryAmount != null) {
                  balances[secondary] = (balances[secondary] ?? 0) + secondaryAmount;
                }
              }
              break;
          }
        }
        final b2 = _db.batch();
        for (final a in accDocs) {
          if (balances.containsKey(a.id)) {
            b2.update(a.reference, {'currentBalance': balances[a.id]});
          }
        }
        await b2.commit();
      }
    }
  }
}
