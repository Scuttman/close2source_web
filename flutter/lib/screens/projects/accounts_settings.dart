import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../services/google_sheets_service.dart';

class AccountsSettingsScreen extends StatefulWidget {
  final String profileId;
  const AccountsSettingsScreen({super.key, required this.profileId});

  @override
  State<AccountsSettingsScreen> createState() => _AccountsSettingsScreenState();
}

class _AccountsSettingsScreenState extends State<AccountsSettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _defaultCurrencyCtrl = TextEditingController(text: 'USD');
  int _fyStartMonth = 1; // 1-12
  // Export settings
  String _exportFormat = 'csv'; // 'csv' or 'sheets'
  final _spreadsheetTitleCtrl = TextEditingController(text: 'Finance Export');
  bool _loading = true;
  bool _saving = false;
  static const List<String> _monthNames = <String>[
    'January','February','March','April','May','June','July','August','September','October','November','December'
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _defaultCurrencyCtrl.dispose();
    _spreadsheetTitleCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final docRef = FirebaseFirestore.instance
          .collection('profiles')
          .doc(widget.profileId)
          .collection('settings')
          .doc('finance');
      // Try server with timeout, then fall back to cache if needed
      DocumentSnapshot<Map<String, dynamic>> doc;
      try {
        doc = await docRef.get(const GetOptions(source: Source.serverAndCache)).timeout(const Duration(seconds: 6));
      } on TimeoutException {
        doc = await docRef.get(const GetOptions(source: Source.cache));
      }
      final d = doc.data() ?? {};
      final ccy = (d['defaultCurrency'] ?? 'USD').toString();
      final fy = (d['financialYearStartMonth'] is num) ? (d['financialYearStartMonth'] as num).toInt() : 1;
      final fmt = (d['exportFormat'] ?? 'csv').toString();
      final title = (d['spreadsheetTitle'] ?? 'Finance Export').toString();
      _defaultCurrencyCtrl.text = ccy;
      _fyStartMonth = (fy >= 1 && fy <= 12) ? fy : 1;
      _exportFormat = (fmt == 'sheets') ? 'sheets' : 'csv';
      _spreadsheetTitleCtrl.text = title;
    } catch (_) {
      // keep defaults
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await FirebaseFirestore.instance
          .collection('profiles')
          .doc(widget.profileId)
          .collection('settings')
          .doc('finance')
          .set({
        'defaultCurrency': _defaultCurrencyCtrl.text.trim().toUpperCase(),
        'financialYearStartMonth': _fyStartMonth,
        'exportFormat': _exportFormat,
        'spreadsheetTitle': _spreadsheetTitleCtrl.text.trim(),
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Settings saved')));
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to save: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Accounts Settings'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Save'),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16.0),
              child: Form(
                key: _formKey,
                child: ListView(
                  children: [
                    const Text('Defaults', style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    LayoutBuilder(
                      builder: (context, c) {
                        final narrow = c.maxWidth < 420;
                        final currencyField = TextFormField(
                          controller: _defaultCurrencyCtrl,
                          decoration: const InputDecoration(labelText: 'Default Currency (ISO 4217, e.g., USD)'),
                          textCapitalization: TextCapitalization.characters,
                          maxLength: 3,
                          validator: (v) => (v == null || v.trim().length != 3) ? '3-letter code' : null,
                        );
                        final fyField = DropdownButtonFormField<int>(
                          isExpanded: true,
                          initialValue: _fyStartMonth,
                          decoration: const InputDecoration(labelText: 'Financial Year Start (Month)'),
                          items: List.generate(12, (i) {
                            final m = i + 1;
                            return DropdownMenuItem(value: m, child: Text(_monthNames[i]));
                          }),
                          onChanged: (v) => setState(() => _fyStartMonth = (v ?? 1)),
                        );
                        if (narrow) {
                          return Column(
                            children: [
                              currencyField,
                              const SizedBox(height: 8),
                              fyField,
                            ],
                          );
                        }
                        return Row(
                          children: [
                            Expanded(child: currencyField),
                            const SizedBox(width: 12),
                            Expanded(child: fyField),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 24),
                    const Text('Export', style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      isExpanded: true,
                      initialValue: _exportFormat,
                      decoration: const InputDecoration(labelText: 'Export Format'),
                      items: const [
                        DropdownMenuItem(value: 'csv', child: Text('CSV only')),
                        DropdownMenuItem(value: 'sheets', child: Text('Google Sheets')),
                      ],
                      onChanged: (v) => setState(() => _exportFormat = v ?? 'csv'),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _spreadsheetTitleCtrl,
                      decoration: const InputDecoration(labelText: 'Spreadsheet Title'),
                    ),
                    const SizedBox(height: 20),
                    _GoogleSheetsSyncCard(
                      profileId: widget.profileId,
                      getSpreadsheetTitle: () => _spreadsheetTitleCtrl.text.trim().isEmpty ? 'Finance Export' : _spreadsheetTitleCtrl.text.trim(),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

class _GoogleSheetsSyncCard extends StatefulWidget {
  final String profileId;
  final String Function() getSpreadsheetTitle;
  const _GoogleSheetsSyncCard({required this.profileId, required this.getSpreadsheetTitle});

  @override
  State<_GoogleSheetsSyncCard> createState() => _GoogleSheetsSyncCardState();
}

enum _SyncState { idle, signingIn, fetching, creating, writing, formatting, savingMeta, done, error }

class _GoogleSheetsSyncCardState extends State<_GoogleSheetsSyncCard> {
  _SyncState _state = _SyncState.idle;
  String? _message;
  String? _spreadsheetId;
  DateTime? _lastSyncedAt;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _loadMeta();
  }

  Future<void> _loadMeta() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('profiles').doc(widget.profileId)
          .collection('settings').doc('finance')
          .get(const GetOptions(source: Source.serverAndCache));
      if (!doc.exists) return;
      final d = doc.data() as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _spreadsheetId = (d['lastSheetsSpreadsheetId'] ?? '') as String?;
        final ts = d['lastSheetsSyncAt'];
        if (ts is Timestamp) _lastSyncedAt = ts.toDate();
      });
    } catch (_) {}
  }

  Future<void> _runSync() async {
    if (_busy) return;
    setState(() { _busy = true; _state = _SyncState.signingIn; _message = 'Signing in to Google...'; });
    try {
      final googleSignIn = GoogleSignIn(scopes: const ['email','https://www.googleapis.com/auth/spreadsheets']);
      final account = await googleSignIn.signInSilently() ?? await googleSignIn.signIn();
      if (account == null) { throw Exception('Sign-in cancelled'); }

      setState(() { _state = _SyncState.fetching; _message = 'Fetching finance data...'; });
      final db = FirebaseFirestore.instance;
  final accountsSnap = await db.collection('profiles').doc(widget.profileId).collection('accounts').get();
  final txSnap = await db.collection('profiles').doc(widget.profileId).collection('profileTransactions').orderBy('effectiveDate').get();
  final accounts = { for (final d in accountsSnap.docs) d.id: { ...d.data(), 'id': d.id } };
  final transactions = [ for (final d in txSnap.docs) { ...d.data(), 'id': d.id } ];

      setState(() { _state = _SyncState.creating; _message = 'Creating Google Sheet...'; });
      final api = await GoogleSheetsService.getSheetsApi(account);
      final service = GoogleSheetsService(api, spreadsheetTitle: widget.getSpreadsheetTitle());
      // Build export plan (per-account sheets with running balances)
      final plan = service.buildLedgersExportPlan(accountsById: accounts, transactions: transactions);
      final created = await service.createSpreadsheet(plan.sheetTitles);
      final sid = created.spreadsheetId!;
      setState(() { _spreadsheetId = sid; _state = _SyncState.writing; _message = 'Writing rows...'; });
      await service.writeSheetRows(sid, plan.rowsByTitle);
      setState(() { _state = _SyncState.formatting; _message = 'Applying formatting...'; });
  await service.formatSheets(created, plan.accountNameByTitle, plan.headerByTitle, plan.summaryMetaByTitle, plan.currencyByTitle);

      setState(() { _state = _SyncState.savingMeta; _message = 'Saving sync metadata...'; });
      await FirebaseFirestore.instance
          .collection('profiles').doc(widget.profileId)
          .collection('settings').doc('finance')
          .set({
            'lastSheetsSpreadsheetId': sid,
            'lastSheetsSyncAt': FieldValue.serverTimestamp(),
          }, SetOptions(merge: true));
      await _loadMeta();

      setState(() { _state = _SyncState.done; _message = 'Sync complete'; _busy = false; });
    } catch (e) {
      setState(() { _state = _SyncState.error; _message = 'Sync failed: $e'; _busy = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final running = _busy && _state != _SyncState.done && _state != _SyncState.error;
    return Card(
      color: Colors.white.withValues(alpha: 0.03),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.sync, size: 18),
                const SizedBox(width: 8),
                const Text('Google Sheets Sync', style: TextStyle(fontWeight: FontWeight.w700)),
                const Spacer(),
                FilledButton(
                  onPressed: running ? null : _runSync,
                  child: running
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Run Sync'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_message != null)
              Text(_message!, style: TextStyle(color: Colors.white.withValues(alpha: 0.8))),
            const SizedBox(height: 8),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: [
                _statusChip('Sign-in', _state.index >= _SyncState.signingIn.index, _state.index > _SyncState.signingIn.index, _state),
                _statusChip('Fetch Data', _state.index >= _SyncState.fetching.index, _state.index > _SyncState.fetching.index, _state),
                _statusChip('Create Sheet', _state.index >= _SyncState.creating.index, _state.index > _SyncState.creating.index, _state),
                _statusChip('Write Rows', _state.index >= _SyncState.writing.index, _state.index > _SyncState.writing.index, _state),
                _statusChip('Format', _state.index >= _SyncState.formatting.index, _state.index > _SyncState.formatting.index, _state),
                _statusChip('Save Meta', _state.index >= _SyncState.savingMeta.index, _state.index > _SyncState.savingMeta.index, _state),
              ],
            ),
            const SizedBox(height: 8),
            if (_spreadsheetId != null && _spreadsheetId!.isNotEmpty)
              Text('Spreadsheet ID: $_spreadsheetId', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12)),
            if (_lastSyncedAt != null)
              Text('Last sync: ${_lastSyncedAt!.toLocal()}', style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12)),
          ],
        ),
      ),
    );
  }

  Widget _statusChip(String label, bool reached, bool completed, _SyncState s) {
    Color border = Colors.white.withValues(alpha: 0.15);
    Color fill = Colors.white.withValues(alpha: 0.03);
    Widget? icon;
    if (completed || s == _SyncState.done) { icon = const Icon(Icons.check, size: 14, color: Colors.greenAccent); }
    else if (reached && !completed) { icon = const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)); }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        border: Border.all(color: border),
        color: fill,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [ if (icon != null) icon, if (icon != null) const SizedBox(width: 6), Text(label) ],
      ),
    );
  }
}
