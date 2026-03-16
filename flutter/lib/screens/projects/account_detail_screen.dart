import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../../utils/currency.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import '../../services/finance_models.dart';
import '../../services/project_finance_service.dart';
import 'transaction_create_screen.dart';
import 'transaction_detail_screen.dart';

class AccountDetailScreen extends StatefulWidget {
  final String profileId;
  final ProjectAccount account;
  const AccountDetailScreen({super.key, required this.profileId, required this.account});

  @override
  State<AccountDetailScreen> createState() => _AccountDetailScreenState();
}

class _AccountDetailScreenState extends State<AccountDetailScreen> {
  bool _exporting = false;

  void _openAddTransaction(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Add Transaction', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
              const SizedBox(height: 12),
              ListTile(
                leading: const Icon(Icons.trending_up),
                title: const Text('Income'),
                onTap: () async {
                  Navigator.pop(ctx);
                  final changed = await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => TransactionCreateScreen(
                        projectId: widget.profileId,
                        mode: TxFormMode.income,
                        initialPrimaryAccountId: widget.account.id,
                        lockPrimary: true,
                      ),
                    ),
                  );
                  if (changed is ProjectTransaction && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Income recorded')));
                  }
                },
              ),
              ListTile(
                leading: const Icon(Icons.trending_down),
                title: const Text('Expense'),
                onTap: () async {
                  Navigator.pop(ctx);
                  final changed = await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => TransactionCreateScreen(
                        projectId: widget.profileId,
                        mode: TxFormMode.expense,
                        initialPrimaryAccountId: widget.account.id,
                        lockPrimary: true,
                      ),
                    ),
                  );
                  if (changed is ProjectTransaction && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Expense recorded')));
                  }
                },
              ),
              ListTile(
                leading: const Icon(Icons.swap_horiz),
                title: const Text('Transfer'),
                onTap: () async {
                  Navigator.pop(ctx);
                  final changed = await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => TransactionCreateScreen(
                        projectId: widget.profileId,
                        mode: TxFormMode.transfer,
                        initialPrimaryAccountId: widget.account.id,
                        lockPrimary: true,
                      ),
                    ),
                  );
                  if (changed is ProjectTransaction && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Transfer recorded')));
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _exportCsvForAccount() async {
    if (_exporting) return;
    setState(() => _exporting = true);
    try {
      final profileId = widget.profileId;
      final accountId = widget.account.id;
      // Fetch primary and secondary in batches
      final docsMap = <String, Map<String, dynamic>>{};
      Future<void> fetchAllPages(Query<Map<String, dynamic>> q) async {
        DocumentSnapshot<Map<String, dynamic>>? last;
        while (true) {
          var dq = q.orderBy('effectiveDate', descending: true);
          if (last != null) dq = dq.startAfterDocument(last);
          final snap = await dq.limit(1000).get();
          if (snap.docs.isEmpty) break;
          for (final d in snap.docs) {
            docsMap[d.id] = d.data();
          }
          last = snap.docs.last;
          if (snap.docs.length < 1000) break;
        }
      }
      final base = FirebaseFirestore.instance.collection('profiles').doc(profileId).collection('profileTransactions');
      await fetchAllPages(base.where('primaryAccountId', isEqualTo: accountId));
      await fetchAllPages(base.where('secondaryAccountId', isEqualTo: accountId));

      final rows = <List<String>>[
        [
          'id',
          'type',
          'primaryAccountId',
          'secondaryAccountId',
          'amount',
          'secondaryAmount',
          'currency',
          'secondaryCurrency',
          'category',
          'description',
          'counterpartyName',
          'counterpartyContact',
          'effectiveDate',
          'reversed',
          'createdAt',
          'createdBy'
        ]
      ];
      for (final entry in docsMap.entries) {
        final d = entry.value;
        rows.add([
          entry.key,
          (d['type'] ?? '').toString(),
          (d['primaryAccountId'] ?? '').toString(),
          (d['secondaryAccountId'] ?? '').toString(),
          (d['amount'] is num) ? (d['amount'] as num).toString() : '',
          (d['secondaryAmount'] is num) ? (d['secondaryAmount'] as num).toString() : '',
          (d['currency'] ?? '').toString(),
          (d['secondaryCurrency'] ?? '').toString(),
          (d['category'] ?? '').toString(),
          (d['description'] ?? '').toString().replaceAll('\n', ' '),
          (d['counterpartyName'] ?? '').toString(),
          (d['counterpartyContact'] ?? '').toString(),
          d['effectiveDate'] is Timestamp ? (d['effectiveDate'] as Timestamp).toDate().toIso8601String() : '',
          d['reversed'] == true ? 'true' : 'false',
          d['createdAt'] is Timestamp ? (d['createdAt'] as Timestamp).toDate().toIso8601String() : '',
          (d['createdBy'] ?? '').toString(),
        ]);
      }
      final csv = rows.map((r) => r.map(_csvEscape).join(',')).join('\n');
      // Save to a file under app documents
      final dir = await getApplicationDocumentsDirectory();
      final file = File('${dir.path}/account_${accountId}_${DateTime.now().toIso8601String().substring(0,10)}.csv');
      await file.writeAsString(csv);
      await Clipboard.setData(ClipboardData(text: csv));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('CSV saved to ${file.path} and copied to clipboard')));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Export failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  String _csvEscape(String input) {
    if (input.contains(',') || input.contains('"') || input.contains('\n')) {
      final escaped = input.replaceAll('"', '""');
      return '"$escaped"';
    }
    return input;
  }

  @override
  Widget build(BuildContext context) {
    final svc = ProjectFinanceService.instance;
    final accDoc = FirebaseFirestore.instance
        .collection('profiles')
        .doc(widget.profileId)
        .collection('accounts')
        .doc(widget.account.id)
        .snapshots(includeMetadataChanges: true);
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.account.name} (${widget.account.currency})'),
        actions: [
          IconButton(
            tooltip: _exporting ? 'Exporting…' : 'Download CSV',
            onPressed: _exporting ? null : _exportCsvForAccount,
            icon: _exporting
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.download),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openAddTransaction(context),
        child: const Icon(Icons.add),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
            stream: accDoc,
            builder: (context, snap) {
              final data = snap.data?.data();
              final bal = (data != null && data['currentBalance'] is num)
                  ? (data['currentBalance'] as num).toDouble()
                  : widget.account.currentBalance ?? widget.account.openingBalance;
              final pending = snap.data?.metadata.hasPendingWrites == true;
              return Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: Row(
                  children: [
                    Text('Balance: ', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(width: 6),
                    Text(
                      formatCurrency(widget.account.currency, bal),
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    if (pending) ...[
                      const SizedBox(width: 8),
                      const Icon(Icons.sync, size: 16, color: Colors.amberAccent),
                    ],
                  ],
                ),
              );
            },
          ),
          const Divider(height: 1),
          Expanded(
            child: StreamBuilder<List<ProjectTransaction>>(
              stream: svc.watchAccountTransactions(widget.profileId, widget.account.id),
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                final txs = snap.data ?? const <ProjectTransaction>[];
                if (txs.isEmpty) {
                  return const Center(child: Text('No transactions for this account yet.'));
                }
                return ListView.separated(
                  itemCount: txs.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final t = txs[i];
                    final type = t.type.name;
                    final amount = t.amount;
                    final secondaryAmount = t.secondaryAmount;
                    final currency = t.currency;
                    final secCurrency = t.secondaryCurrency ?? '';
                    final category = t.category;
                    final eff = t.effectiveDate.toDate();
                    IconData icon; Color col;
                    if (type == 'income') { icon = Icons.trending_up; col = Colors.greenAccent; }
                    else if (type == 'expense') { icon = Icons.trending_down; col = Colors.redAccent; }
                    else { icon = Icons.swap_horiz; col = Colors.amberAccent; }
                    final reversed = t.reversed;
                    final titleStyle = reversed ? const TextStyle(decoration: TextDecoration.lineThrough, color: Colors.grey) : null;
                    return ListTile(
                      leading: CircleAvatar(backgroundColor: col.withValues(alpha: 0.15), child: Icon(icon, color: col, size: 18)),
                      title: Text('${type[0].toUpperCase()}${type.substring(1)} • $category', style: titleStyle),
                      subtitle: Text(eff.toLocal().toIso8601String().split('T').first),
                      trailing: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(formatCurrency(currency, amount), style: titleStyle),
                          if (secondaryAmount != null && secondaryAmount != amount)
                            Text(formatCurrency(secCurrency, secondaryAmount), style: TextStyle(color: reversed ? Colors.grey : Colors.white.withValues(alpha: 0.7), fontSize: 11, decoration: reversed ? TextDecoration.lineThrough : null)),
                        ],
                      ),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => TransactionDetailScreen(
                              profileId: widget.profileId,
                              transactionId: t.id,
                              initial: t,
                            ),
                          ),
                        );
                      },
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
