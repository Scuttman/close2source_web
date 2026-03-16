import 'package:cloud_firestore/cloud_firestore.dart';

enum ProjectTransactionType { income, expense, transfer }

class ProjectAccount {
  final String id;
  final String profileId; // formerly projectId
  final String name;
  final String currency; // ISO 4217
  final String accountType; // 'bank' | 'mobileMoney'
  final double openingBalance;
  final double? currentBalance; // denormalized current balance for fast display
  final bool archived;
  final int? sortOrder;
  final Timestamp? createdAt;
  final Timestamp? updatedAt;
  final String? createdBy;

  ProjectAccount({
    required this.id,
    required this.profileId,
    required this.name,
    required this.currency,
    required this.accountType,
    required this.openingBalance,
  this.currentBalance,
    required this.archived,
    this.sortOrder,
    this.createdAt,
    this.updatedAt,
    this.createdBy,
  });

  factory ProjectAccount.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    return ProjectAccount(
      id: doc.id,
      profileId: (d['profileId'] ?? d['projectId'] ?? '').toString(),
      name: (d['name'] ?? '').toString(),
      currency: (d['currency'] ?? '').toString(),
      accountType: (d['accountType'] ?? 'bank').toString(),
      openingBalance: (d['openingBalance'] is num) ? (d['openingBalance'] as num).toDouble() : 0,
  currentBalance: (d['currentBalance'] is num) ? (d['currentBalance'] as num).toDouble() : null,
      archived: d['archived'] == true,
      sortOrder: (d['sortOrder'] is num) ? (d['sortOrder'] as num).toInt() : null,
      createdAt: d['createdAt'] is Timestamp ? d['createdAt'] as Timestamp : null,
      updatedAt: d['updatedAt'] is Timestamp ? d['updatedAt'] as Timestamp : null,
      createdBy: (d['createdBy'] ?? '').toString().isNotEmpty ? (d['createdBy'] ?? '').toString() : null,
    );
  }

  Map<String, dynamic> toMap() => {
  'profileId': profileId,
        'name': name,
        'currency': currency,
        'accountType': accountType,
        'openingBalance': openingBalance,
  if (currentBalance != null) 'currentBalance': currentBalance,
        'archived': archived,
        if (sortOrder != null) 'sortOrder': sortOrder,
        if (createdAt != null) 'createdAt': createdAt,
        if (updatedAt != null) 'updatedAt': updatedAt,
        if (createdBy != null) 'createdBy': createdBy,
      };
}

class ProjectTransaction {
  final String id;
  final String profileId; // formerly projectId
  final ProjectTransactionType type;
  final String primaryAccountId;
  final String? secondaryAccountId; // for transfer target
  final double amount; // amount in primary account currency
  final double? secondaryAmount; // amount in secondary account currency (transfers)
  final String currency; // primary currency
  final String? secondaryCurrency;
  final String category;
  final String? description;
  final String? counterpartyName; // vendor / donor / customer
  final String? counterpartyContact; // phone or other contact info
  final Timestamp effectiveDate;
  final double? rateDerived; // secondaryAmount/amount for cross-currency transfer
  final int receiptCount;
  final List<String> receiptRefs;
  final bool reversed;
  final Timestamp? createdAt;
  final Timestamp? updatedAt;
  final String? createdBy;

  ProjectTransaction({
    required this.id,
    required this.profileId,
    required this.type,
    required this.primaryAccountId,
    required this.amount,
    required this.currency,
    required this.category,
    required this.effectiveDate,
    required this.receiptCount,
    required this.receiptRefs,
    required this.reversed,
    this.secondaryAccountId,
    this.secondaryAmount,
    this.secondaryCurrency,
    this.description,
    this.counterpartyName,
    this.counterpartyContact,
    this.rateDerived,
    this.createdAt,
    this.updatedAt,
    this.createdBy,
  });

  factory ProjectTransaction.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    ProjectTransactionType parseType(String v) {
      switch (v) {
        case 'expense':
          return ProjectTransactionType.expense;
        case 'transfer':
          return ProjectTransactionType.transfer;
        default:
          return ProjectTransactionType.income;
      }
    }

    return ProjectTransaction(
      id: doc.id,
      profileId: (d['profileId'] ?? d['projectId'] ?? '').toString(),
      type: parseType((d['type'] ?? 'income').toString()),
      primaryAccountId: (d['primaryAccountId'] ?? '').toString(),
      secondaryAccountId: (d['secondaryAccountId'] ?? '').toString().isNotEmpty ? (d['secondaryAccountId'] ?? '').toString() : null,
      amount: (d['amount'] is num) ? (d['amount'] as num).toDouble() : 0,
      secondaryAmount: (d['secondaryAmount'] is num) ? (d['secondaryAmount'] as num).toDouble() : null,
      currency: (d['currency'] ?? '').toString(),
      secondaryCurrency: (d['secondaryCurrency'] ?? '').toString().isNotEmpty ? (d['secondaryCurrency'] ?? '').toString() : null,
      category: (d['category'] ?? '').toString(),
      description: (d['description'] ?? '').toString().isNotEmpty ? (d['description'] ?? '').toString() : null,
  counterpartyName: (d['counterpartyName'] ?? '').toString().isNotEmpty ? (d['counterpartyName'] ?? '').toString() : null,
  counterpartyContact: (d['counterpartyContact'] ?? '').toString().isNotEmpty ? (d['counterpartyContact'] ?? '').toString() : null,
      effectiveDate: d['effectiveDate'] is Timestamp ? d['effectiveDate'] as Timestamp : Timestamp.now(),
      rateDerived: (d['rateDerived'] is num) ? (d['rateDerived'] as num).toDouble() : null,
      receiptCount: (d['receiptCount'] is num) ? (d['receiptCount'] as num).toInt() : 0,
      receiptRefs: (d['receiptRefs'] is List) ? List<String>.from(d['receiptRefs']) : const <String>[],
      reversed: d['reversed'] == true,
      createdAt: d['createdAt'] is Timestamp ? d['createdAt'] as Timestamp : null,
      updatedAt: d['updatedAt'] is Timestamp ? d['updatedAt'] as Timestamp : null,
      createdBy: (d['createdBy'] ?? '').toString().isNotEmpty ? (d['createdBy'] ?? '').toString() : null,
    );
  }

  Map<String, dynamic> toMap() => {
  'profileId': profileId,
        'type': type.name,
        'primaryAccountId': primaryAccountId,
        if (secondaryAccountId != null) 'secondaryAccountId': secondaryAccountId,
        'amount': amount,
        if (secondaryAmount != null) 'secondaryAmount': secondaryAmount,
        'currency': currency,
        if (secondaryCurrency != null) 'secondaryCurrency': secondaryCurrency,
        'category': category,
        if (description != null) 'description': description,
  if (counterpartyName != null) 'counterpartyName': counterpartyName,
  if (counterpartyContact != null) 'counterpartyContact': counterpartyContact,
        'effectiveDate': effectiveDate,
        if (rateDerived != null) 'rateDerived': rateDerived,
        'receiptCount': receiptCount,
        if (receiptRefs.isNotEmpty) 'receiptRefs': receiptRefs,
        'reversed': reversed,
        if (createdAt != null) 'createdAt': createdAt,
        if (updatedAt != null) 'updatedAt': updatedAt,
        if (createdBy != null) 'createdBy': createdBy,
      };
}

class TransactionReceiptMeta {
  final String id;
  final String profileId; // formerly projectId
  final String transactionId;
  final String storagePath;
  final int? width;
  final int? height;
  final String? mimeType;
  final Timestamp? uploadedAt;

  TransactionReceiptMeta({
    required this.id,
    required this.profileId,
    required this.transactionId,
    required this.storagePath,
    this.width,
    this.height,
    this.mimeType,
    this.uploadedAt,
  });

  factory TransactionReceiptMeta.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    return TransactionReceiptMeta(
      id: doc.id,
      profileId: (d['profileId'] ?? d['projectId'] ?? '').toString(),
      transactionId: (d['transactionId'] ?? '').toString(),
      storagePath: (d['storagePath'] ?? '').toString(),
      width: (d['width'] is num) ? (d['width'] as num).toInt() : null,
      height: (d['height'] is num) ? (d['height'] as num).toInt() : null,
      mimeType: (d['mimeType'] ?? '').toString().isNotEmpty ? (d['mimeType'] ?? '').toString() : null,
      uploadedAt: d['uploadedAt'] is Timestamp ? d['uploadedAt'] as Timestamp : null,
    );
  }

  Map<String, dynamic> toMap() => {
  'profileId': profileId,
        'transactionId': transactionId,
        'storagePath': storagePath,
        if (width != null) 'width': width,
        if (height != null) 'height': height,
        if (mimeType != null) 'mimeType': mimeType,
        if (uploadedAt != null) 'uploadedAt': uploadedAt,
      };
}
