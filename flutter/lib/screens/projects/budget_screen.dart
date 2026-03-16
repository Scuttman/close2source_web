import 'package:flutter/material.dart';
import '../../services/budget_service.dart';
import '../../services/project_finance_service.dart';
import '../../services/finance_models.dart';
import '../../utils/currency.dart';

class BudgetScreen extends StatefulWidget {
  final String profileId;
  const BudgetScreen({super.key, required this.profileId});

  @override
  State<BudgetScreen> createState() => _BudgetScreenState();
}

class _BudgetScreenState extends State<BudgetScreen> {
  String _filter = 'all'; // all | income | expense | transfer

  Future<void> _addOrEdit({BudgetCategory? cat}) async {
    final nameCtrl = TextEditingController(text: cat?.name ?? '');
    final amountCtrl = TextEditingController(text: cat?.amount.toString() ?? '0');
    final currencyCtrl = TextEditingController(text: (cat?.currency ?? 'USD'));
    String type = cat?.type ?? 'expense';
    bool active = cat?.active ?? true;
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(cat == null ? 'Add Category' : 'Edit Category'),
        content: StatefulBuilder(
          builder: (ctx2, setDialogState) => SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name')),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: type,
                  items: const [
                    DropdownMenuItem(value: 'income', child: Text('Income')),
                    DropdownMenuItem(value: 'expense', child: Text('Expense')),
                    DropdownMenuItem(value: 'transfer', child: Text('Transfer')),
                  ],
                  onChanged: (v) => setDialogState(() => type = v ?? 'expense'),
                  decoration: const InputDecoration(labelText: 'Type'),
                ),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(
                    child: TextField(
                      controller: amountCtrl,
                      decoration: const InputDecoration(labelText: 'Planned Amount'),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                  ),
                  const SizedBox(width: 12),
                  SizedBox(
                    width: 90,
                    child: TextField(
                      controller: currencyCtrl,
                      maxLength: 3,
                      textCapitalization: TextCapitalization.characters,
                      decoration: const InputDecoration(labelText: 'CCY', counterText: ''),
                    ),
                  ),
                ]),
                const SizedBox(height: 8),
                SwitchListTile(
                  value: active,
                  onChanged: (v) => setDialogState(() => active = v),
                  title: const Text('Active'),
                  contentPadding: EdgeInsets.zero,
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
        ],
      ),
    );
    if (result == true) {
      try {
        final amount = double.tryParse(amountCtrl.text.trim()) ?? 0.0;
        final ccy = currencyCtrl.text.trim().toUpperCase();
        if (ccy.length != 3) throw Exception('Currency must be 3 letters');
        await BudgetService.instance.upsertCategory(
          profileId: widget.profileId,
          id: cat?.id,
          name: nameCtrl.text,
          type: type,
          amount: amount,
          currency: ccy,
          order: cat?.order,
          active: active,
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(cat == null ? 'Category added' : 'Category updated')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to save: $e')),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Budget'),
        actions: [
          PopupMenuButton<String>(
            initialValue: _filter,
            onSelected: (v) => setState(() => _filter = v),
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'all', child: Text('All')),
              PopupMenuItem(value: 'income', child: Text('Income')),
              PopupMenuItem(value: 'expense', child: Text('Expense')),
              PopupMenuItem(value: 'transfer', child: Text('Transfer')),
            ],
            icon: const Icon(Icons.filter_list),
          )
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _addOrEdit(),
        child: const Icon(Icons.add),
      ),
      body: LayoutBuilder(
        builder: (context, constraints) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12.0),
              child: _BudgetSummary(profileId: widget.profileId),
            ),
            const Divider(height: 1),
            Expanded(
              child: StreamBuilder<List<BudgetCategory>>(
              stream: BudgetService.instance.watchCategories(widget.profileId, type: _filter == 'all' ? null : _filter),
              builder: (context, snap) {
                final items = snap.data ?? const [];
                if (items.isEmpty) {
                    return SingleChildScrollView(
                      padding: const EdgeInsets.all(24),
                      child: SizedBox(
                        width: double.infinity,
                        child: Text(_filter == 'all' ? 'No categories yet' : 'No $_filter categories', textAlign: TextAlign.center),
                      ),
                    );
                }
                  return StreamBuilder<List<ProjectTransaction>>(
                    stream: ProjectFinanceService.instance.watchProfileTransactions(widget.profileId),
                    builder: (context, txSnap) {
                      final txs = txSnap.data ?? const <ProjectTransaction>[];
                      // Build actual totals by (type|nameLower|currency)
                      final Map<String, double> actuals = {};
                      for (final t in txs) {
                        final type = t.type == ProjectTransactionType.income
                            ? 'income'
                            : t.type == ProjectTransactionType.expense
                                ? 'expense'
                                : 'transfer';
                        final key = '$type|${t.category.toLowerCase()}|${t.currency}';
                        final prev = actuals[key] ?? 0.0;
                        actuals[key] = prev + t.amount;
                      }

                      return ReorderableListView.builder(
                        itemCount: items.length,
                        onReorder: (oldIndex, newIndex) async {
                          if (newIndex > oldIndex) newIndex -= 1;
                          final mutable = List<BudgetCategory>.from(items);
                          final item = mutable.removeAt(oldIndex);
                          mutable.insert(newIndex, item);
                          await BudgetService.instance.reorder(profileId: widget.profileId, categories: mutable);
                        },
                        itemBuilder: (context, i) {
                          final c = items[i];
                          final key = '${c.type}|${c.name.toLowerCase()}|${c.currency}';
                          final actual = actuals[key] ?? 0.0;
                          final planned = c.amount;
                          final progress = planned > 0 ? (actual / planned).clamp(0.0, 1.0) : 0.0;
                          return ListTile(
                            key: ValueKey(c.id),
                            leading: Icon(c.type == 'income' ? Icons.trending_up : c.type == 'expense' ? Icons.trending_down : Icons.swap_horiz),
                            title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                            isThreeLine: true,
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text('${c.type} • planned ${formatCurrency(c.currency, planned)} • actual ${formatCurrency(c.currency, actual)}'),
                                const SizedBox(height: 4),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: LinearProgressIndicator(
                                    minHeight: 6,
                                    value: progress.isNaN ? 0 : progress,
                                    backgroundColor: Colors.white.withValues(alpha: 0.08),
                                  ),
                                ),
                              ],
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(onPressed: () => _addOrEdit(cat: c), icon: const Icon(Icons.edit)),
                                IconButton(onPressed: () => BudgetService.instance.deleteCategory(profileId: widget.profileId, id: c.id), icon: const Icon(Icons.delete_outline)),
                              ],
                            ),
                          );
                        },
                      );
                    },
                  );
              },
              ),
            )
          ],
        ),
      ),
    );
  }
}

class _BudgetSummary extends StatelessWidget {
  final String profileId;
  const _BudgetSummary({required this.profileId});

  @override
  Widget build(BuildContext context) {
    // Stream planned (from categories) and actual (from transactions) and render both
    return StreamBuilder<List<BudgetCategory>>(
      stream: BudgetService.instance.watchCategories(profileId),
      builder: (context, catSnap) {
        final cats = catSnap.data ?? const <BudgetCategory>[];
        double plannedIncome = 0, plannedExpense = 0;
        for (final c in cats) {
          if (c.type == 'income') plannedIncome += c.amount;
          if (c.type == 'expense') plannedExpense += c.amount;
        }
        return StreamBuilder<List<ProjectTransaction>>(
          stream: ProjectFinanceService.instance.watchProfileTransactions(profileId),
          builder: (context, txSnap) {
            final txs = txSnap.data ?? const <ProjectTransaction>[];
            double actualIncome = 0, actualExpense = 0;
            for (final t in txs) {
              if (t.type == ProjectTransactionType.income) actualIncome += t.amount;
              if (t.type == ProjectTransactionType.expense) actualExpense += t.amount;
            }
            return Container(
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                borderRadius: BorderRadius.circular(12),
                color: Colors.white.withValues(alpha: 0.03),
              ),
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _Metric(label: 'Income (planned)', value: plannedIncome),
                        const SizedBox(height: 6),
                        _Metric(label: 'Income (actual)', value: actualIncome),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _Metric(label: 'Expense (planned)', value: plannedExpense),
                        const SizedBox(height: 6),
                        _Metric(label: 'Expense (actual)', value: actualExpense),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _Metric extends StatelessWidget {
  final String label; final double value;
  const _Metric({required this.label, required this.value});
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12)),
        const SizedBox(height: 2),
        Text(formatNumber(value), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
      ],
    );
  }
}
