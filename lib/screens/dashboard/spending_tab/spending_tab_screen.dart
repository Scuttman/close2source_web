import '../../../imports.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'spending_form_screen.dart';

class SpendingTabScreen extends StatefulWidget {
  final Profile projectData;
  const SpendingTabScreen({super.key, required this.projectData});

  @override
  State<SpendingTabScreen> createState() => _SpendingTabScreenState();
}

class _SpendingTabScreenState extends State<SpendingTabScreen> {
  List<dynamic> _transactions = [];

  @override
  void initState() {
    super.initState();
    _transactions = List.from(widget.projectData.transactionList);
  }

  Future<void> _addSpending() async {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => SpendingFormScreen(profile: widget.projectData),
      ),
    );

  }

  double _calculateTotalSpending() {
    return _transactions.fold(0.0, (total, tx) {
      final amount = tx['amount'];
      if (amount is num) {
        return total + amount.toDouble();
      }
      return total;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(
        left: 10.0,
        right: 10.0,
        top: 50.0,
        bottom: 10.0,
      ),
      child: Column(
        children: [
          Container(
            color: Colors.deepOrange.withOpacity(0.7),
            padding: const EdgeInsets.only(left: 10.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'CLOSE2SOURCE',
                  style: GoogleFonts.amaticSc(
                    textStyle: const TextStyle(
                      color: Colors.white,
                      letterSpacing: 0.1,
                      fontSize: 40.0,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.exit_to_app,
                      color: Colors.white, size: 30.0),
                  onPressed: () {
                    Navigator.pop(context);
                  },
                ),
              ],
            ),
          ),
          Expanded(
            child: Container(
              color: Colors.white.withOpacity(0.7),
              child: Column(
                children: [
                  Container(
                    height: 30.0,
                    color: Colors.black,
                    alignment: Alignment.centerLeft,
                    child: Padding(
                      padding: const EdgeInsets.only(left:10.0),
                      child: Text(
                        'Total Spending: MWK ${_calculateTotalSpending().toStringAsFixed(2)}',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                  Container(
                    height: 40.0,
                    padding: const EdgeInsets.only(top: 10.0, left: 15.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Spending',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 18.0,
                          ),
                        ),
                        IconButton(
                          onPressed: _addSpending,
                          icon: const Icon(Icons.add),
                        ),
                      ],
                    ),
                  ),
                  const Divider(),
                  Expanded(
                    child: _transactions.isEmpty
                        ? const Center(child: Text('No transactions found.'))
                        : ListView.builder(
                      padding: const EdgeInsets.all(10),
                      itemCount: _transactions.length,
                      itemBuilder: (context, index) {
                        final tx = _transactions[index];
                        final ts = tx['date'];
                        final date = ts is Timestamp
                            ? ts.toDate()
                            : DateTime.tryParse(ts.toString()) ??
                            DateTime.now();

                        return Card(
                          margin:
                          const EdgeInsets.symmetric(vertical: 8),
                          elevation: 3,
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Column(
                              crossAxisAlignment:
                              CrossAxisAlignment.start,
                              children: [
                                Text(
                                  "📅 ${DateFormat('dd/MM/yyyy').format(date)}",
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(height: 8),
                                Text("📝 ${tx['description']}"),
                                const SizedBox(height: 6),
                                Text(
                                  "💸 Amount: MWK ${tx['amount']?.toStringAsFixed(2) ?? '0.00'}",
                                ),
                                Text("📂 Category: ${tx['category']}"),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}