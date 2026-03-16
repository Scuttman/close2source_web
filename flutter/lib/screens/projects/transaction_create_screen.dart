// ignore_for_file: prefer_const_constructors
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'dart:io';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:image_cropper/image_cropper.dart';
import '../../services/project_finance_service.dart';
import '../../services/finance_models.dart';
import '../../services/receipt_upload_queue.dart';
import '../../services/budget_service.dart';

enum TxFormMode { income, expense, transfer }

class TransactionCreateScreen extends StatefulWidget {
  // Treat projectId as profileId post-migration
  final String projectId;
  final TxFormMode mode;
  final String? initialPrimaryAccountId;
  final bool lockPrimary;
  const TransactionCreateScreen({
    super.key,
    required this.projectId,
    required this.mode,
    this.initialPrimaryAccountId,
    this.lockPrimary = false,
  });

  @override
  State<TransactionCreateScreen> createState() => _TransactionCreateScreenState();
}

class _LocalReceipt {
  final String id;
  final String localPath; // persistent local file path
  _LocalReceipt({required this.id, required this.localPath});
}

class _ReceiptGrid extends StatelessWidget {
  final List<_LocalReceipt> receipts;
  final VoidCallback onAdd;
  final void Function(String id) onRemove;
  const _ReceiptGrid({required this.receipts, required this.onAdd, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    final tiles = <Widget>[
      _AddTile(onTap: onAdd),
      ...receipts.map((r) => _ReceiptTile(receipt: r, onRemove: () => onRemove(r.id))),
    ];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: tiles.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 1,
      ),
      itemBuilder: (_, i) => tiles[i],
    );
  }
}

class _AddTile extends StatelessWidget {
  final VoidCallback onTap;
  const _AddTile({required this.onTap});
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
              borderRadius: BorderRadius.circular(12),
              color: Colors.white.withValues(alpha: 0.05),
        ),
        child: const Center(child: Icon(Icons.add, size: 30)),
      ),
    );
  }
}

class _ReceiptTile extends StatelessWidget {
  final _LocalReceipt receipt;
  final VoidCallback onRemove;
  const _ReceiptTile({required this.receipt, required this.onRemove});
  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned.fill(
          child: Container(
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                  borderRadius: BorderRadius.circular(12),
                  color: Colors.white.withValues(alpha: 0.08),
            ),
            child: Center(
                  child: Text('Img', style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.7))),
            ),
          ),
        ),
        Positioned(
          right: 2,
          top: 2,
          child: InkWell(
            onTap: onRemove,
            child: Container(
              decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.5),
                shape: BoxShape.circle,
              ),
              padding: const EdgeInsets.all(2),
              child: const Icon(Icons.close, size: 14),
            ),
          ),
        )
      ],
    );
  }
}

class _TransactionCreateScreenState extends State<TransactionCreateScreen> {
  final _formKey = GlobalKey<FormState>();
  int _currentStep = 0;
  final _amountCtrl = TextEditingController();
  final _secondaryAmountCtrl = TextEditingController();
  final _categoryCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _counterpartyNameCtrl = TextEditingController();
  final _counterpartyContactCtrl = TextEditingController();
  DateTime _date = DateTime.now();
  String? _primaryAccountId;
  String? _secondaryAccountId; // transfer target
  bool _submitting = false;
  bool _loadingRecent = false;
  bool _loadingAccounts = true;
  List<String> _recentCategories = [];
  List<BudgetCategory> _budgetCategories = const [];
  final List<_LocalReceipt> _localReceipts = [];
  List<ProjectAccount> _accounts = const [];

  // Simple representation for locally picked images (paths or bytes placeholder)
  // For now store path; later integrate actual picker & upload.
  // In a real implementation you'd use XFile from image_picker or similar.

  Future<void> _pickReceipt() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(source: ImageSource.camera, imageQuality: 85).catchError((_) => null);
      if (picked == null) return;
      // Offer cropping tools before saving the receipt
      CroppedFile? cropped;
      try {
        cropped = await ImageCropper().cropImage(
          sourcePath: picked.path,
          compressFormat: ImageCompressFormat.jpg,
          compressQuality: 90,
          uiSettings: [
            AndroidUiSettings(
              toolbarTitle: 'Crop receipt',
              toolbarColor: Colors.black87,
              toolbarWidgetColor: Colors.white,
              initAspectRatio: CropAspectRatioPreset.original,
              lockAspectRatio: false,
              hideBottomControls: false,
            ),
            IOSUiSettings(
              title: 'Crop receipt',
              aspectRatioLockEnabled: false,
              resetAspectRatioEnabled: true,
            ),
          ],
        );
      } catch (_) {
        // If cropping fails, fall back to original image
        cropped = null;
      }
      final docs = await getApplicationDocumentsDirectory();
      final receiptsDir = Directory('${docs.path}/receipts');
      if (!receiptsDir.existsSync()) receiptsDir.createSync(recursive: true);
      final sourcePath = (cropped?.path ?? picked.path);
      final filename = picked.name.isNotEmpty ? picked.name : 'receipt.jpg';
      final newPath = '${receiptsDir.path}/${DateTime.now().millisecondsSinceEpoch}_$filename';
      final newFile = await File(sourcePath).copy(newPath);
      if (!mounted) return; // guard context after async gap
      setState(() {
        _localReceipts.add(_LocalReceipt(id: DateTime.now().millisecondsSinceEpoch.toString(), localPath: newFile.path));
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not pick image: $e')));
    }
  }

  void _removeReceipt(String id) {
    setState(() { _localReceipts.removeWhere((r) => r.id == id); });
  }

  @override
  void initState() {
    super.initState();
    // Preselect primary account when provided
    _primaryAccountId = widget.initialPrimaryAccountId;
    _loadAccounts();
    _loadRecentCategories();
    _watchBudgetCategories();
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _secondaryAmountCtrl.dispose();
    _categoryCtrl.dispose();
    _descCtrl.dispose();
    _counterpartyNameCtrl.dispose();
    _counterpartyContactCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadAccounts() async {
    setState(() => _loadingAccounts = true);
    try {
      final snap = await FirebaseFirestore.instance
          .collection('profiles')
          .doc(widget.projectId) // profileId
          .collection('accounts')
          .where('archived', isEqualTo: false)
          .get();
      _accounts = snap.docs.map(ProjectAccount.fromDoc).toList();
    } finally {
      if (mounted) setState(() => _loadingAccounts = false);
    }
  }

  void _watchBudgetCategories() {
    final type = switch (widget.mode) {
      TxFormMode.income => 'income',
      TxFormMode.expense => 'expense',
      TxFormMode.transfer => 'transfer',
    };
    BudgetService.instance.watchCategories(widget.projectId, type: type).listen((cats) {
      if (!mounted) return;
      setState(() => _budgetCategories = cats);
    });
  }

  String get _title {
    switch (widget.mode) {
      case TxFormMode.income:
        return 'New Income';
      case TxFormMode.expense:
        return 'New Expense';
      case TxFormMode.transfer:
        return 'New Transfer';
    }
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(DateTime.now().year - 3),
      lastDate: DateTime(DateTime.now().year + 3),
    );
    if (d != null) setState(() => _date = d);
  }

  Future<void> _submit() async {
    // Final guard validation
    if (_primaryAccountId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Select an account')));
      return;
    }
    if (widget.mode == TxFormMode.transfer && _secondaryAccountId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Select target account')));
      return;
    }
    setState(() => _submitting = true);

    // Capture all form values synchronously up front.
    final profileId = widget.projectId; // treat as profileId
    final primaryId = _primaryAccountId!;
    final secondaryId = _secondaryAccountId; // may be null
    final amountText = _amountCtrl.text.trim();
    final secondaryAmountText = _secondaryAmountCtrl.text.trim();
    final categoryText = _categoryCtrl.text.trim();
    final descText = _descCtrl.text.trim();
    final counterpartyNameText = _counterpartyNameCtrl.text.trim();
    final counterpartyContactText = _counterpartyContactCtrl.text.trim();
    final mode = widget.mode;
    final pickedDate = _date;
    final localReceiptPaths = _localReceipts.map((r) => r.localPath).where((p) => File(p).existsSync()).toList();

    double amount;
    try {
      amount = double.parse(amountText);
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Invalid amount')));
      setState(() => _submitting = false);
      return;
    }
    final double? secondaryAmount = secondaryAmountText.isEmpty ? null : double.tryParse(secondaryAmountText);
    final category = categoryText.isEmpty ? (mode == TxFormMode.transfer ? 'Transfer' : 'General') : categoryText;
    final desc = descText.isEmpty ? null : descText;
    final counterpartyName = counterpartyNameText.isEmpty ? null : counterpartyNameText;
    final counterpartyContact = counterpartyContactText.isEmpty ? null : counterpartyContactText;

  final svc = ProjectFinanceService.instance;

    Future<ProjectTransaction> futureTx;
    switch (mode) {
      case TxFormMode.income:
        futureTx = svc.createIncome(
          profileId: profileId,
          accountId: primaryId,
          amount: amount,
          category: category,
          description: desc,
          counterpartyName: counterpartyName,
          counterpartyContact: counterpartyContact,
          effectiveDate: pickedDate,
        );
        break;
      case TxFormMode.expense:
        futureTx = svc.createExpense(
          profileId: profileId,
          accountId: primaryId,
          amount: amount,
          category: category,
          description: desc,
          counterpartyName: counterpartyName,
          counterpartyContact: counterpartyContact,
          effectiveDate: pickedDate,
        );
        break;
      case TxFormMode.transfer:
        futureTx = svc.createTransfer(
          profileId: profileId,
          fromAccountId: primaryId,
          toAccountId: secondaryId!,
          amount: amount,
          secondaryAmount: secondaryAmount,
          description: desc,
          counterpartyName: counterpartyName,
          counterpartyContact: counterpartyContact,
          effectiveDate: pickedDate,
        );
        break;
    }

    // Chain without awaiting inside this method to avoid context-after-await lint.
    futureTx.then((created) async {
      if (!mounted) return;
      if (localReceiptPaths.isNotEmpty) {
        try {
          await ReceiptUploadQueue.instance.enqueueList(profileId: profileId, txId: created.id, filePaths: localReceiptPaths);
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Receipts queued for upload')));
        } catch (_) {}
      }
      if (!mounted) return;
      Navigator.pop(context, created);
    }).catchError((e, st) {
      if (!mounted) return;
      String message = 'Failed: $e';
      if (e is FirebaseException) {
        message = 'Failed (${e.plugin}:${e.code}) ${e.message}';
      }
      // ignore: avoid_print
      print('[TX_FORM] Transaction submit error mode=$mode error=$e stack=$st');
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      setState(() => _submitting = false);
    });
  }

  Future<void> _loadRecentCategories() async {
    // Only for income / expense; transfers have fixed category
    if (widget.mode == TxFormMode.transfer) return;
    setState(() { _loadingRecent = true; });
    try {
      // Fetch last 50 transactions of this type for the project to derive categories
      final typeStr = widget.mode == TxFormMode.income ? 'income' : 'expense';
      final snap = await FirebaseFirestore.instance
          .collection('profiles')
          .doc(widget.projectId) // profileId
          .collection('profileTransactions')
          .where('type', isEqualTo: typeStr)
          .orderBy('effectiveDate', descending: true)
          .limit(50)
          .get();
      final seen = <String>{};
      final cats = <String>[];
      for (final d in snap.docs) {
        final raw = (d.data()['category'] ?? '').toString().trim();
        if (raw.isEmpty) continue;
        final normalized = raw; // could add case normalization here
        if (!seen.contains(normalized)) {
          seen.add(normalized);
          cats.add(normalized);
        }
      }
      setState(() { _recentCategories = cats; });
    } catch (e) {
      // Ignore errors (e.g. missing index) but keep UX smooth
    } finally {
      if (mounted) setState(() { _loadingRecent = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final df = DateFormat.yMMMd();
    final accounts = _accounts;
    ProjectAccount? primaryAcc = accounts.where((a)=>a.id==_primaryAccountId).cast<ProjectAccount?>().firstWhere((a)=>true, orElse: ()=>null);
    ProjectAccount? secondaryAcc = accounts.where((a)=>a.id==_secondaryAccountId).cast<ProjectAccount?>().firstWhere((a)=>true, orElse: ()=>null);
    // Base suggestions depending on mode
    List<String> base;
    switch (widget.mode) {
      case TxFormMode.income:
        base = const ['Donation','Grant','Interest','Refund','Other'];
        break;
      case TxFormMode.expense:
        base = const ['Supplies','Travel','Food','Fees','Marketing','Utilities','Other'];
        break;
      case TxFormMode.transfer:
        base = const ['Transfer'];
        break;
    }
    // Merge dynamic recent categories (put recent first) without duplicates
    final suggestions = <String>{
      ..._recentCategories,
      ...base,
    }.toList();
    return Scaffold(
      appBar: AppBar(title: Text(_title)),
      body: _loadingAccounts
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: Stepper(
                currentStep: _currentStep,
                onStepCancel: _currentStep == 0 || _submitting
                    ? null
                    : () => setState(() => _currentStep -= 1),
                onStepContinue: _submitting ? null : _handleContinue,
                controlsBuilder: (context, details) {
                  return Row(
                    children: [
                      FilledButton(
                        onPressed: details.onStepContinue,
                        child: Text(_currentStep == 3 ? (_submitting ? 'Submitting...' : 'Submit') : 'Next'),
                      ),
                      const SizedBox(width: 8),
                      TextButton(
                        onPressed: details.onStepCancel,
                        child: const Text('Back'),
                      ),
                    ],
                  );
                },
                steps: [
                  Step(
                    title: const Text('Accounts'),
                    isActive: _currentStep >= 0,
                    state: _stepState(0),
                    content: Column(
                      children: [
                          DropdownButtonFormField<String>(
                            initialValue: _primaryAccountId,
                            decoration: const InputDecoration(labelText: 'Primary Account'),
                            items: accounts
                                .map((a) => DropdownMenuItem(value: a.id, child: Text('${a.name} (${a.currency})')))
                                .toList(),
                            onChanged: widget.lockPrimary ? null : (v) => setState(() => _primaryAccountId = v),
                          ),
                        if (widget.mode == TxFormMode.transfer) const SizedBox(height: 14),
                        if (widget.mode == TxFormMode.transfer)
                          DropdownButtonFormField<String>(
                            initialValue: _secondaryAccountId,
                            decoration: const InputDecoration(labelText: 'Target Account'),
                            items: accounts
                                .where((a) => a.id != _primaryAccountId)
                                .map((a) => DropdownMenuItem(value: a.id, child: Text('${a.name} (${a.currency})')))
                                .toList(),
                            onChanged: (v) => setState(() => _secondaryAccountId = v),
                          ),
                        if (widget.mode == TxFormMode.transfer && _primaryAccountId != null && _secondaryAccountId == _primaryAccountId)
                          const Padding(
                            padding: EdgeInsets.only(top: 8.0),
                            child: Align(
                              alignment: Alignment.centerLeft,
                              child: Text('Cannot transfer to the same account', style: TextStyle(color: Colors.redAccent)),
                            ),
                          ),
                      ],
                    ),
                  ),
                  Step(
                    title: const Text('Amounts & Date'),
                    isActive: _currentStep >= 1,
                    state: _stepState(1),
                    content: Column(
                      children: [
                        TextFormField(
                          controller: _amountCtrl,
                          decoration: InputDecoration(labelText: widget.mode == TxFormMode.expense ? 'Amount (spent)' : 'Amount'),
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        ),
                        if (widget.mode == TxFormMode.transfer) const SizedBox(height: 14),
                        if (widget.mode == TxFormMode.transfer)
                          TextFormField(
                            controller: _secondaryAmountCtrl,
                            decoration: InputDecoration(
                              labelText: 'Target Amount${(primaryAcc!=null && secondaryAcc!=null && primaryAcc.currency!=secondaryAcc.currency) ? ' (${secondaryAcc.currency})' : ''}',
                              helperText: (primaryAcc!=null && secondaryAcc!=null)
                                  ? (primaryAcc.currency == secondaryAcc.currency
                                      ? 'Same currency transfer - target amount auto = source.'
                                      : 'Currencies differ: specify the amount received in ${secondaryAcc.currency}.')
                                  : null,
                            ),
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            enabled: !(primaryAcc!=null && secondaryAcc!=null && primaryAcc.currency==secondaryAcc.currency),
                          ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Text('Date: ${df.format(_date)}'),
                            const SizedBox(width: 12),
                            TextButton.icon(onPressed: _pickDate, icon: const Icon(Icons.date_range), label: const Text('Change')),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Step(
                    title: const Text('Details'),
                    isActive: _currentStep >= 2,
                    state: _stepState(2),
                    content: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TextFormField(
                          controller: _categoryCtrl,
                          decoration: InputDecoration(
                            labelText: 'Category',
                            suffixIcon: (_budgetCategories.isNotEmpty)
                                ? PopupMenuButton<String>(
                                    icon: const Icon(Icons.list, size: 18),
                                    onSelected: (v) => setState(() => _categoryCtrl.text = v),
                                    itemBuilder: (_) => [
                                      for (final c in _budgetCategories)
                                        PopupMenuItem<String>(value: c.name, child: Text(c.name)),
                                    ],
                                  )
                                : null,
                          ),
                        ),
                        const SizedBox(height: 8),
                        if (suggestions.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 8.0, bottom: 4),
                            child: Wrap(
                              spacing: 8,
                              runSpacing: 4,
                              children: [
                                if (_loadingRecent)
                                  const Padding(
                                    padding: EdgeInsets.only(right: 4.0),
                                    child: SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                                  ),
                                for (final s in suggestions)
                                  ActionChip(
                                    label: Text(s),
                                    onPressed: () {
                                      setState(() { _categoryCtrl.text = s; });
                                    },
                                  ),
                              ],
                            ),
                          ),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _counterpartyNameCtrl,
                          decoration: InputDecoration(
                            labelText: widget.mode == TxFormMode.income ? 'Donor / Source Name' : (widget.mode == TxFormMode.expense ? 'Vendor / Payee Name' : 'Counterparty Name'),
                          ),
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _counterpartyContactCtrl,
                          decoration: const InputDecoration(labelText: 'Contact Number (optional)'),
                          keyboardType: TextInputType.phone,
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _descCtrl,
                          decoration: const InputDecoration(labelText: 'Description (optional)'),
                          maxLines: 2,
                        ),
                      ],
                    ),
                  ),
                  Step(
                    title: const Text('Receipts & Submit'),
                    isActive: _currentStep >= 3,
                    state: _stepState(3),
                    content: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text('Receipts / Paperwork', style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                            const SizedBox(width: 8),
                            if (_localReceipts.isNotEmpty)
                              Text('${_localReceipts.length}', style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.6))),
                          ],
                        ),
                        const SizedBox(height: 8),
                        _ReceiptGrid(
                          receipts: _localReceipts,
                          onAdd: _pickReceipt,
                          onRemove: _removeReceipt,
                        ),
                        const SizedBox(height: 8),
                        _ReviewBlock(
                          mode: widget.mode,
                          accounts: accounts,
                          primaryAccountId: _primaryAccountId,
                          secondaryAccountId: _secondaryAccountId,
                          amountText: _amountCtrl.text,
                          secondaryAmountText: _secondaryAmountCtrl.text,
                          category: _categoryCtrl.text.isEmpty ? (widget.mode == TxFormMode.transfer ? 'Transfer' : 'General') : _categoryCtrl.text,
                          date: _date,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  StepState _stepState(int step) {
    if (_currentStep > step) return StepState.complete;
    return StepState.editing;
  }

  void _handleContinue() {
    if (_currentStep == 0) {
      if (_primaryAccountId == null) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Select an account')));
        return;
      }
      if (widget.mode == TxFormMode.transfer) {
        if (_secondaryAccountId == null) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Select target account')));
          return;
        }
        if (_secondaryAccountId == _primaryAccountId) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Cannot transfer to the same account')));
          return;
        }
      }
      setState(() => _currentStep = 1);
      return;
    }
    if (_currentStep == 1) {
      final amount = double.tryParse(_amountCtrl.text.trim());
      if (amount == null || amount <= 0) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a valid amount')));
        return;
      }
      if (widget.mode == TxFormMode.transfer) {
        final acc1 = _accounts.firstWhere((a) => a.id == _primaryAccountId);
        final acc2 = _accounts.firstWhere((a) => a.id == _secondaryAccountId);
        if (acc1.currency != acc2.currency) {
          final sec = double.tryParse(_secondaryAmountCtrl.text.trim());
          if (sec == null || sec <= 0) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Enter amount in ${acc2.currency}')));
            return;
          }
        }
      }
      setState(() => _currentStep = 2);
      return;
    }
    if (_currentStep == 2) {
      // Nothing strictly required here; proceed
      setState(() => _currentStep = 3);
      return;
    }
    if (_currentStep == 3) {
      _submit();
    }
  }
}

class _ReviewBlock extends StatelessWidget {
  final TxFormMode mode;
  final List<ProjectAccount> accounts;
  final String? primaryAccountId;
  final String? secondaryAccountId;
  final String amountText;
  final String secondaryAmountText;
  final String category;
  final DateTime date;
  const _ReviewBlock({
    required this.mode,
    required this.accounts,
    required this.primaryAccountId,
    required this.secondaryAccountId,
    required this.amountText,
    required this.secondaryAmountText,
    required this.category,
    required this.date,
  });

  @override
  Widget build(BuildContext context) {
    final primary = accounts.where((a) => a.id == primaryAccountId).cast<ProjectAccount?>().firstWhere((a)=>true, orElse: ()=>null);
    final secondary = accounts.where((a) => a.id == secondaryAccountId).cast<ProjectAccount?>().firstWhere((a)=>true, orElse: ()=>null);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
        borderRadius: BorderRadius.circular(12),
        color: Colors.white.withValues(alpha: 0.04),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Review', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          if (primary != null) Text('From: ${primary.name} (${primary.currency})'),
          if (mode == TxFormMode.transfer && secondary != null) Text('To: ${secondary.name} (${secondary.currency})'),
          Text('Amount: $amountText${primary != null ? ' ${primary.currency}' : ''}'),
          if (mode == TxFormMode.transfer && secondary != null && secondaryAmountText.isNotEmpty)
            Text('Target Amount: $secondaryAmountText ${secondary.currency}'),
          Text('Category: $category'),
          Text('Date: ${DateFormat.yMMMd().format(date)}'),
        ],
      ),
    );
  }
}
