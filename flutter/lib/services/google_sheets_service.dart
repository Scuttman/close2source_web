import 'package:google_sign_in/google_sign_in.dart';
import 'package:googleapis/sheets/v4.dart' as sheets;
import 'package:http/http.dart' as http;
import 'package:cloud_firestore/cloud_firestore.dart';
import '../firebase_options.dart';

class GoogleSheetsService {
  final sheets.SheetsApi api;
  final String spreadsheetTitle;

  GoogleSheetsService(this.api, {required this.spreadsheetTitle});

  static Future<sheets.SheetsApi> getSheetsApi(GoogleSignInAccount account) async {
    final authHeaders = await account.authHeaders;
    final client = GoogleAuthClient(authHeaders);
    return sheets.SheetsApi(client);
  }

  Future<sheets.Spreadsheet> createSpreadsheet(List<String> sheetTitles) async {
    final spreadsheet = sheets.Spreadsheet(
      properties: sheets.SpreadsheetProperties(title: spreadsheetTitle),
      sheets: sheetTitles.map((t) => sheets.Sheet(properties: sheets.SheetProperties(title: t))).toList(),
    );
    return await api.spreadsheets.create(spreadsheet);
  }

  Future<void> writeSheetRows(String spreadsheetId, Map<String, List<List<Object?>>> rowsBySheetTitle) async {
    for (final entry in rowsBySheetTitle.entries) {
      final title = entry.key;
      final rows = entry.value;
      await api.spreadsheets.values.update(
        sheets.ValueRange(values: rows),
        spreadsheetId,
        '$title!A1',
        valueInputOption: 'USER_ENTERED',
      );
    }
  }

  Future<void> formatSheets(sheets.Spreadsheet created, Map<String, String> accountNameByTitle, Map<String, List<Object?>> headerByTitle, Map<String, SummaryMeta> summaryMetaByTitle, Map<String, String> currencyByTitle) async {
    final formatRequests = <sheets.Request>[];
    for (final entry in accountNameByTitle.entries) {
      final title = entry.key;
      final matchingSheets = (created.sheets ?? []).where((s) => s.properties?.title == title);
      if (matchingSheets.isEmpty) continue;
      final sheetId = matchingSheets.first.properties?.sheetId;
      if (sheetId == null) continue;
      // Format A1: large font and bold
      formatRequests.add(sheets.Request(
        repeatCell: sheets.RepeatCellRequest(
          range: sheets.GridRange(sheetId: sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1),
          cell: sheets.CellData(
            userEnteredFormat: sheets.CellFormat(
              textFormat: sheets.TextFormat(fontSize: 24, bold: true),
            ),
          ),
          fields: 'userEnteredFormat.textFormat',
        ),
      ));
      // Format header row (row 3): bold + bottom border
      final header = headerByTitle[title] ?? const <Object?>[];
      formatRequests.add(sheets.Request(
        repeatCell: sheets.RepeatCellRequest(
          range: sheets.GridRange(sheetId: sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: header.length),
          cell: sheets.CellData(
            userEnteredFormat: sheets.CellFormat(
              textFormat: sheets.TextFormat(fontSize: 12, bold: true),
              borders: sheets.Borders(bottom: sheets.Border(style: 'SOLID', width: 1, color: sheets.Color(red: 0.8, green: 0.8, blue: 0.8))),
            ),
          ),
          fields: 'userEnteredFormat.textFormat,userEnteredFormat.borders',
        ),
      ));

      // Format summary sections using metadata
      final meta = summaryMetaByTitle[title];
      if (meta != null) {
        // Income Summary title row: size 18 bold, A cell
        formatRequests.add(sheets.Request(
          repeatCell: sheets.RepeatCellRequest(
            range: sheets.GridRange(sheetId: sheetId, startRowIndex: meta.incomeTitleRow - 1, endRowIndex: meta.incomeTitleRow, startColumnIndex: 0, endColumnIndex: 1),
            cell: sheets.CellData(userEnteredFormat: sheets.CellFormat(textFormat: sheets.TextFormat(fontSize: 18, bold: true))),
            fields: 'userEnteredFormat.textFormat',
          ),
        ));
        // Income Summary header: size 12 bold across 2 columns + bottom border
        formatRequests.add(sheets.Request(
          repeatCell: sheets.RepeatCellRequest(
            range: sheets.GridRange(sheetId: sheetId, startRowIndex: meta.incomeHeaderRow - 1, endRowIndex: meta.incomeHeaderRow, startColumnIndex: 0, endColumnIndex: 2),
            cell: sheets.CellData(userEnteredFormat: sheets.CellFormat(textFormat: sheets.TextFormat(fontSize: 12, bold: true), borders: sheets.Borders(bottom: sheets.Border(style: 'SOLID', width: 1, color: sheets.Color(red: 0.8, green: 0.8, blue: 0.8))))),
            fields: 'userEnteredFormat.textFormat,userEnteredFormat.borders',
          ),
        ));

        // Expenditure Summary title row: size 18 bold
        formatRequests.add(sheets.Request(
          repeatCell: sheets.RepeatCellRequest(
            range: sheets.GridRange(sheetId: sheetId, startRowIndex: meta.expenseTitleRow - 1, endRowIndex: meta.expenseTitleRow, startColumnIndex: 0, endColumnIndex: 1),
            cell: sheets.CellData(userEnteredFormat: sheets.CellFormat(textFormat: sheets.TextFormat(fontSize: 18, bold: true))),
            fields: 'userEnteredFormat.textFormat',
          ),
        ));
        // Expenditure Summary header: size 12 bold across 2 columns + bottom border
        formatRequests.add(sheets.Request(
          repeatCell: sheets.RepeatCellRequest(
            range: sheets.GridRange(sheetId: sheetId, startRowIndex: meta.expenseHeaderRow - 1, endRowIndex: meta.expenseHeaderRow, startColumnIndex: 0, endColumnIndex: 2),
            cell: sheets.CellData(userEnteredFormat: sheets.CellFormat(textFormat: sheets.TextFormat(fontSize: 12, bold: true), borders: sheets.Borders(bottom: sheets.Border(style: 'SOLID', width: 1, color: sheets.Color(red: 0.8, green: 0.8, blue: 0.8))))),
            fields: 'userEnteredFormat.textFormat,userEnteredFormat.borders',
          ),
        ));

        // Total Income row: bold 12pt across two cells (Category + Total)
        formatRequests.add(sheets.Request(
          repeatCell: sheets.RepeatCellRequest(
            range: sheets.GridRange(sheetId: sheetId, startRowIndex: meta.incomeTotalRow - 1, endRowIndex: meta.incomeTotalRow, startColumnIndex: 0, endColumnIndex: 2),
            cell: sheets.CellData(userEnteredFormat: sheets.CellFormat(textFormat: sheets.TextFormat(fontSize: 12, bold: true))),
            fields: 'userEnteredFormat.textFormat',
          ),
        ));
        // Total Expenditure row: bold 12pt across two cells (Category + Total)
        formatRequests.add(sheets.Request(
          repeatCell: sheets.RepeatCellRequest(
            range: sheets.GridRange(sheetId: sheetId, startRowIndex: meta.expenseTotalRow - 1, endRowIndex: meta.expenseTotalRow, startColumnIndex: 0, endColumnIndex: 2),
            cell: sheets.CellData(userEnteredFormat: sheets.CellFormat(textFormat: sheets.TextFormat(fontSize: 12, bold: true))),
            fields: 'userEnteredFormat.textFormat',
          ),
        ));

        // Profit/Loss row: size 14 bold across two cells
        formatRequests.add(sheets.Request(
          repeatCell: sheets.RepeatCellRequest(
            range: sheets.GridRange(sheetId: sheetId, startRowIndex: meta.pnlRow - 1, endRowIndex: meta.pnlRow, startColumnIndex: 0, endColumnIndex: 2),
            cell: sheets.CellData(userEnteredFormat: sheets.CellFormat(textFormat: sheets.TextFormat(fontSize: 14, bold: true))),
            fields: 'userEnteredFormat.textFormat',
          ),
        ));

        // Currency formatting for numeric values using account currency code
        final currencyCode = currencyByTitle[title] ?? '';
        if (currencyCode.isNotEmpty) {
          // Credit (F col 6 -> index 5), Debit (G col 7 -> index 6), Balance (H col 8 -> index 7)
          formatRequests.add(sheets.Request(
            repeatCell: sheets.RepeatCellRequest(
              range: sheets.GridRange(sheetId: sheetId, startRowIndex: meta.firstDataRow - 1, endRowIndex: meta.lastDataRow, startColumnIndex: 5, endColumnIndex: 8),
              cell: sheets.CellData(userEnteredFormat: sheets.CellFormat(numberFormat: sheets.NumberFormat(type: 'NUMBER', pattern: '[\$$currencyCode]#,##0.00'))),
              fields: 'userEnteredFormat.numberFormat',
            ),
          ));
          // Summary totals in column B for income and expense blocks
          formatRequests.add(sheets.Request(
            repeatCell: sheets.RepeatCellRequest(
              range: sheets.GridRange(sheetId: sheetId, startRowIndex: meta.incomeHeaderRow, endRowIndex: meta.incomeHeaderRow + meta.incomeTotalsRowCount, startColumnIndex: 1, endColumnIndex: 2),
              cell: sheets.CellData(userEnteredFormat: sheets.CellFormat(numberFormat: sheets.NumberFormat(type: 'NUMBER', pattern: '[\$$currencyCode]#,##0.00'))),
              fields: 'userEnteredFormat.numberFormat',
            ),
          ));
          formatRequests.add(sheets.Request(
            repeatCell: sheets.RepeatCellRequest(
              range: sheets.GridRange(sheetId: sheetId, startRowIndex: meta.expenseHeaderRow, endRowIndex: meta.expenseHeaderRow + meta.expenseTotalsRowCount, startColumnIndex: 1, endColumnIndex: 2),
              cell: sheets.CellData(userEnteredFormat: sheets.CellFormat(numberFormat: sheets.NumberFormat(type: 'NUMBER', pattern: '[\$$currencyCode]#,##0.00'))),
              fields: 'userEnteredFormat.numberFormat',
            ),
          ));

          // Profit/Loss value (column B at pnlRow)
          formatRequests.add(sheets.Request(
            repeatCell: sheets.RepeatCellRequest(
              range: sheets.GridRange(sheetId: sheetId, startRowIndex: meta.pnlRow - 1, endRowIndex: meta.pnlRow, startColumnIndex: 1, endColumnIndex: 2),
              cell: sheets.CellData(userEnteredFormat: sheets.CellFormat(numberFormat: sheets.NumberFormat(type: 'NUMBER', pattern: '[\$$currencyCode]#,##0.00'))),
              fields: 'userEnteredFormat.numberFormat',
            ),
          ));
        }
      }
    }
    if (formatRequests.isNotEmpty) {
      await api.spreadsheets.batchUpdate(sheets.BatchUpdateSpreadsheetRequest(requests: formatRequests), created.spreadsheetId!);
    }
  }

  /// Build a full export plan for per-account ledgers with running balances.
  ///
  /// Inputs:
  /// - accountsById: { accountId: { 'name': String, 'currency': String, 'openingBalance': num, ... } }
  /// - transactions: list of maps each having keys: type, primaryAccountId, secondaryAccountId, amount, secondaryAmount,
  ///   currency, secondaryCurrency, effectiveDate(Timestamp/DateTime/ISO), category, description, counterpartyName
  /// Output encapsulates:
  /// - unique sheet titles per account
  /// - rows per sheet starting at A1 with account name (row1), blank (row2), headers (row3), data (row4+)
  /// - mapping title -> account name for formatting label
  SheetsExportPlan buildLedgersExportPlan({
    required Map<String, Map<String, dynamic>> accountsById,
    required List<Map<String, dynamic>> transactions,
  }) {
    // Prepare unique sheet titles from account display names
    final rawTitles = <String>[];
    final accountIds = <String>[];
    for (final entry in accountsById.entries) {
      accountIds.add(entry.key);
      rawTitles.add(_sanitizeTitle(entry.value['name']?.toString() ?? entry.key));
    }
    final uniqueTitles = _uniqueTitles(rawTitles);

    final idToTitle = <String, String>{};
    final titleToAccountName = <String, String>{};
    for (int i = 0; i < accountIds.length; i++) {
      final id = accountIds[i];
      final title = uniqueTitles[i];
      idToTitle[id] = title;
  titleToAccountName[title] = accountsById[id]?['name']?.toString() ?? title;
    }

    // Sort transactions by effective date ascending, then createdAt if present
    final txs = List<Map<String, dynamic>>.from(transactions);
    txs.sort((a, b) {
      final da = _parseDate(a['effectiveDate']);
      final db = _parseDate(b['effectiveDate']);
      final cmp = da.compareTo(db);
      if (cmp != 0) return cmp;
      final ca = _parseDate(a['createdAt']);
      final cb = _parseDate(b['createdAt']);
      return ca.compareTo(cb);
    });

  final rowsByTitle = <String, List<List<Object?>>>{};
  final headerByTitle = <String, List<Object?>>{};
  final summaryMetaByTitle = <String, SummaryMeta>{};
  final currencyByTitle = <String, String>{};

    for (final id in accountIds) {
      final acc = accountsById[id] ?? const <String, dynamic>{};
      final title = idToTitle[id]!;
  final accountName = (acc['name'] ?? id).toString();
  final currencyCode = (acc['currency'] ?? '').toString().toUpperCase();
  currencyByTitle[title] = currencyCode;
      double balance = (acc['openingBalance'] is num) ? (acc['openingBalance'] as num).toDouble() : 0.0;

      // Pre-scan to determine max number of receipt columns
      int maxReceipts = 0;
      for (final t in txs) {
        final primaryId = (t['primaryAccountId'] ?? '').toString();
        final secondaryId = (t['secondaryAccountId'] ?? '').toString();
        if (primaryId != id && secondaryId != id) continue;
        final r = t['receiptRefs'];
        if (r is List) {
          final count = r.length;
          if (count > maxReceipts) maxReceipts = count;
        }
      }

      final dynamicHeader = <Object?>['ID','Date','Type','Customer/Vendor','Description','Credit','Debit','Balance','Category'];
      for (int i = 0; i < maxReceipts; i++) {
        dynamicHeader.add('ReceiptUrl${i + 1}');
      }

      final rows = <List<Object?>>[
        <Object?>[accountName], // A1
        const <Object?>[''], // Row 2 blank
        dynamicHeader, // Row 3 headers
      ];
  headerByTitle[title] = dynamicHeader;

  // Track data range rows for formulas
  int firstDataRowIndex = rows.length + 1; // after header, next row
  int lastDataRowIndex = firstDataRowIndex - 1; // will update as we append rows

      // Category totals for summaries
      final incomeTotals = <String, double>{};
      final expenseTotals = <String, double>{};

      for (final t in txs) {
        final type = (t['type'] ?? '').toString();
        final primaryId = (t['primaryAccountId'] ?? '').toString();
        final secondaryId = (t['secondaryAccountId'] ?? '').toString();
        if (primaryId != id && secondaryId != id) continue; // skip irrelevant

        final txId = (t['id'] ?? '').toString();
        final date = _formatDDMMYYYY(_parseDate(t['effectiveDate']));
        final category = (t['category'] ?? '').toString();
        final desc = (t['description'] ?? '').toString();
        final counterpartyName = (t['counterpartyName'] ?? '').toString();
        final amount = (t['amount'] is num) ? (t['amount'] as num).toDouble() : null;
        final secAmount = (t['secondaryAmount'] is num) ? (t['secondaryAmount'] as num).toDouble() : null;
  // currency fields are not needed for current export columns

  double? signed;
        String counterparty = counterpartyName;

        if (type == 'income' && primaryId == id) {
          signed = amount ?? 0.0;
          final v = signed;
          incomeTotals[category] = (incomeTotals[category] ?? 0.0) + v;
        } else if (type == 'expense' && primaryId == id) {
          signed = -(amount ?? 0.0);
          final v = (amount ?? 0.0);
          expenseTotals[category] = (expenseTotals[category] ?? 0.0) + v;
        } else if (type == 'transfer') {
          if (primaryId == id) {
            signed = -(amount ?? 0.0);
            // counterparty is destination account name
            counterparty = accountsById[secondaryId]?['name']?.toString() ?? secondaryId;
          } else if (secondaryId == id) {
            signed = secAmount ?? amount ?? 0.0;
            counterparty = accountsById[primaryId]?['name']?.toString() ?? primaryId;
          }
        }

        signed ??= 0.0;
        balance += signed;

        // Credit/Debit split
        final credit = signed > 0 ? signed : null;
        final debit = signed < 0 ? -signed : null;

        // Receipt URLs (if any) as Storage REST endpoints
        final bucket = DefaultFirebaseOptions.currentPlatform.storageBucket;
        final receiptRefs = (t['receiptRefs'] is List) ? List<String>.from(t['receiptRefs']) : const <String>[];
        final receiptUrls = <Object?>[];
        for (final p in receiptRefs) {
          final enc = Uri.encodeComponent(p);
          receiptUrls.add('https://firebasestorage.googleapis.com/v0/b/$bucket/o/$enc?alt=media');
        }
        // Ensure row has placeholders for all receipt columns
        while (receiptUrls.length < maxReceipts) { receiptUrls.add(''); }

        rows.add(<Object?>[
          txId,
          date,
          type,
          counterparty,
          desc,
          credit,
          debit,
          balance,
          category,
          ...receiptUrls,
        ]);
        lastDataRowIndex = rows.length; // track last written row index (1-based since A1 is row 1)
      }

      // Two blank lines after transactions
      rows.add(const <Object?>['']);
      rows.add(const <Object?>['']);

      // Summary tables
  // Income summary
  final incomeTitleRow = rows.length + 1; // 1-based
  rows.add(<Object?>['Income Summary']);
  rows.add(const <Object?>['']);
  final incomeHeaderRow = rows.length + 1; // next row will be header
  rows.add(<Object?>['Category','Total']);
  // Replace category totals with formulas that SUM Credit by Category
      for (final e in incomeTotals.entries) {
        final cat = e.key;
        final crit = _escapeForSheetsCriterion(cat);
        final formula = "=IFERROR(SUMIF(I:I, \"=$crit\", F:F), 0)";
        rows.add(<Object?>[cat, formula]);
      }
      // Transfer In aggregate (for this account)
        final transferIn = txs.where((t) {
          final type = (t['type'] ?? '').toString();
          final secondaryId = (t['secondaryAccountId'] ?? '').toString();
          return type == 'transfer' && secondaryId == id;
        }).fold<double>(0.0, (acc, t) {
          final amount = (t['secondaryAmount'] is num) ? (t['secondaryAmount'] as num).toDouble() : ((t['amount'] is num) ? (t['amount'] as num).toDouble() : 0.0);
          return acc + amount;
      });
  // Transfer In formula: SUM of Credit where Type = "transfer" and SecondaryId == this account → we can't easily filter by secondary id string in sheet, so keep computed value
  rows.add(<Object?>['Transfer In', transferIn]);
  // Total Income row
  final incomeDataStart = incomeHeaderRow + 1;
  final incomeDataEnd = incomeHeaderRow + incomeTotals.length + 1; // includes Transfer In
  final incomeTotalRow = rows.length + 1; // will be assigned after add
  final incomeTotalFormula = "=SUM(B$incomeDataStart:B$incomeDataEnd)";
  rows.add(<Object?>['Total Income', incomeTotalFormula]);
  rows.add(const <Object?>['']);
  // Expense summary
  final expenseTitleRow = rows.length + 1;
  rows.add(<Object?>['Expenditure Summary']);
  rows.add(const <Object?>['']);
  final expenseHeaderRow = rows.length + 1;
  rows.add(<Object?>['Category','Total']);
      // Replace category totals with formulas that SUM Debit by Category
      for (final e in expenseTotals.entries) {
        final cat = e.key;
        final crit = _escapeForSheetsCriterion(cat);
        final formula = "=IFERROR(SUMIF(I:I, \"=$crit\", G:G), 0)";
        rows.add(<Object?>[cat, formula]);
      }
      // Transfer Out aggregate (for this account)
      final transferOut = txs.where((t){
        final type = (t['type'] ?? '').toString();
        final primaryId = (t['primaryAccountId'] ?? '').toString();
        return type == 'transfer' && primaryId == id;
      }).fold<double>(0.0, (acc, t){
        final amount = (t['amount'] is num) ? (t['amount'] as num).toDouble() : 0.0;
        return acc + amount;
      });
  // Transfer Out formula: SUM of Debit where Type = "transfer" for this account → we can't easily filter by account in sheet, so keep computed value
  rows.add(<Object?>['Transfer Out', transferOut]);
  // Total Expenditure row
  final expenseDataStart = expenseHeaderRow + 1;
  final expenseDataEnd = expenseHeaderRow + expenseTotals.length + 1; // includes Transfer Out
  final expenseTotalRow = rows.length + 1; // will be assigned after add
  final expenseTotalFormula = "=SUM(B$expenseDataStart:B$expenseDataEnd)";
  rows.add(<Object?>['Total Expenditure', expenseTotalFormula]);
      rows.add(const <Object?>['']);
  // Profit/Loss
  final pnlRow = rows.length + 1;
  // Profit/Loss formula using summary sections: sum of income totals minus sum of expense totals
  final incomeCatStart = incomeHeaderRow + 1;
  final incomeCatEnd = incomeHeaderRow + incomeTotals.length + 1; // include Transfer In row
  final expenseCatStart = expenseHeaderRow + 1;
  final expenseCatEnd = expenseHeaderRow + expenseTotals.length + 1; // include Transfer Out row
  final pnlFormula = "=SUM(B$incomeCatStart:B$incomeCatEnd) - SUM(B$expenseCatStart:B$expenseCatEnd)";
  rows.add(<Object?>['Profit/Loss', pnlFormula]);

      rowsByTitle[title] = rows;
      summaryMetaByTitle[title] = SummaryMeta(
        incomeTitleRow: incomeTitleRow,
        incomeHeaderRow: incomeHeaderRow,
        incomeTotalRow: incomeTotalRow,
        expenseTitleRow: expenseTitleRow,
        expenseHeaderRow: expenseHeaderRow,
        expenseTotalRow: expenseTotalRow,
        pnlRow: pnlRow,
        firstDataRow: firstDataRowIndex,
        lastDataRow: lastDataRowIndex,
        incomeTotalsRowCount: incomeTotals.length + 1 + 1, // categories + Transfer In + Total Income
        expenseTotalsRowCount: expenseTotals.length + 1 + 1, // categories + Transfer Out + Total Expenditure
      );
    }

    return SheetsExportPlan(
      sheetTitles: uniqueTitles,
      rowsByTitle: rowsByTitle,
      accountNameByTitle: titleToAccountName,
      headerByTitle: headerByTitle,
      summaryMetaByTitle: summaryMetaByTitle,
      currencyByTitle: currencyByTitle,
    );
  }

  String _sanitizeTitle(String input) {
    var t = input.trim();
    if (t.isEmpty) t = 'Sheet';
    // Remove invalid characters for Google Sheets titles
    t = t.replaceAll(RegExp(r"[\\/*\?\[\]]"), ' ');
    if (t.length > 90) t = t.substring(0, 90);
    return t;
  }

  List<String> _uniqueTitles(List<String> titles) {
    final seen = <String, int>{};
    final out = <String>[];
    for (final t in titles) {
      var base = t;
      var idx = seen[base] ?? 0;
      if (idx == 0 && !out.contains(base)) {
        out.add(base);
        seen[base] = 1;
      } else {
        // increment until unique
        do {
          idx += 1;
          final candidate = '$base ($idx)';
          if (!out.contains(candidate)) {
            out.add(candidate);
            seen[base] = idx;
            break;
          }
        } while (true);
      }
    }
    return out;
  }
}

DateTime _parseDate(dynamic value) {
  try {
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    if (value is String) {
      final d = DateTime.tryParse(value);
      if (d != null) return d;
    }
    if (value is num) {
      // Assume milliseconds since epoch
      return DateTime.fromMillisecondsSinceEpoch(value.toInt());
    }
  } catch (_) {}
  return DateTime.fromMillisecondsSinceEpoch(0);
}

String _formatDDMMYYYY(DateTime d) {
  final dd = d.day.toString().padLeft(2, '0');
  final mm = d.month.toString().padLeft(2, '0');
  final yyyy = d.year.toString();
  return '$dd/$mm/$yyyy';
}

String _escapeForSheetsCriterion(String s) {
  // Escape double quotes for criterion strings in formulas
  return s.replaceAll('"', '""');
}

class SheetsExportPlan {
  final List<String> sheetTitles;
  final Map<String, List<List<Object?>>> rowsByTitle;
  final Map<String, String> accountNameByTitle;
  final Map<String, List<Object?>> headerByTitle;
  final Map<String, SummaryMeta> summaryMetaByTitle;
  final Map<String, String> currencyByTitle;
  SheetsExportPlan({
    required this.sheetTitles,
    required this.rowsByTitle,
    required this.accountNameByTitle,
    required this.headerByTitle,
    required this.summaryMetaByTitle,
    required this.currencyByTitle,
  });
}

class SummaryMeta {
  final int incomeTitleRow;
  final int incomeHeaderRow;
  final int incomeTotalRow;
  final int expenseTitleRow;
  final int expenseHeaderRow;
  final int expenseTotalRow;
  final int pnlRow;
  final int firstDataRow;
  final int lastDataRow;
  final int incomeTotalsRowCount;
  final int expenseTotalsRowCount;
  const SummaryMeta({
    required this.incomeTitleRow,
    required this.incomeHeaderRow,
    required this.incomeTotalRow,
    required this.expenseTitleRow,
    required this.expenseHeaderRow,
    required this.expenseTotalRow,
    required this.pnlRow,
    required this.firstDataRow,
    required this.lastDataRow,
    required this.incomeTotalsRowCount,
    required this.expenseTotalsRowCount,
  });
}

class GoogleAuthClient extends http.BaseClient {
  final Map<String, String> _headers;
  final http.Client _client = http.Client();
  GoogleAuthClient(this._headers);
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) {
    request.headers.addAll(_headers);
    return _client.send(request);
  }
  @override
  void close() {
    _client.close();
  }
}
