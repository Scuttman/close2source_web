import 'package:intl/intl.dart';

/// Formats an amount with thousand separators, two decimals, and currency code prefix.
/// Example: MWK 5,000.00 | USD 6,456.00
String formatCurrency(String currency, num? amount) {
  final n = amount ?? 0;
  final formatted = NumberFormat('#,##0.00').format(n);
  final c = (currency).toString().trim().toUpperCase();
  return c.isEmpty ? formatted : '$c $formatted';
}

/// Formats a numeric amount with thousand separators, two decimals (no currency).
String formatNumber(num? amount) {
  final n = amount ?? 0;
  return NumberFormat('#,##0.00').format(n);
}
