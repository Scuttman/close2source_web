import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:rxdart/rxdart.dart';
import 'finance_models.dart';

class ProjectFinanceService {
  ProjectFinanceService._();
  static final instance = ProjectFinanceService._();

  final _db = FirebaseFirestore.instance;

  // Profile-scoped collections (new structure)
  CollectionReference<Map<String, dynamic>> _profileAccounts(String profileId) => _db.collection('profiles').doc(profileId).collection('accounts');
  CollectionReference<Map<String, dynamic>> _profileTransactions(String profileId) => _db.collection('profiles').doc(profileId).collection('profileTransactions');
  CollectionReference<Map<String, dynamic>> _profileReceiptMeta(String profileId, String txId) => _profileTransactions(profileId).doc(txId).collection('receipts');

  // LEGACY root collections were removed; all operations are now profile-scoped.

  String _genId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final r = Random.secure();
    return List.generate(10, (_) => chars[r.nextInt(chars.length)]).join();
  }

  Future<String> createAccount({
    required String profileId,
    required String name,
    required String currency,
    required String accountType, // 'bank' | 'mobileMoney' | 'cash'
    double openingBalance = 0,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not signed in');
    if (name.trim().isEmpty) throw Exception('Account name required');
    if (currency.trim().isEmpty) throw Exception('Currency required');
    final ref = _profileAccounts(profileId).doc();
    final now = FieldValue.serverTimestamp();
    await ref.set({
      'profileId': profileId,
      'name': name.trim(),
      'currency': currency.trim().toUpperCase(),
    'accountType': (accountType == 'mobileMoney')
      ? 'mobileMoney'
      : (accountType == 'cash')
        ? 'cash'
        : 'bank',
      'openingBalance': openingBalance,
  'currentBalance': openingBalance,
      'archived': false,
      'createdAt': now,
      'updatedAt': now,
      'createdBy': user.uid,
    });
    return ref.id;
  }

  Stream<List<ProjectAccount>> watchAccounts(String profileId) {
    return _profileAccounts(profileId).where('archived', isEqualTo: false).snapshots().map(
      (snap) => snap.docs.map(ProjectAccount.fromDoc).toList(),
    );
  }

  Future<void> archiveAccount({required String profileId, required String accountId}) async {
    await _profileAccounts(profileId).doc(accountId).update({'archived': true, 'updatedAt': FieldValue.serverTimestamp()});
  }

  Future<ProjectTransaction> createIncome({
    required String profileId,
    required String accountId,
    required double amount,
    required String category,
    String? description,
    String? counterpartyName,
    String? counterpartyContact,
    DateTime? effectiveDate,
  }) async => _createTransaction(
        profileId: profileId,
        type: ProjectTransactionType.income,
        primaryAccountId: accountId,
        amount: amount,
        category: category,
        description: description,
        counterpartyName: counterpartyName,
        counterpartyContact: counterpartyContact,
        effectiveDate: effectiveDate,
      );

  Future<ProjectTransaction> createExpense({
    required String profileId,
    required String accountId,
    required double amount,
    required String category,
    String? description,
    String? counterpartyName,
    String? counterpartyContact,
    DateTime? effectiveDate,
  }) async => _createTransaction(
        profileId: profileId,
        type: ProjectTransactionType.expense,
        primaryAccountId: accountId,
        amount: amount,
        category: category,
        description: description,
        counterpartyName: counterpartyName,
        counterpartyContact: counterpartyContact,
        effectiveDate: effectiveDate,
      );

  Future<ProjectTransaction> createTransfer({
    required String profileId,
    required String fromAccountId,
    required String toAccountId,
    required double amount,
    double? secondaryAmount,
    String? description,
    String? counterpartyName,
    String? counterpartyContact,
    DateTime? effectiveDate,
  }) async {
    if (fromAccountId == toAccountId) {
      throw Exception('Cannot transfer to the same account');
    }
    // Fetch accounts (with error classification)
    DocumentSnapshot<Map<String, dynamic>> fromSnap;
    DocumentSnapshot<Map<String, dynamic>> toSnap;
    try {
      fromSnap = await _profileAccounts(profileId).doc(fromAccountId).get();
    } on FirebaseException catch (fe) {
      // ignore: avoid_print
      print('[FINANCE][ERR] read primary account permission/code=${fe.code} message=${fe.message}');
      rethrow;
    }
    try {
      toSnap = await _profileAccounts(profileId).doc(toAccountId).get();
    } on FirebaseException catch (fe) {
      // ignore: avoid_print
      print('[FINANCE][ERR] read secondary account permission/code=${fe.code} message=${fe.message}');
      rethrow;
    }
    // Debug logging
    // ignore: avoid_print
    print('[FINANCE] createTransfer fetch accounts from=$fromAccountId to=$toAccountId existsFrom=${fromSnap.exists} existsTo=${toSnap.exists}');
    if (!fromSnap.exists || !toSnap.exists) throw Exception('Account not found');
  final fromAcc = ProjectAccount.fromDoc(fromSnap);
  final toAcc = ProjectAccount.fromDoc(toSnap);
  double? rate;
    double? secAmt = secondaryAmount;
    if (fromAcc.currency == toAcc.currency) {
      secAmt = amount; // same currency
      rate = 1.0;
    } else {
      if (secAmt == null || secAmt <= 0) {
        throw Exception('Provide the amount in the target currency');
      }
      rate = secAmt / amount;
    }
  // ignore: avoid_print
  print('[FINANCE] createTransfer currencies from=${fromAcc.currency} to=${toAcc.currency} secAmt=$secAmt rate=$rate');
  // ignore: avoid_print
  print('[FINANCE] createTransfer deciding payload profile=$profileId type=transfer primary=$fromAccountId secondary=$toAccountId amount=$amount secondaryAmount=$secAmt primaryCurrency=${fromAcc.currency} secondaryCurrency=${toAcc.currency} rate=$rate');
  return _createTransaction(
      profileId: profileId,
      type: ProjectTransactionType.transfer,
      primaryAccountId: fromAccountId,
      secondaryAccountId: toAccountId,
      amount: amount,
      secondaryAmount: secAmt,
      category: 'Transfer',
      description: description,
      effectiveDate: effectiveDate,
      primaryCurrency: fromAcc.currency,
      secondaryCurrency: toAcc.currency,
      rateDerived: rate,
    );
  }

  Future<ProjectTransaction> _createTransaction({
    required String profileId,
    required ProjectTransactionType type,
    required String primaryAccountId,
    required double amount,
    required String category,
    String? description,
    String? counterpartyName,
    String? counterpartyContact,
    DateTime? effectiveDate,
    String? secondaryAccountId,
    double? secondaryAmount,
    String? primaryCurrency,
    String? secondaryCurrency,
    double? rateDerived,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not signed in');
    if (amount <= 0) throw Exception('Amount must be > 0');
    final id = _genId();
    final now = FieldValue.serverTimestamp();
    // fetch currency if not provided
    String currency = primaryCurrency ?? '';
    if (currency.isEmpty) {
      final acc = await _profileAccounts(profileId).doc(primaryAccountId).get();
      if (!acc.exists) throw Exception('Primary account missing');
      currency = (acc.data()?['currency'] ?? '').toString();
    }

	final txRef = _profileTransactions(profileId).doc(id);
  // ignore: avoid_print
  print('[FINANCE] _createTransaction start id=$id profile=$profileId type=${type.name} primary=$primaryAccountId secondary=$secondaryAccountId amount=$amount secondaryAmount=$secondaryAmount currency=$currency secondaryCurrency=$secondaryCurrency rate=$rateDerived category=$category');
    // Read current balances from cache/server for validation, then perform batched increments for offline-first
    final primaryRef = _profileAccounts(profileId).doc(primaryAccountId);
    final primarySnap = await primaryRef.get();
    if (!primarySnap.exists) {
      throw Exception('Primary account missing');
    }
    final primaryData = primarySnap.data() as Map<String, dynamic>;
    // ignore: avoid_print
    print('[FINANCE] primaryAccount snapshot: ${primaryData.toString()}');
    final double primaryCurrent = (primaryData['currentBalance'] is num)
        ? (primaryData['currentBalance'] as num).toDouble()
        : (primaryData['openingBalance'] is num)
            ? (primaryData['openingBalance'] as num).toDouble()
            : 0.0;

  DocumentReference<Map<String, dynamic>>? secondaryRef;
    if (type == ProjectTransactionType.transfer && secondaryAccountId != null) {
      secondaryRef = _profileAccounts(profileId).doc(secondaryAccountId);
      final secSnap = await secondaryRef.get();
      if (!secSnap.exists) throw Exception('Secondary account missing');
    final sd = secSnap.data() as Map<String, dynamic>;
      // ignore: avoid_print
      print('[FINANCE] secondaryAccount snapshot: ${sd.toString()}');
    // Read ensures existence; actual delta uses FieldValue.increment for offline support.
    }

    // Compute deltas and basic validation
    double primaryDelta = 0;
    double? secondaryDelta;
    switch (type) {
      case ProjectTransactionType.income:
        primaryDelta = amount;
        break;
      case ProjectTransactionType.expense:
        primaryDelta = -amount;
        break;
      case ProjectTransactionType.transfer:
        primaryDelta = -amount;
        if (secondaryAmount != null) secondaryDelta = secondaryAmount;
        break;
    }
    final prospectivePrimary = primaryCurrent + primaryDelta;
    if (prospectivePrimary < 0) {
      throw Exception('Insufficient funds');
    }

    final writePayload = {
      'profileId': profileId,
      'type': type.name,
      'primaryAccountId': primaryAccountId,
      if (secondaryAccountId != null) 'secondaryAccountId': secondaryAccountId,
      'amount': amount,
      if (secondaryAmount != null) 'secondaryAmount': secondaryAmount,
      'currency': currency,
      if (secondaryCurrency != null) 'secondaryCurrency': secondaryCurrency,
      'category': category,
      if (description != null && description.trim().isNotEmpty) 'description': description.trim(),
      if (counterpartyName != null && counterpartyName.trim().isNotEmpty) 'counterpartyName': counterpartyName.trim(),
      if (counterpartyContact != null && counterpartyContact.trim().isNotEmpty) 'counterpartyContact': counterpartyContact.trim(),
      'effectiveDate': effectiveDate != null ? Timestamp.fromDate(effectiveDate) : Timestamp.now(),
      if (rateDerived != null) 'rateDerived': rateDerived,
      'receiptCount': 0,
      'receiptRefs': const <String>[],
      'reversed': false,
      'createdAt': now,
      'updatedAt': now,
      'createdBy': user.uid,
    };
    // ignore: avoid_print
    print('[FINANCE] transaction write payload: ${writePayload.toString()}');

    final batch = _db.batch();
    batch.set(txRef, writePayload);
    batch.update(primaryRef, {
      'currentBalance': FieldValue.increment(primaryDelta),
      'updatedAt': now,
    });
    if (secondaryRef != null && secondaryDelta != null) {
      batch.update(secondaryRef, {
        'currentBalance': FieldValue.increment(secondaryDelta),
        'updatedAt': now,
      });
    }
    await batch.commit();
    // Build object for optimistic usage
    return ProjectTransaction(
      id: id,
      profileId: profileId,
      type: type,
      primaryAccountId: primaryAccountId,
      secondaryAccountId: secondaryAccountId,
      amount: amount,
      secondaryAmount: secondaryAmount,
      currency: currency,
      secondaryCurrency: secondaryCurrency,
      category: category,
      description: description,
      effectiveDate: Timestamp.fromDate(effectiveDate ?? DateTime.now()),
      rateDerived: rateDerived,
      receiptCount: 0,
      receiptRefs: const [],
      reversed: false,
      createdAt: null,
      updatedAt: null,
      createdBy: FirebaseAuth.instance.currentUser?.uid,
    );
  }

  Stream<List<ProjectTransaction>> watchProfileTransactions(String profileId, {int? limit}) {
	Query<Map<String, dynamic>> q = _profileTransactions(profileId)
		.orderBy('effectiveDate', descending: true)
		.orderBy('createdAt', descending: true);
    if (limit != null) q = q.limit(limit);
    return q.snapshots().map((s) => s.docs.map(ProjectTransaction.fromDoc).toList());
  }

  Stream<List<ProjectTransaction>> watchAccountTransactions(String profileId, String accountId) {
    // Combine primary + secondary streams and include metadata changes so pending writes appear immediately
    final primary = _profileTransactions(profileId)
        .where('primaryAccountId', isEqualTo: accountId)
        .orderBy('effectiveDate', descending: true)
        .snapshots(includeMetadataChanges: true);
    final secondary = _profileTransactions(profileId)
        .where('secondaryAccountId', isEqualTo: accountId)
        .orderBy('effectiveDate', descending: true)
        .snapshots(includeMetadataChanges: true);

    return Rx.combineLatest2<QuerySnapshot<Map<String, dynamic>>, QuerySnapshot<Map<String, dynamic>>, List<ProjectTransaction>>(
      primary,
      secondary,
      (pSnap, sSnap) {
        final map = <String, ProjectTransaction>{};
        for (final d in pSnap.docs) {
          map[d.id] = ProjectTransaction.fromDoc(d);
        }
        for (final d in sSnap.docs) {
          map[d.id] = ProjectTransaction.fromDoc(d);
        }
        final list = map.values.toList()
          ..sort((a, b) => b.effectiveDate.compareTo(a.effectiveDate));
        return list;
      },
    );
  }

  Future<void> reverseTransaction({required String profileId, required String transactionId}) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not signed in');
    final txDoc = await _profileTransactions(profileId).doc(transactionId).get();
    if (!txDoc.exists) throw Exception('Transaction not found');
    final data = txDoc.data()!;
    if (data['reversed'] == true) throw Exception('Already reversed');
    final typeStr = (data['type'] ?? '').toString();
    ProjectTransactionType type;
    switch (typeStr) {
      case 'expense':
        type = ProjectTransactionType.expense; break;
      case 'transfer':
        type = ProjectTransactionType.transfer; break;
      default:
        type = ProjectTransactionType.income; break;
    }
    final primaryId = (data['primaryAccountId'] ?? '').toString();
    final secondaryId = (data['secondaryAccountId'] ?? '').toString().isNotEmpty ? (data['secondaryAccountId'] ?? '').toString() : null;
    final amount = (data['amount'] is num) ? (data['amount'] as num).toDouble() : 0.0;
    final secondaryAmount = (data['secondaryAmount'] is num) ? (data['secondaryAmount'] as num).toDouble() : null;

    await _db.runTransaction((t) async {
      final primaryRef = _profileAccounts(profileId).doc(primaryId);
      final primarySnap = await t.get(primaryRef);
      if (!primarySnap.exists) throw Exception('Primary account missing');
      final pData = primarySnap.data() as Map<String, dynamic>;
      final pBal = (pData['currentBalance'] is num) ? (pData['currentBalance'] as num).toDouble() : 0.0;
      DocumentReference<Map<String, dynamic>>? secondaryRef;
      double? sBal;
      if (type == ProjectTransactionType.transfer && secondaryId != null) {
        secondaryRef = _profileAccounts(profileId).doc(secondaryId);
        final sSnap = await t.get(secondaryRef);
        if (!sSnap.exists) throw Exception('Secondary account missing');
        final sData = sSnap.data() as Map<String, dynamic>;
        sBal = (sData['currentBalance'] is num) ? (sData['currentBalance'] as num).toDouble() : 0.0;
      }
      double newPrimary = pBal;
      double? newSecondary = sBal;
      switch (type) {
        case ProjectTransactionType.income:
          newPrimary = pBal - amount;
          break;
        case ProjectTransactionType.expense:
          newPrimary = pBal + amount;
          break;
        case ProjectTransactionType.transfer:
          newPrimary = pBal + amount; // undo earlier subtraction
          if (secondaryRef != null && sBal != null && secondaryAmount != null) {
            newSecondary = sBal - secondaryAmount; // undo earlier addition
          }
          break;
      }
      if (newPrimary < 0) throw Exception('Reversal would overdraw primary');
      t.update(primaryRef, {'currentBalance': newPrimary, 'updatedAt': FieldValue.serverTimestamp()});
      if (secondaryRef != null && newSecondary != null) {
        if (newSecondary < 0) throw Exception('Reversal would overdraw secondary');
        t.update(secondaryRef, {'currentBalance': newSecondary, 'updatedAt': FieldValue.serverTimestamp()});
      }
      t.update(_profileTransactions(profileId).doc(transactionId), {'reversed': true, 'updatedAt': FieldValue.serverTimestamp()});
    });
  }

  /// Attach receipt metadata after images uploaded. Uses transaction to increment counters.
  Future<void> attachReceipts({
    required String transactionId,
    required String profileId,
    required List<UploadedReceipt> uploads,
  }) async {
    if (uploads.isEmpty) return;
    await _db.runTransaction((t) async {
      final txRef = _profileTransactions(profileId).doc(transactionId);
      final snap = await t.get(txRef);
      if (!snap.exists) throw Exception('Transaction missing');
      final data = snap.data() as Map<String, dynamic>;
      if (data['profileId'] != profileId) throw Exception('Profile mismatch');
      final existingRefs = (data['receiptRefs'] is List) ? List<String>.from(data['receiptRefs']) : <String>[];
      final newRefs = List<String>.from(existingRefs);
      for (final u in uploads) {
        newRefs.add(u.storagePath);
        final metaRef = _profileReceiptMeta(profileId, transactionId).doc();
        t.set(metaRef, {
          'profileId': profileId,
          'transactionId': transactionId,
          'storagePath': u.storagePath,
          'width': u.width,
          'height': u.height,
          'mimeType': u.mimeType,
          'uploadedAt': FieldValue.serverTimestamp(),
        });
      }
      t.update(txRef, {
        'receiptCount': newRefs.length,
        'receiptRefs': newRefs,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    });
  }

  /// Update roles for a profile member (Owner/Admin only should be allowed by rules)
  Future<void> setProfileMemberRoles({
    required String profileId,
    required String memberUid,
    required List<String> roles, // e.g., ['Admin','Finance']
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Not signed in');
    final doc = _db.collection('profiles').doc(profileId).collection('members').doc(memberUid);
    // Fetch denormalized fields from users/{uid}
    String? name;
    String? surname;
    String? displayName;
    String? email;
    String? photoURL;
    try {
      final uSnap = await _db.collection('users').doc(memberUid).get();
      if (uSnap.exists) {
        final data = uSnap.data();
        if (data != null) {
          name = (data['name'] ?? '').toString().trim();
          surname = (data['surname'] ?? '').toString().trim();
          displayName = (data['displayName'] ?? '').toString().trim();
          email = (data['email'] ?? '').toString().trim();
          final p = (data['photoURL'] ?? '').toString().trim();
          if (p.isNotEmpty) photoURL = p;
        }
      }
    } catch (_) {
      // Ignore fetch errors; we'll still write roles
    }
    // Build best-effort name
    String? full;
    final parts = <String>[if ((name ?? '').isNotEmpty) name!, if ((surname ?? '').isNotEmpty) surname!];
    if (parts.isNotEmpty) {
      full = parts.join(' ');
    } else if ((displayName ?? '').isNotEmpty) {
      full = displayName;
    }

    final payload = <String, dynamic>{
      'roles': roles,
      'updatedAt': FieldValue.serverTimestamp(),
      'updatedBy': user.uid,
      if (full != null && full.isNotEmpty) 'displayName': full,
  if (email != null && email.isNotEmpty) 'email': email,
  if (photoURL != null && photoURL.isNotEmpty) 'photoURL': photoURL,
      // Raw fields to help future updates
      if ((name ?? '').isNotEmpty) 'name': name,
      if ((surname ?? '').isNotEmpty) 'surname': surname,
    };
    await doc.set(payload, SetOptions(merge: true));
  }
}

class UploadedReceipt {
  final String storagePath;
  final int? width;
  final int? height;
  final String? mimeType;
  UploadedReceipt({required this.storagePath, this.width, this.height, this.mimeType});
}
