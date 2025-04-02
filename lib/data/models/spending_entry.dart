import 'package:cloud_firestore/cloud_firestore.dart';

class SpendingEntry {
  final String id;
  final String profileId;
  final String description;
  final String category;
  final double amount;
  final DateTime date;
  final List<String> receiptImages; // Can be local paths or uploaded URLs
  final bool isUploaded;            // Optional: for sync tracking

  SpendingEntry({
    required this.id,
    required this.profileId,
    required this.description,
    required this.category,
    required this.amount,
    required this.date,
    required this.receiptImages,
    this.isUploaded = false,
  });

  // Convert to JSON (e.g., for local storage)
  Map<String, dynamic> toJson() => {
    'id': id,
    'profileId': profileId,
    'description': description,
    'category': category,
    'amount': amount,
    'date': date.toIso8601String(),
    'receiptImages': receiptImages,
    'isUploaded': isUploaded,
  };

  // Convert from JSON
  factory SpendingEntry.fromJson(Map<String, dynamic> json) {
    return SpendingEntry(
      id: json['id'] ?? '',
      description: json['description'] ?? '',
      category: json['category'] ?? '',
      amount: (json['amount'] ?? 0).toDouble(),
      date: json['date'] is Timestamp
          ? (json['date'] as Timestamp).toDate()
          : DateTime.tryParse(json['date']?.toString() ?? '') ?? DateTime.now(),
      receiptImages: List<String>.from(json['receiptImages'] ?? []),
      isUploaded: json['isUploaded'] ?? false,
      profileId: json['profileId'] ?? '',
    );
  }

  // Optional: create a copy with updates
  SpendingEntry copyWith({
    String? id,
    String? profileId,
    String? description,
    String? category,
    double? amount,
    DateTime? date,
    List<String>? receiptImages,
    bool? isUploaded,
  }) {
    return SpendingEntry(
      id: id ?? this.id,
      profileId: profileId ?? this.profileId,
      description: description ?? this.description,
      category: category ?? this.category,
      amount: amount ?? this.amount,
      date: date ?? this.date,
      receiptImages: receiptImages ?? this.receiptImages,
      isUploaded: isUploaded ?? this.isUploaded,
    );
  }
}
