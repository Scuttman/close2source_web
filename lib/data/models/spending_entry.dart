import 'package:hive/hive.dart';

part 'spending_entry.g.dart';

@HiveType(typeId: 1)
class SpendingEntry extends HiveObject {
  @HiveField(0)
  final String id;

  @HiveField(1)
  final String description;

  @HiveField(2)
  final String category;

  @HiveField(3)
  final double amount;

  @HiveField(4)
  final String date;

  @HiveField(5)
  final String? localImagePath;

  SpendingEntry({
    required this.id,
    required this.description,
    required this.category,
    required this.amount,
    required this.date,
    this.localImagePath,
  });
}
