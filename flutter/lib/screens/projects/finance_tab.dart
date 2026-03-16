import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../utils/currency.dart';
import 'accounts_screen.dart';

import '../../services/finance_models.dart';
import '../../services/project_finance_service.dart';
import 'budget_screen.dart';

class FinanceTab extends StatefulWidget {
  final String profileId;
  const FinanceTab({super.key, required this.profileId});

  @override
  State<FinanceTab> createState() => _FinanceTabState();
}

class _FinanceTabState extends State<FinanceTab> {
  late final String _profileId = widget.profileId;

  // No account creation on this tab; use Accounts screen.

  // Note: Adding transactions now happens from Accounts screen; no inline add here to keep layout minimal.

  

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: LayoutBuilder(
        builder: (ctx, constraints) {
          final content = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top title + nav row
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Finance', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                SizedBox(
                  height: 110,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      _NavTile(
                        icon: Icons.account_balance_wallet,
                        label: 'Accounts',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => AccountsScreen(profileId: _profileId))),
                      ),
                      const SizedBox(width: 12),
                      _NavTile(
                        icon: Icons.category,
                        label: 'Budget',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => BudgetScreen(profileId: _profileId))),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
            // Chart card expands to fill remaining space
            Expanded(
              child: Card(
                color: Colors.white.withValues(alpha: 0.03),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                  side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
                ),
                margin: EdgeInsets.zero,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: _IncomeExpensePieChart(profileId: _profileId),
                ),
              ),
            ),
          ],
          );
          // If height is extremely constrained, fall back to scrolling to avoid overflow
          if (constraints.maxHeight < 200) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title + nav
                    Text('Finance', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    SizedBox(
                      height: 110,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          _NavTile(
                            icon: Icons.account_balance_wallet,
                            label: 'Accounts',
                            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => AccountsScreen(profileId: _profileId))),
                          ),
                          const SizedBox(width: 12),
                          _NavTile(
                            icon: Icons.category,
                            label: 'Budget',
                            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => BudgetScreen(profileId: _profileId))),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Card(
                      color: Colors.white.withValues(alpha: 0.03),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                        side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
                      ),
                      margin: EdgeInsets.zero,
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: SizedBox(
                          height: 240,
                          child: _IncomeExpensePieChart(profileId: _profileId),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }
          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
            child: content,
          );
        },
      ),
    );
  }
}

class _NavTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _NavTile({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        width: 180,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          color: Colors.white.withValues(alpha: 0.05),
        ),
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: Colors.white.withValues(alpha: 0.06),
              child: Icon(icon, color: Colors.white.withValues(alpha: 0.9)),
            ),
            const SizedBox(height: 10),
            Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: Colors.white.withValues(alpha: 0.95))),
          ],
        ),
      ),
    );
  }
}

class _IncomeExpensePieChart extends StatelessWidget {
  final String profileId;
  const _IncomeExpensePieChart({required this.profileId});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<ProjectTransaction>>(
      stream: ProjectFinanceService.instance.watchProfileTransactions(profileId),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        final txs = snap.data ?? const [];
        double income = 0;
        double expense = 0;
        for (final t in txs) {
          if (t.reversed) continue;
          if (t.type == ProjectTransactionType.income) income += t.amount;
          if (t.type == ProjectTransactionType.expense) expense += t.amount;
        }
        if (income <= 0 && expense <= 0) {
          return const Center(child: Text('No transactions yet.'));
        }
        return LayoutBuilder(
          builder: (context, c) {
            final size = math.min(c.maxWidth, c.maxHeight);
            // Constrain the chart to a max size while still growing responsively
            final chartSize = math.min(280.0, math.max(160.0, size - 40));
            return Column(
              children: [
                Expanded(
                  child: Center(
                    child: CustomPaint(
                      size: Size(chartSize, chartSize),
                      painter: _PieChartPainter(income: income, expense: expense),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 16,
                  runSpacing: 8,
                  alignment: WrapAlignment.center,
                  children: [
                    _LegendChip(color: Colors.greenAccent, label: 'Income: ${formatNumber(income)}'),
                    _LegendChip(color: Colors.redAccent, label: 'Expense: ${formatNumber(expense)}'),
                  ],
                ),
              ],
            );
          },
        );
      },
    );
  }
}

class _LegendChip extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendChip({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
      ],
    );
  }
}

class _PieChartPainter extends CustomPainter {
  final double income;
  final double expense;
  _PieChartPainter({required this.income, required this.expense});

  @override
  void paint(Canvas canvas, Size size) {
    final total = (income + expense);
    final rect = Offset.zero & size;
    final center = rect.center;
    final radius = math.min(size.width, size.height) / 2;
    final stroke = radius; // full pie

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.butt;

    double startAngle = -math.pi / 2;
    // Income slice
    if (income > 0) {
      final sweepIncome = (income / total) * 2 * math.pi;
      paint.color = Colors.greenAccent.withValues(alpha: 0.9);
      canvas.drawArc(Rect.fromCircle(center: center, radius: radius), startAngle, sweepIncome, false, paint);
      startAngle += sweepIncome;
    }
    // Expense slice
    if (expense > 0) {
      final sweepExpense = (expense / total) * 2 * math.pi;
      paint.color = Colors.redAccent.withValues(alpha: 0.9);
      canvas.drawArc(Rect.fromCircle(center: center, radius: radius), startAngle, sweepExpense, false, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _PieChartPainter oldDelegate) {
    return oldDelegate.income != income || oldDelegate.expense != expense;
  }
}
/*
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../services/finance_models.dart';
import '../../services/project_finance_service.dart';
import 'account_detail_screen.dart';
import 'transaction_create_screen.dart';

class FinanceTab extends StatefulWidget {
  final String profileId;
  const FinanceTab({super.key, required this.profileId});

  @override
  State<FinanceTab> createState() => _FinanceTabState();
}

class _FinanceTabState extends State<FinanceTab> {
  late final String _projectId = widget.profileId; // profileId post-migration
  final List<ProjectTransaction> _optimistic = [];
  bool _exporting = false;

  void _addOptimistic(ProjectTransaction tx) {
    setState(() {
      _optimistic.removeWhere((t) => t.id == tx.id);
      _optimistic.insert(0, tx);
    });
  }

  Future<void> _openAddAccount() async {
    final nameCtrl = TextEditingController();
    final currencyCtrl = TextEditingController(text: 'USD');
    String accountType = 'bank';
    final created = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Account'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name')),
            const SizedBox(height: 8),
            TextField(controller: currencyCtrl, decoration: const InputDecoration(labelText: 'Currency (e.g., USD)')),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: accountType,
              items: const [
                DropdownMenuItem(value: 'bank', child: Text('Bank')),
                DropdownMenuItem(value: 'mobileMoney', child: Text('Mobile Money')),
                DropdownMenuItem(value: 'cash', child: Text('Cash')),
              ],
              onChanged: (v) => accountType = v ?? 'bank',
              decoration: const InputDecoration(labelText: 'Type'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Create')),
        ],
      ),
    );
    if (created == true) {
      try {
        await ProjectFinanceService.instance.createAccount(
          profileId: _projectId,
          name: nameCtrl.text,
          currency: currencyCtrl.text,
          accountType: accountType,
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Account created')));
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
        }
      }
    }
  }

  Future<void> _openAddTransaction() async {
    await showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.trending_up),
              title: const Text('Income'),
              onTap: () async {
                Navigator.pop(ctx);
                final changed = await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => TransactionCreateScreen(projectId: _projectId, mode: TxFormMode.income),
                  ),
                );
                if (changed is ProjectTransaction && mounted) {
                  _addOptimistic(changed);
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
                    builder: (_) => TransactionCreateScreen(projectId: _projectId, mode: TxFormMode.expense),
                  ),
                );
                if (changed is ProjectTransaction && mounted) {
                  _addOptimistic(changed);
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
                    builder: (_) => TransactionCreateScreen(projectId: _projectId, mode: TxFormMode.transfer),
                  ),
                );
                if (changed is ProjectTransaction && mounted) {
                  _addOptimistic(changed);
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Transfer recorded')));
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _exportCsv() async {
    if (_exporting) return;
    setState(() {
      _exporting = true;
    });
    try {
      final snap = await FirebaseFirestore.instance
          .collection('profiles')
          .doc(_projectId)
          .collection('profileTransactions')
          .orderBy('effectiveDate', descending: true)
          .limit(500)
          .get();
      final rows = <List<String>>[];
      rows.add([
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
      ]);
      for (final d in snap.docs) {
        final data = d.data();
        rows.add([
          d.id,
          (data['type'] ?? '').toString(),
          (data['primaryAccountId'] ?? '').toString(),
          (data['secondaryAccountId'] ?? '').toString(),
          (data['amount'] is num) ? (data['amount'] as num).toString() : '',
          (data['secondaryAmount'] is num) ? (data['secondaryAmount'] as num).toString() : '',
          (data['currency'] ?? '').toString(),
          (data['secondaryCurrency'] ?? '').toString(),
          (data['category'] ?? '').toString(),
          (data['description'] ?? '').toString().replaceAll('\n', ' '),
          (data['counterpartyName'] ?? '').toString(),
          (data['counterpartyContact'] ?? '').toString(),
          data['effectiveDate'] is Timestamp ? (data['effectiveDate'] as Timestamp).toDate().toIso8601String() : '',
          data['reversed'] == true ? 'true' : 'false',
          data['createdAt'] is Timestamp ? (data['createdAt'] as Timestamp).toDate().toIso8601String() : '',
          (data['createdBy'] ?? '').toString(),
        ]);
      }
      final csvString = rows.map((r) => r.map(_csvEscape).join(',')).join('\n');
      await Clipboard.setData(ClipboardData(text: csvString));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('CSV copied to clipboard')));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Export failed: $e')));
      }
    } finally {
      if (mounted) {
        setState(() {
          _exporting = false;
        });
      }
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
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          FloatingActionButton.small(
            heroTag: 'fab-acc',
            tooltip: 'Add Account',
            onPressed: _openAddAccount,
            child: const Icon(Icons.account_balance_wallet),
          ),
          const SizedBox(height: 12),
          FloatingActionButton(
            heroTag: 'fab-tx',
            tooltip: 'Add Transaction',
            onPressed: _openAddTransaction,
            child: const Icon(Icons.add),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Accounts', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                const Spacer(),
                IconButton(
                  tooltip: _exporting ? 'Exporting...' : 'Export CSV',
                  onPressed: _exporting ? null : _exportCsv,
                  icon: _exporting
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.download, size: 20),
                ),
                IconButton(onPressed: _openAddAccount, icon: const Icon(Icons.add_card, size: 20), tooltip: 'New Account'),
              ],
            ),
            SizedBox(
              height: 110,
              child: StreamBuilder<List<ProjectAccount>>(
                stream: ProjectFinanceService.instance.watchAccounts(_projectId),
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final accounts = snap.data ?? const [];
                  if (accounts.isEmpty) {
                    return InkWell(
                      onTap: _openAddAccount,
                      child: Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                          borderRadius: BorderRadius.circular(14),
                          color: Colors.white.withValues(alpha: 0.03),
                        ),
                        padding: const EdgeInsets.all(16),
                        child: const Center(child: Text('No accounts yet. Tap to create.')),
                      ),
                    );
                  }
                  return ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: accounts.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 12),
                    itemBuilder: (context, i) {
                      final a = accounts[i];
                      return InkWell(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => AccountDetailScreen(profileId: _projectId, account: a),
                            ),
                          );
                        },
                        child: Container(
                          width: 180,
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                            borderRadius: BorderRadius.circular(14),
                            color: Colors.white.withValues(alpha: 0.05),
                          ),
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(a.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                              const SizedBox(height: 4),
                              Text(
                                '${a.currency} • ${a.accountType == 'mobileMoney' ? 'Mobile Money' : (a.accountType == 'cash' ? 'Cash' : 'Bank')}',
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12),
                              ),
                              const Spacer(),
                              Text(
                                'Bal: ${formatCurrency(a.currency, (a.currentBalance ?? a.openingBalance))}',
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
            Flexible(child: _SpendingByCategory(profileId: _projectId)),
            const SizedBox(height: 16),
            Text('Recent Transactions', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Expanded(
              child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: FirebaseFirestore.instance
                    .collection('profiles')
                    .doc(_projectId)
                    .collection('profileTransactions')
                    .orderBy('effectiveDate', descending: true)
                    .limit(50)
                    .snapshots(),
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final docs = snap.data?.docs ?? const [];
                  final displayedOptimistic = _optimistic.where((o) => !docs.any((d) => d.id == o.id)).toList();
                  if (docs.isEmpty && displayedOptimistic.isEmpty) {
                    return const Center(child: Text('No transactions yet.'));
                  }
                  final totalCount = displayedOptimistic.length + docs.length;
                  return ListView.separated(
                    itemCount: totalCount,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final isOptimistic = i < displayedOptimistic.length;
                      Map<String, dynamic> map;
                      String docId;
                      if (isOptimistic) {
                        final o = displayedOptimistic[i];
                        map = o.toMap();
                        map['effectiveDate'] = o.effectiveDate; // timestamp
                        docId = o.id;
                      } else {
                        final realIndex = i - displayedOptimistic.length;
                        map = docs[realIndex].data();
                        docId = docs[realIndex].id;
                      }
                      final type = (map['type'] ?? '').toString();
                      final amount = (map['amount'] is num) ? (map['amount'] as num).toDouble() : 0.0;
                      final secondaryAmount = (map['secondaryAmount'] is num) ? (map['secondaryAmount'] as num).toDouble() : null;
                      final currency = (map['currency'] ?? '').toString();
                      final secCurrency = (map['secondaryCurrency'] ?? '').toString();
                      final category = (map['category'] ?? '').toString();
                      final eff = map['effectiveDate'] is Timestamp ? (map['effectiveDate'] as Timestamp).toDate() : DateTime.now();
                      String label;
                      IconData icon;
                      Color? col;
                      if (type == 'income') {
                        icon = Icons.trending_up;
                        col = Colors.greenAccent;
                        label = 'Income';
                      } else if (type == 'expense') {
                        icon = Icons.trending_down;
                        col = Colors.redAccent;
                        label = 'Expense';
                      } else {
                        icon = Icons.swap_horiz;
                        col = Colors.amberAccent;
                        label = 'Transfer';
                      }
                      final reversed = map['reversed'] == true;
                      final titleStyle = reversed ? const TextStyle(decoration: TextDecoration.lineThrough, color: Colors.grey) : null;
                      return ListTile(
                        leading: Stack(
                          children: [
                            CircleAvatar(backgroundColor: col.withValues(alpha: 0.15), child: Icon(icon, color: col, size: 18)),
                            if (isOptimistic)
                              const Positioned(
                                right: 0,
                                bottom: 0,
                                child: Icon(Icons.cloud_upload, size: 14, color: Colors.orangeAccent),
                              ),
                            if (reversed)
                              const Positioned(
                                right: 0,
                                top: 0,
                                child: Icon(Icons.undo, size: 14, color: Colors.redAccent),
                              ),
                          ],
                        ),
                        title: Text('$label • $category', style: titleStyle),
                        subtitle: Text(eff.toLocal().toIso8601String().split('T').first),
                        trailing: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(formatCurrency(currency, amount), style: reversed ? const TextStyle(decoration: TextDecoration.lineThrough, color: Colors.grey) : null),
                            if (secondaryAmount != null && secondaryAmount != amount)
                              Text(formatCurrency(secCurrency, secondaryAmount), style: TextStyle(color: reversed ? Colors.grey : Colors.white.withValues(alpha: 0.7), fontSize: 11, decoration: reversed ? TextDecoration.lineThrough : null)),
                          ],
                        ),
                        onLongPress: () async {
                          if (reversed) {
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Already reversed')));
                            return;
                          }
                          final scaffold = ScaffoldMessenger.of(context);
                          final confirm = await showDialog<bool>(
                            context: context,
                            builder: (ctx) => AlertDialog(
                              title: const Text('Reverse Transaction'),
                              content: const Text('This will create a compensating adjustment to balances. Proceed?'),
                              actions: [
                                TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                                FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Reverse')),
                              ],
                            ),
                          );
                          if (confirm == true) {
                            try {
                              await ProjectFinanceService.instance.reverseTransaction(profileId: _projectId, transactionId: docId);
                              scaffold.showSnackBar(const SnackBar(content: Text('Transaction reversed')));
                            } catch (e) {
                              scaffold.showSnackBar(SnackBar(content: Text('Failed: $e')));
                            }
                          }
                        },
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SpendingByCategory extends StatefulWidget {
  final String profileId;
  const _SpendingByCategory({required this.profileId});

  @override
  State<_SpendingByCategory> createState() => _SpendingByCategoryState();
}

class _SpendingByCategoryState extends State<_SpendingByCategory> {
  static const List<int> _options = [30, 90, 365];
  int _days = 90;

  @override
  Widget build(BuildContext context) {
    final since = Timestamp.fromDate(DateTime.now().subtract(Duration(days: _days)));
    final q = FirebaseFirestore.instance
        .collection('profiles')
        .doc(widget.profileId)
        .collection('profileTransactions')
        .where('type', isEqualTo: 'expense')
        .where('effectiveDate', isGreaterThanOrEqualTo: since)
        .orderBy('effectiveDate', descending: true)
        .limit(500);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LayoutBuilder(
          builder: (ctx, constraints) {
            final isNarrow = constraints.maxWidth < 380;
            if (isNarrow) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Spending (${_days}d) by Category',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: _options.map((d) {
                      final selected = d == _days;
                      return ChoiceChip(
                        label: Text('${d}d'),
                        selected: selected,
                        onSelected: (v) {
                          if (v && d != _days) setState(() => _days = d);
                        },
                      );
                    }).toList(),
                  ),
                ],
              );
            }
            return Row(
              children: [
                Expanded(
                  child: Text(
                    'Spending (${_days}d) by Category',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Wrap(
                  spacing: 6,
                  children: _options.map((d) {
                    final selected = d == _days;
                    return ChoiceChip(
                      label: Text('${d}d'),
                      selected: selected,
                      onSelected: (v) {
                        if (v && d != _days) setState(() => _days = d);
                      },
                    );
                  }).toList(),
                ),
              ],
            );
          },
        ),
        const SizedBox(height: 6),
        Expanded(
          child: LayoutBuilder(
            builder: (ctx, c) {
              if (c.maxHeight < 56) {
                return Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                    borderRadius: BorderRadius.circular(14),
                    color: Colors.white.withValues(alpha: 0.03),
                  ),
                  alignment: Alignment.center,
                  padding: const EdgeInsets.all(8),
                  child: const Text('Not enough space to show chart'),
                );
              }
              final pad = c.maxHeight < 100 ? 8.0 : 12.0;
              return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: q.snapshots(),
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final map = <String, double>{};
                  for (final d in snap.data?.docs ?? const []) {
                    final data = d.data();
                    final cat = (data['category'] ?? 'Other').toString();
                    final amt = (data['amount'] is num) ? (data['amount'] as num).toDouble() : 0.0;
                    map[cat] = (map[cat] ?? 0) + amt;
                  }
                  if (map.isEmpty) {
                    return Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                        borderRadius: BorderRadius.circular(14),
                        color: Colors.white.withValues(alpha: 0.03),
                      ),
                      padding: EdgeInsets.all(pad),
                      child: const Center(child: Text('No spending yet.')),
                    );
                  }
                  final entries = map.entries.toList()
                    ..sort((a, b) => b.value.compareTo(a.value));
                  final top = entries.take(6).toList();
                  final maxVal = top.map((e) => e.value).fold<double>(0, (p, c) => c > p ? c : p);
                  return Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                      borderRadius: BorderRadius.circular(14),
                      color: Colors.white.withValues(alpha: 0.03),
                    ),
                    padding: EdgeInsets.all(pad),
                    child: ListView.separated(
                      physics: const ClampingScrollPhysics(),
                      itemCount: top.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, i) {
                        final e = top[i];
                        final pct = maxVal > 0 ? (e.value / maxVal) : 0;
                        return Row(
                          children: [
                            SizedBox(width: 90, child: Text(e.key, maxLines: 1, overflow: TextOverflow.ellipsis)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Stack(
                                children: [
                                  Container(
                                    height: 16,
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.06),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                  ),
                                  FractionallySizedBox(
                                    widthFactor: pct.clamp(0.0, 1.0).toDouble(),
                                    child: Container(
                                      height: 16,
                                      decoration: BoxDecoration(
                                        color: Colors.redAccent.withValues(alpha: 0.7),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            SizedBox(
                              width: 72,
                              child: Text(
                                e.value.toStringAsFixed(0),
                                textAlign: TextAlign.right,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../services/finance_models.dart';
import '../../services/project_finance_service.dart';
import 'account_detail_screen.dart';
import 'transaction_create_screen.dart';

class FinanceTab extends StatefulWidget {
  final String profileId;
  const FinanceTab({super.key, required this.profileId});

  @override
  State<FinanceTab> createState() => _FinanceTabState();
}

class _FinanceTabState extends State<FinanceTab> {
  late final String _projectId = widget.profileId; // profileId post-migration
  final List<ProjectTransaction> _optimistic = [];
  bool _exporting = false;

  void _addOptimistic(ProjectTransaction tx) {
    setState(() {
      _optimistic.removeWhere((t) => t.id == tx.id);
      _optimistic.insert(0, tx);
    });
  }

  Future<void> _openAddAccount() async {
    final nameCtrl = TextEditingController();
    final currencyCtrl = TextEditingController(text: 'USD');
    String accountType = 'bank';
    final created = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Account'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name')),
            const SizedBox(height: 8),
            TextField(controller: currencyCtrl, decoration: const InputDecoration(labelText: 'Currency (e.g., USD)')),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: accountType,
              items: const [
                DropdownMenuItem(value: 'bank', child: Text('Bank')),
                DropdownMenuItem(value: 'mobileMoney', child: Text('Mobile Money')),
                DropdownMenuItem(value: 'cash', child: Text('Cash')),
              ],
              onChanged: (v) => accountType = v ?? 'bank',
              decoration: const InputDecoration(labelText: 'Type'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Create')),
        ],
      ),
    );
    if (created == true) {
      try {
        await ProjectFinanceService.instance.createAccount(
          profileId: _projectId,
          name: nameCtrl.text,
          currency: currencyCtrl.text,
          accountType: accountType,
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Account created')));
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
        }
      }
    }
  }

  Future<void> _openAddTransaction() async {
    await showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.trending_up),
              title: const Text('Income'),
              onTap: () async {
                Navigator.pop(ctx);
                final changed = await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => TransactionCreateScreen(projectId: _projectId, mode: TxFormMode.income),
                  ),
                );
                if (changed is ProjectTransaction && mounted) {
                  _addOptimistic(changed);
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
                    builder: (_) => TransactionCreateScreen(projectId: _projectId, mode: TxFormMode.expense),
                  ),
                );
                if (changed is ProjectTransaction && mounted) {
                  _addOptimistic(changed);
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
                    builder: (_) => TransactionCreateScreen(projectId: _projectId, mode: TxFormMode.transfer),
                  ),
                );
                if (changed is ProjectTransaction && mounted) {
                  _addOptimistic(changed);
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Transfer recorded')));
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _exportCsv() async {
    if (_exporting) return;
    setState(() {
      _exporting = true;
    });
    try {
      final snap = await FirebaseFirestore.instance
          .collection('profiles')
          .doc(_projectId)
          .collection('profileTransactions')
          .orderBy('effectiveDate', descending: true)
          .limit(500)
          .get();
      final rows = <List<String>>[];
      rows.add([
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
      ]);
      for (final d in snap.docs) {
        final data = d.data();
        rows.add([
          d.id,
          (data['type'] ?? '').toString(),
          (data['primaryAccountId'] ?? '').toString(),
          (data['secondaryAccountId'] ?? '').toString(),
          (data['amount'] is num) ? (data['amount'] as num).toString() : '',
          (data['secondaryAmount'] is num) ? (data['secondaryAmount'] as num).toString() : '',
          (data['currency'] ?? '').toString(),
          (data['secondaryCurrency'] ?? '').toString(),
          (data['category'] ?? '').toString(),
          (data['description'] ?? '').toString().replaceAll('\n', ' '),
          (data['counterpartyName'] ?? '').toString(),
          (data['counterpartyContact'] ?? '').toString(),
          data['effectiveDate'] is Timestamp ? (data['effectiveDate'] as Timestamp).toDate().toIso8601String() : '',
          data['reversed'] == true ? 'true' : 'false',
          data['createdAt'] is Timestamp ? (data['createdAt'] as Timestamp).toDate().toIso8601String() : '',
          (data['createdBy'] ?? '').toString(),
        ]);
      }
      final csvString = rows.map((r) => r.map(_csvEscape).join(',')).join('\n');
      await Clipboard.setData(ClipboardData(text: csvString));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('CSV copied to clipboard')));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Export failed: $e')));
      }
    } finally {
      if (mounted) {
        setState(() {
          _exporting = false;
        });
      }
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
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          FloatingActionButton.small(
            heroTag: 'fab-acc',
            tooltip: 'Add Account',
            onPressed: _openAddAccount,
            child: const Icon(Icons.account_balance_wallet),
          ),
          const SizedBox(height: 12),
          FloatingActionButton(
            heroTag: 'fab-tx',
            tooltip: 'Add Transaction',
            onPressed: _openAddTransaction,
            child: const Icon(Icons.add),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Accounts', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                const Spacer(),
                IconButton(
                  tooltip: _exporting ? 'Exporting...' : 'Export CSV',
                  onPressed: _exporting ? null : _exportCsv,
                  icon: _exporting
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.download, size: 20),
                ),
                IconButton(onPressed: _openAddAccount, icon: const Icon(Icons.add_card, size: 20), tooltip: 'New Account'),
              ],
            ),
            SizedBox(
              height: 110,
              child: StreamBuilder<List<ProjectAccount>>(
                stream: ProjectFinanceService.instance.watchAccounts(_projectId),
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final accounts = snap.data ?? const [];
                  if (accounts.isEmpty) {
                    return InkWell(
                      onTap: _openAddAccount,
                      child: Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                          borderRadius: BorderRadius.circular(14),
                          color: Colors.white.withValues(alpha: 0.03),
                        ),
                        padding: const EdgeInsets.all(16),
                        child: const Center(child: Text('No accounts yet. Tap to create.')),
                      ),
                    );
                  }
                  return ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: accounts.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 12),
                    itemBuilder: (context, i) {
                      final a = accounts[i];
                      return InkWell(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => AccountDetailScreen(profileId: _projectId, account: a),
                            ),
                          );
                        },
                        child: Container(
                          width: 180,
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                            borderRadius: BorderRadius.circular(14),
                            color: Colors.white.withValues(alpha: 0.05),
                          ),
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(a.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                              const SizedBox(height: 4),
                              Text(
                                '${a.currency} • ${a.accountType == 'mobileMoney' ? 'Mobile Money' : (a.accountType == 'cash' ? 'Cash' : 'Bank')}',
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12),
                              ),
                              const Spacer(),
                              Text(
                                'Bal: ${((a.currentBalance ?? a.openingBalance).toStringAsFixed(2))} ${a.currency}',
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
            Flexible(child: _SpendingByCategory(profileId: _projectId)),
            const SizedBox(height: 16),
            Text('Recent Transactions', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Expanded(
              child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: FirebaseFirestore.instance
                    .collection('profiles')
                    .doc(_projectId)
                    .collection('profileTransactions')
                    .orderBy('effectiveDate', descending: true)
                    .limit(50)
                    .snapshots(),
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final docs = snap.data?.docs ?? const [];
                  final displayedOptimistic = _optimistic.where((o) => !docs.any((d) => d.id == o.id)).toList();
                  if (docs.isEmpty && displayedOptimistic.isEmpty) {
                    return const Center(child: Text('No transactions yet.'));
                  }
                  final totalCount = displayedOptimistic.length + docs.length;
                  return ListView.separated(
                    itemCount: totalCount,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final isOptimistic = i < displayedOptimistic.length;
                      Map<String, dynamic> map;
                      String docId;
                      if (isOptimistic) {
                        final o = displayedOptimistic[i];
                        map = o.toMap();
                        map['effectiveDate'] = o.effectiveDate;
                        docId = o.id;
                      } else {
                        final realIndex = i - displayedOptimistic.length;
                        map = docs[realIndex].data();
                        docId = docs[realIndex].id;
                      }
                      final type = (map['type'] ?? '').toString();
                      final amount = (map['amount'] is num) ? (map['amount'] as num).toDouble() : 0.0;
                      final secondaryAmount = (map['secondaryAmount'] is num) ? (map['secondaryAmount'] as num).toDouble() : null;
                      final currency = (map['currency'] ?? '').toString();
                      final secCurrency = (map['secondaryCurrency'] ?? '').toString();
                      final category = (map['category'] ?? '').toString();
                      final eff = map['effectiveDate'] is Timestamp ? (map['effectiveDate'] as Timestamp).toDate() : DateTime.now();
                      String label;
                      IconData icon;
                      Color? col;
                      if (type == 'income') {
                        icon = Icons.trending_up;
                        col = Colors.greenAccent;
                        label = 'Income';
                      } else if (type == 'expense') {
                        icon = Icons.trending_down;
                        col = Colors.redAccent;
                        label = 'Expense';
                      } else {
                        icon = Icons.swap_horiz;
                        col = Colors.amberAccent;
                        label = 'Transfer';
                      }
                      final reversed = map['reversed'] == true;
                      final titleStyle = reversed ? const TextStyle(decoration: TextDecoration.lineThrough, color: Colors.grey) : null;
                      return ListTile(
                        leading: Stack(
                          children: [
                            CircleAvatar(backgroundColor: col.withValues(alpha: 0.15), child: Icon(icon, color: col, size: 18)),
                            if (isOptimistic)
                              const Positioned(
                                right: 0,
                                bottom: 0,
                                child: Icon(Icons.cloud_upload, size: 14, color: Colors.orangeAccent),
                              ),
                            if (reversed)
                              const Positioned(
                                right: 0,
                                top: 0,
                                child: Icon(Icons.undo, size: 14, color: Colors.redAccent),
                              ),
                          ],
                        ),
                        title: Text('$label • $category', style: titleStyle),
                        subtitle: Text(eff.toLocal().toIso8601String().split('T').first),
                        trailing: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text('${amount.toStringAsFixed(2)} $currency', style: reversed ? const TextStyle(decoration: TextDecoration.lineThrough, color: Colors.grey) : null),
                            if (secondaryAmount != null && secondaryAmount != amount)
                              Text('${secondaryAmount.toStringAsFixed(2)} $secCurrency', style: TextStyle(color: reversed ? Colors.grey : Colors.white.withValues(alpha: 0.7), fontSize: 11, decoration: reversed ? TextDecoration.lineThrough : null)),
                          ],
                        ),
                        onLongPress: () async {
                          if (reversed) {
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Already reversed')));
                            return;
                          }
                          final scaffold = ScaffoldMessenger.of(context);
                          final confirm = await showDialog<bool>(
                            context: context,
                            builder: (ctx) => AlertDialog(
                              title: const Text('Reverse Transaction'),
                              content: const Text('This will create a compensating adjustment to balances. Proceed?'),
                              actions: [
                                TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                                FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Reverse')),
                              ],
                            ),
                          );
                          if (confirm == true) {
                            try {
                              await ProjectFinanceService.instance.reverseTransaction(profileId: _projectId, transactionId: docId);
                              scaffold.showSnackBar(const SnackBar(content: Text('Transaction reversed')));
                            } catch (e) {
                              scaffold.showSnackBar(SnackBar(content: Text('Failed: $e')));
                            }
                          }
                        },
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SpendingByCategory extends StatefulWidget {
  final String profileId;
  const _SpendingByCategory({required this.profileId});

  @override
  State<_SpendingByCategory> createState() => _SpendingByCategoryState();
}

class _SpendingByCategoryState extends State<_SpendingByCategory> {
  static const List<int> _options = [30, 90, 365];
  int _days = 90;

  @override
  Widget build(BuildContext context) {
    final since = Timestamp.fromDate(DateTime.now().subtract(Duration(days: _days)));
    final q = FirebaseFirestore.instance
        .collection('profiles')
        .doc(widget.profileId)
        .collection('profileTransactions')
        .where('type', isEqualTo: 'expense')
        .where('effectiveDate', isGreaterThanOrEqualTo: since)
        .orderBy('effectiveDate', descending: true)
        .limit(500);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LayoutBuilder(
          builder: (ctx, constraints) {
            final isNarrow = constraints.maxWidth < 380;
            if (isNarrow) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Spending (${_days}d) by Category',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: _options.map((d) {
                      final selected = d == _days;
                      return ChoiceChip(
                        label: Text('${d}d'),
                        selected: selected,
                        onSelected: (v) {
                          if (v && d != _days) setState(() => _days = d);
                        },
                      );
                    }).toList(),
                  ),
                ],
              );
            }
            return Row(
              children: [
                Expanded(
                  child: Text(
                    'Spending (${_days}d) by Category',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Wrap(
                  spacing: 6,
                  children: _options.map((d) {
                    final selected = d == _days;
                    return ChoiceChip(
                      label: Text('${d}d'),
                      selected: selected,
                      onSelected: (v) {
                        if (v && d != _days) setState(() => _days = d);
                      },
                    );
                  }).toList(),
                ),
              ],
            );
          },
        ),
        const SizedBox(height: 6),
        Expanded(
          child: LayoutBuilder(
            builder: (ctx, c) {
              if (c.maxHeight < 56) {
                return Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                    borderRadius: BorderRadius.circular(14),
                    color: Colors.white.withValues(alpha: 0.03),
                  ),
                  alignment: Alignment.center,
                  padding: const EdgeInsets.all(8),
                  child: const Text('Not enough space to show chart'),
                );
              }
              final pad = c.maxHeight < 100 ? 8.0 : 12.0;
              return StreamBuilder<QuerySnapshot<Map<String, dynamic}}>(
                stream: q.snapshots(),
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                  }
                        docId = o.id;
                      } else {
                        final realIndex = i - displayedOptimistic.length;
                        map = docs[realIndex].data();
                        docId = docs[realIndex].id;
                      }
                      final type = (map['type'] ?? '').toString();
                      final amount = (map['amount'] is num) ? (map['amount'] as num).toDouble() : 0.0;
                      final secondaryAmount = (map['secondaryAmount'] is num) ? (map['secondaryAmount'] as num).toDouble() : null;
                      final currency = (map['currency'] ?? '').toString();
                      final secCurrency = (map['secondaryCurrency'] ?? '').toString();
                      final category = (map['category'] ?? '').toString();
                      final eff = map['effectiveDate'] is Timestamp ? (map['effectiveDate'] as Timestamp).toDate() : DateTime.now();
                      String label;
                      IconData icon;
                      Color? col;
                      if (type == 'income') { icon = Icons.trending_up; col = Colors.greenAccent; label = 'Income'; }
                      else if (type == 'expense') { icon = Icons.trending_down; col = Colors.redAccent; label = 'Expense'; }
                      else { icon = Icons.swap_horiz; col = Colors.amberAccent; label = 'Transfer'; }
                      final reversed = map['reversed'] == true;
                      final titleStyle = reversed ? const TextStyle(decoration: TextDecoration.lineThrough, color: Colors.grey) : null;
                      return ListTile(
                        leading: Stack(
                          children: [
                            CircleAvatar(backgroundColor: col.withValues(alpha: 0.15), child: Icon(icon, color: col, size: 18)),
                            if (isOptimistic)
                              const Positioned(
                                right: 0,
                                bottom: 0,
                                child: Icon(Icons.cloud_upload, size: 14, color: Colors.orangeAccent),
                              ),
                            if (reversed)
                              const Positioned(
                                right: 0,
                                top: 0,
                                child: Icon(Icons.undo, size: 14, color: Colors.redAccent),
                              ),
                          ],
                        ),
                        title: Text('$label • $category', style: titleStyle),
                        subtitle: Text(eff.toLocal().toIso8601String().split('T').first),
                        trailing: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text('${amount.toStringAsFixed(2)} $currency', style: reversed ? const TextStyle(decoration: TextDecoration.lineThrough, color: Colors.grey) : null),
                            if (secondaryAmount != null && secondaryAmount != amount)
                              Text('${secondaryAmount.toStringAsFixed(2)} $secCurrency', style: TextStyle(color: reversed ? Colors.grey : Colors.white.withValues(alpha: 0.7), fontSize: 11, decoration: reversed ? TextDecoration.lineThrough : null)),
                          ],
                        ),
                        onLongPress: () async {
                          if (reversed) {
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Already reversed')));
                            return;
                          }
                          final scaffold = ScaffoldMessenger.of(context);
                          final confirm = await showDialog<bool>(
                            context: context,
                            builder: (ctx) => AlertDialog(
                              title: const Text('Reverse Transaction'),
                              content: const Text('This will create a compensating adjustment to balances. Proceed?'),
                              actions: [
                                TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                                FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Reverse')),
                              ],
                            ),
                          );
                          if (confirm == true) {
                            try {
                              await ProjectFinanceService.instance.reverseTransaction(profileId: _projectId, transactionId: docId);
                              scaffold.showSnackBar(const SnackBar(content: Text('Transaction reversed')));
                            } catch (e) {
                              scaffold.showSnackBar(SnackBar(content: Text('Failed: $e')));
                            }
                          }
                        },
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SpendingByCategory extends StatefulWidget {
  final String profileId;
  const _SpendingByCategory({required this.profileId});

  @override
  State<_SpendingByCategory> createState() => _SpendingByCategoryState();
}

class _SpendingByCategoryState extends State<_SpendingByCategory> {
  // Allowed timeframes in days
  static const List<int> _options = [30, 90, 365];
  int _days = 90;

  @override
  Widget build(BuildContext context) {
    final since = Timestamp.fromDate(DateTime.now().subtract(Duration(days: _days)));
    final q = FirebaseFirestore.instance
        .collection('profiles')
        .doc(widget.profileId)
        .collection('profileTransactions')
        .where('type', isEqualTo: 'expense')
        .where('effectiveDate', isGreaterThanOrEqualTo: since)
        .orderBy('effectiveDate', descending: true)
        .limit(500);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LayoutBuilder(
          builder: (ctx, constraints) {
            final isNarrow = constraints.maxWidth < 380;
            if (isNarrow) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Spending (${_days}d) by Category',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: _options.map((d) {
                      final selected = d == _days;
                      return ChoiceChip(
                        label: Text('${d}d'),
                        selected: selected,
                        onSelected: (v) {
                          if (v && d != _days) setState(() => _days = d);
                        },
                      );
                    }).toList(),
                  ),
                ],
              );
            }
            return Row(
              children: [
                Expanded(
                  child: Text(
                    'Spending (${_days}d) by Category',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Wrap(
                  spacing: 6,
                  children: _options.map((d) {
                    final selected = d == _days;
                    return ChoiceChip(
                      label: Text('${d}d'),
                      selected: selected,
                      onSelected: (v) {
                        if (v && d != _days) setState(() => _days = d);
                      },
                    );
                  }).toList(),
                ),
              ],
            );
          },
        ),
        const SizedBox(height: 6),
        SizedBox(
          height: 160,
          child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: q.snapshots(),
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              final map = <String, double>{};
              for (final d in snap.data?.docs ?? const []) {
                final data = d.data();
                final cat = (data['category'] ?? 'Other').toString();
                final amt = (data['amount'] is num) ? (data['amount'] as num).toDouble() : 0.0;
                map[cat] = (map[cat] ?? 0) + amt;
              }
              if (map.isEmpty) {
                return Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                    borderRadius: BorderRadius.circular(14),
                    color: Colors.white.withValues(alpha: 0.03),
                  ),
                  padding: const EdgeInsets.all(16),
                  child: const Center(child: Text('No spending yet.')),
                );
              }
              final entries = map.entries.toList()
                ..sort((a, b) => b.value.compareTo(a.value));
              final top = entries.take(6).toList();
              final maxVal = top.map((e) => e.value).fold<double>(0, (p, c) => c > p ? c : p);
              return Container(
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                  borderRadius: BorderRadius.circular(14),
                  color: Colors.white.withValues(alpha: 0.03),
                ),
                padding: const EdgeInsets.all(12),
                  body: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                    child: LayoutBuilder(
                      builder: (ctx, constraints) {
                        final isShort = constraints.maxHeight < 560;
                        Widget buildTransactionsList({required bool embedded}) {
                          return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                            stream: FirebaseFirestore.instance
                                .collection('profiles')
                                .doc(_projectId) // using _projectId variable as profileId post-migration
                                .collection('profileTransactions')
                                .orderBy('effectiveDate', descending: true)
                                .limit(50)
                                .snapshots(),
                            builder: (context, snap) {
                              if (snap.connectionState == ConnectionState.waiting) {
                                return const Center(child: CircularProgressIndicator());
                              }
                              final docs = snap.data?.docs ?? const [];
                              final displayedOptimistic = _optimistic.where((o) => !docs.any((d) => d.id == o.id)).toList();
                              if (docs.isEmpty && displayedOptimistic.isEmpty) {
                                return const Center(child: Text('No transactions yet.'));
                              }
                              final totalCount = displayedOptimistic.length + docs.length;
                              final listView = ListView.separated(
                                primary: !embedded,
                                shrinkWrap: embedded,
                                physics: embedded ? const NeverScrollableScrollPhysics() : null,
                                itemCount: totalCount,
                                separatorBuilder: (_, __) => const Divider(height: 1),
                                itemBuilder: (context, i) {
                                  final isOptimistic = i < displayedOptimistic.length;
                                  Map<String, dynamic> map;
                                  String docId;
                                  if (isOptimistic) {
                                    final o = displayedOptimistic[i];
                                    map = o.toMap();
                                    map['effectiveDate'] = o.effectiveDate; // timestamp
                                    docId = o.id;
                                  } else {
                                    final realIndex = i - displayedOptimistic.length;
                                    map = docs[realIndex].data();
                                    docId = docs[realIndex].id;
                                  }
                                  final type = (map['type'] ?? '').toString();
                                  final amount = (map['amount'] is num) ? (map['amount'] as num).toDouble() : 0.0;
                                  final secondaryAmount = (map['secondaryAmount'] is num) ? (map['secondaryAmount'] as num).toDouble() : null;
                                  final currency = (map['currency'] ?? '').toString();
                                  final secCurrency = (map['secondaryCurrency'] ?? '').toString();
                                  final category = (map['category'] ?? '').toString();
                                  final eff = map['effectiveDate'] is Timestamp ? (map['effectiveDate'] as Timestamp).toDate() : DateTime.now();
                                  String label;
                                  IconData icon;
                                  Color? col;
                                  if (type == 'income') { icon = Icons.trending_up; col = Colors.greenAccent; label = 'Income'; }
                                  else if (type == 'expense') { icon = Icons.trending_down; col = Colors.redAccent; label = 'Expense'; }
                                  else { icon = Icons.swap_horiz; col = Colors.amberAccent; label = 'Transfer'; }
                                  final reversed = map['reversed'] == true;
                                  final titleStyle = reversed ? const TextStyle(decoration: TextDecoration.lineThrough, color: Colors.grey) : null;
                                  return ListTile(
                                    leading: Stack(
                                      children: [
                                        CircleAvatar(backgroundColor: col.withValues(alpha: 0.15), child: Icon(icon, color: col, size: 18)),
                                        if (isOptimistic)
                                          const Positioned(
                                            right: 0,
                                            bottom: 0,
                                            child: Icon(Icons.cloud_upload, size: 14, color: Colors.orangeAccent),
                                          ),
                                        if (reversed)
                                          const Positioned(
                                            right: 0,
                                            top: 0,
                                            child: Icon(Icons.undo, size: 14, color: Colors.redAccent),
                                          ),
                                      ],
                                    ),
                                    title: Text('$label • $category', style: titleStyle),
                                    subtitle: Text(eff.toLocal().toIso8601String().split('T').first),
                                    trailing: Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Text('${amount.toStringAsFixed(2)} $currency', style: reversed ? const TextStyle(decoration: TextDecoration.lineThrough, color: Colors.grey) : null),
                                        if (secondaryAmount != null && secondaryAmount != amount)
                                          Text('${secondaryAmount.toStringAsFixed(2)} $secCurrency', style: TextStyle(color: reversed ? Colors.grey : Colors.white.withValues(alpha: 0.7), fontSize: 11, decoration: reversed ? TextDecoration.lineThrough : null)),
                                      ],
                                    ),
                                    onLongPress: () async {
                                      if (reversed) {
                                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Already reversed')));
                                        return;
                                      }
                                      final scaffold = ScaffoldMessenger.of(context);
                                      final confirm = await showDialog<bool>(
                                        context: context,
                                        builder: (ctx) => AlertDialog(
                                          title: const Text('Reverse Transaction'),
                                          content: const Text('This will create a compensating adjustment to balances. Proceed?'),
                                          actions: [
                                            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                                            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Reverse')),
                                          ],
                                        ),
                                      );
                                      if (confirm == true) {
                                        try {
                                          await ProjectFinanceService.instance.reverseTransaction(profileId: _projectId, transactionId: docId);
                                          scaffold.showSnackBar(const SnackBar(content: Text('Transaction reversed')));
                                        } catch (e) {
                                          scaffold.showSnackBar(SnackBar(content: Text('Failed: $e')));
                                        }
                                      }
                                    },
                                  );
                                },
                              );
                              return listView;
                            },
                          );
                        }

                        final header = Row(
                          children: [
                            Text('Accounts', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                            const Spacer(),
                            IconButton(
                              tooltip: _exporting ? 'Exporting...' : 'Export CSV',
                              onPressed: _exporting ? null : _exportCsv,
                              icon: _exporting
                                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                                  : const Icon(Icons.download, size: 20),
                            ),
                            IconButton(onPressed: _openAddAccount, icon: const Icon(Icons.add_card, size: 20), tooltip: 'New Account'),
                          ],
                        );

                        final accountsStripe = SizedBox(
                          height: isShort ? 90 : 110,
                          child: StreamBuilder<List<ProjectAccount>>(
                            stream: ProjectFinanceService.instance.watchAccounts(_projectId), // _projectId now treated as profileId
                            builder: (context, snap) {
                              if (snap.connectionState == ConnectionState.waiting) {
                                return const Center(child: CircularProgressIndicator());
                              }
                              final accounts = snap.data ?? const [];
                              if (accounts.isEmpty) {
                                return InkWell(
                                  onTap: _openAddAccount,
                                  child: Container(
                                    decoration: BoxDecoration(
                                      border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                                      borderRadius: BorderRadius.circular(14),
                                      color: Colors.white.withValues(alpha: 0.03),
                                    ),
                                    padding: const EdgeInsets.all(16),
                                    child: const Center(child: Text('No accounts yet. Tap to create.')),
                                  ),
                                );
                              }
                              return ListView.separated(
                                scrollDirection: Axis.horizontal,
                                itemCount: accounts.length,
                                separatorBuilder: (_, __) => const SizedBox(width: 12),
                                itemBuilder: (context, i) {
                                  final a = accounts[i];
                                  return InkWell(
                                    onTap: () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) => AccountDetailScreen(profileId: _projectId, account: a),
                                        ),
                                      );
                                    },
                                    child: Container(
                                      width: 180,
                                      decoration: BoxDecoration(
                                        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                                        borderRadius: BorderRadius.circular(14),
                                        color: Colors.white.withValues(alpha: 0.05),
                                      ),
                                      padding: const EdgeInsets.all(12),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(a.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                                          const SizedBox(height: 4),
                                          Text('${a.currency} • ${a.accountType == 'mobileMoney' ? 'Mobile Money' : (a.accountType == 'cash' ? 'Cash' : 'Bank')}', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12)),
                                          const Spacer(),
                                          Text(
                                            'Bal: ${((a.currentBalance ?? a.openingBalance).toStringAsFixed(2))} ${a.currency}',
                                            style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 11),
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              );
                            },
                          ),
                        );

                        final top = [
                          header,
                          accountsStripe,
                          const SizedBox(height: 16),
                          if (isShort)
                            _SpendingByCategory(profileId: _projectId)
                          else
                            Flexible(child: _SpendingByCategory(profileId: _projectId)),
                          const SizedBox(height: 16),
                          Text('Recent Transactions', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                          const SizedBox(height: 8),
                        ];

                        if (isShort) {
                          return SingleChildScrollView(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                ...top,
                                buildTransactionsList(embedded: true),
                              ],
                            ),
                          );
                        } else {
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              ...top,
                              Expanded(child: buildTransactionsList(embedded: false)),
                            ],
                          );
                        }
                      },
                    ),
                    final e = top[i];
                    final pct = maxVal > 0 ? (e.value / maxVal) : 0;
                    return Row(
                      children: [
                        SizedBox(width: 90, child: Text(e.key, maxLines: 1, overflow: TextOverflow.ellipsis)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Stack(
                            children: [
                              Container(height: 16, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(8))),
                              FractionallySizedBox(
                                widthFactor: pct.clamp(0.0, 1.0).toDouble(),
                                child: Container(height: 16, decoration: BoxDecoration(color: Colors.redAccent.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(8))),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 72,
                          child: Text(
                            e.value.toStringAsFixed(0),
                            textAlign: TextAlign.right,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    );
                  },
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}


*/

