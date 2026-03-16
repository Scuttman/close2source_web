import 'package:flutter/material.dart';

import '../../services/finance_models.dart';
import '../../services/project_finance_service.dart';
import '../../utils/currency.dart';
import 'account_detail_screen.dart';
import 'transaction_create_screen.dart';
import 'accounts_settings.dart';
import 'transaction_detail_screen.dart';

class AccountsScreen extends StatefulWidget {
  final String profileId;
  const AccountsScreen({super.key, required this.profileId});

  @override
  State<AccountsScreen> createState() => _AccountsScreenState();
}

class _AccountsScreenState extends State<AccountsScreen> {
  Future<void> _showCreateAccountForm() async {
    final nameCtrl = TextEditingController();
    final currencyCtrl = TextEditingController(text: 'USD');
    String type = 'cash'; // cash | bank | mobileMoney
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Create Account'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Name'),
              ),
              const SizedBox(height: 8),
              LayoutBuilder(
                builder: (context, c) {
                  final narrow = c.maxWidth < 340;
                  final currencyField = TextField(
                    controller: currencyCtrl,
                    maxLength: 3,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(labelText: 'Currency', hintText: 'USD', counterText: ''),
                  );
                  final typeField = DropdownButtonFormField<String>(
                    isExpanded: true,
                    initialValue: type,
                    decoration: const InputDecoration(labelText: 'Type'),
                    items: const [
                      DropdownMenuItem(value: 'cash', child: Text('Cash')),
                      DropdownMenuItem(value: 'bank', child: Text('Bank Account')),
                      DropdownMenuItem(value: 'mobileMoney', child: Text('Mobile Money')),
                    ],
                    onChanged: (v) => type = v ?? 'cash',
                  );
                  if (narrow) {
                    return Column(
                      children: [
                        currencyField,
                        const SizedBox(height: 8),
                        typeField,
                      ],
                    );
                  }
                  return Row(
                    children: [
                      Expanded(child: currencyField),
                      const SizedBox(width: 12),
                      Expanded(flex: 2, child: typeField),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Create')),
        ],
      ),
    );
    if (result == true) {
      try {
        final name = nameCtrl.text.trim();
        final ccy = currencyCtrl.text.trim().toUpperCase();
        if (name.isEmpty) throw Exception('Name required');
        if (ccy.length != 3) throw Exception('Currency must be 3 letters');
        await ProjectFinanceService.instance.createAccount(
          profileId: widget.profileId,
          name: name,
          currency: ccy,
          accountType: type,
        );
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Account created')));
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to create: $e')));
      }
    }
  }
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
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => TransactionCreateScreen(
                        projectId: widget.profileId,
                        mode: TxFormMode.income,
                      ),
                    ),
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.trending_down),
                title: const Text('Expense'),
                onTap: () async {
                  Navigator.pop(ctx);
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => TransactionCreateScreen(
                        projectId: widget.profileId,
                        mode: TxFormMode.expense,
                      ),
                    ),
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.swap_horiz),
                title: const Text('Transfer'),
                onTap: () async {
                  Navigator.pop(ctx);
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => TransactionCreateScreen(
                        projectId: widget.profileId,
                        mode: TxFormMode.transfer,
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Accounts'),
        actions: [
          IconButton(
            tooltip: 'Settings',
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => AccountsSettingsScreen(profileId: widget.profileId)),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openAddTransaction(context),
        child: const Icon(Icons.add),
      ),
      body: Padding(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Accounts row
            SizedBox(
              height: 110,
              child: StreamBuilder<List<ProjectAccount>>(
                stream: ProjectFinanceService.instance.watchAccounts(widget.profileId),
                builder: (context, snap) {
                  final accounts = snap.data ?? const <ProjectAccount>[];
                  return ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: accounts.length + 1,
                    separatorBuilder: (_, __) => const SizedBox(width: 12),
                    itemBuilder: (context, i) {
                      if (i == accounts.length) {
                        // Add account card
                        return InkWell(
                          onTap: _showCreateAccountForm,
                          child: Container(
                            width: 220,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                              color: Colors.white.withValues(alpha: 0.03),
                            ),
                            padding: const EdgeInsets.all(12),
                            child: const Center(
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.add),
                                  SizedBox(width: 8),
                                  Text('Add account', style: TextStyle(fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ),
                          ),
                        );
                      }
                      final a = accounts[i];
                      final bal = a.currentBalance ?? a.openingBalance;
                      return InkWell(
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => AccountDetailScreen(profileId: widget.profileId, account: a),
                          ),
                        ),
                        child: Container(
                          width: 220,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                            color: Colors.white.withValues(alpha: 0.05),
                          ),
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Row(
                                children: [
                                  CircleAvatar(
                                    radius: 16,
                                    backgroundColor: Colors.white.withValues(alpha: 0.06),
                                    child: Icon(
                                      a.accountType == 'cash'
                                          ? Icons.payments
                                          : a.accountType == 'mobileMoney'
                                              ? Icons.phone_iphone
                                              : Icons.account_balance,
                                      size: 18,
                                      color: Colors.white.withValues(alpha: 0.9),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      a.name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                formatCurrency(a.currency, bal),
                                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
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
            const Divider(height: 1),
            const SizedBox(height: 8),
            Text('Recent transactions', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Expanded(
              child: StreamBuilder<List<ProjectAccount>>(
                stream: ProjectFinanceService.instance.watchAccounts(widget.profileId),
                builder: (context, accSnap) {
                  final accounts = accSnap.data ?? const <ProjectAccount>[];
                  final byId = {for (final a in accounts) a.id: a};
                  return StreamBuilder<List<ProjectTransaction>>(
                    stream: ProjectFinanceService.instance.watchProfileTransactions(widget.profileId, limit: 50),
                    builder: (context, snap) {
                      final txs = snap.data ?? const <ProjectTransaction>[];
                      if (txs.isEmpty) {
                        return const Center(child: Text('No recent transactions'));
                      }
                      return ListView.separated(
                        itemCount: txs.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, i) {
                          final t = txs[i];
                          final icon = t.type == ProjectTransactionType.income
                              ? Icons.trending_up
                              : t.type == ProjectTransactionType.expense
                                  ? Icons.trending_down
                                  : Icons.swap_horiz;
                          final color = t.type == ProjectTransactionType.income
                              ? Colors.greenAccent
                              : t.type == ProjectTransactionType.expense
                                  ? Colors.redAccent
                                  : Colors.blueAccent;
                          final pName = byId[t.primaryAccountId]?.name ?? t.primaryAccountId;
                          final sName = t.secondaryAccountId != null ? (byId[t.secondaryAccountId!]?.name ?? t.secondaryAccountId!) : null;
                          return ListTile(
                            leading: CircleAvatar(
                              radius: 16,
                              backgroundColor: color.withValues(alpha: 0.15),
                              child: Icon(icon, size: 18, color: color.withValues(alpha: 0.9)),
                            ),
                            title: Text(
                              t.category.isNotEmpty ? t.category : t.type.name,
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text('$pName${sName != null ? ' → $sName' : ''}'),
                            trailing: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  formatCurrency(t.currency, t.amount),
                                  style: const TextStyle(fontWeight: FontWeight.w700),
                                ),
                                if (t.secondaryAmount != null && t.secondaryCurrency != null)
                                  Text(formatCurrency(t.secondaryCurrency!, t.secondaryAmount!)),
                              ],
                            ),
                            onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => TransactionDetailScreen(
                                  profileId: widget.profileId,
                                  transactionId: t.id,
                                  initial: t,
                                ),
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
      ),
    );
  }
}
