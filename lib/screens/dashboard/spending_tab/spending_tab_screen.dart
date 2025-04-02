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
  final ProfileRepository _repo = ProfileRepository();

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
                  icon: const Icon(
                    Icons.exit_to_app,
                    color: Colors.white,
                    size: 30.0,
                  ),
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
                  StreamBuilder<DocumentSnapshot>(
                    stream:
                        FirebaseFirestore.instance
                            .collection('Profiles')
                            .doc(widget.projectData.profileId)
                            .snapshots(),
                    builder: (context, snapshot) {
                      if (!snapshot.hasData || snapshot.data == null) {
                        return const SizedBox(height: 30.0);
                      }

                      final profile = Profile.fromFirestore(snapshot.data!);
                      final currency = profile.profileCurrency ?? 'MWK';

                      final total = profile.transactionList.fold<double>(
                        0.0,
                        (sum, tx) => sum + (tx.amount ?? 0),
                      );

                      final formattedTotal = NumberFormat.currency(
                        locale: 'en_US',
                        symbol: '',
                        decimalDigits: 2,
                      ).format(total);

                      return Container(
                        height: 30.0,
                        color: Colors.black,
                        alignment: Alignment.centerLeft,
                        child: Padding(
                          padding: const EdgeInsets.only(left: 10.0),
                          child: Text(
                            'Total Spending: $currency $formattedTotal',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      );
                    },
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
                    child: StreamBuilder<DocumentSnapshot>(
                      stream:
                          FirebaseFirestore.instance
                              .collection('Profiles')
                              .doc(widget.projectData.profileId)
                              .snapshots(),
                      builder: (context, snapshot) {
                        if (snapshot.connectionState ==
                            ConnectionState.waiting) {
                          return const Center(
                            child: CircularProgressIndicator(),
                          );
                        }

                        if (!snapshot.hasData || !snapshot.data!.exists) {
                          return const Center(
                            child: Text('No transactions found.'),
                          );
                        }

                        final profile = Profile.fromFirestore(snapshot.data!);
                        final transactions = profile.transactionList ?? [];

                        if (transactions.isEmpty) {
                          return const Center(
                            child: Text('No transactions found.'),
                          );
                        }

                        return ListView.builder(
                          padding: const EdgeInsets.all(10),
                          itemCount: transactions.length,
                          itemBuilder: (context, index) {
                            final tx = transactions[index];
                            final date =
                                tx.date is DateTime
                                    ? tx.date
                                    : DateTime.tryParse(tx.date.toString()) ??
                                        DateTime.now();

                            final formattedTotal = NumberFormat.currency(
                              locale: 'en_US',
                              symbol: '',
                              decimalDigits: 2,
                            ).format(tx.amount);

                            return Card(
                              margin: const EdgeInsets.symmetric(vertical: 8),
                              elevation: 3,
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      "📅 ${DateFormat('dd/MM/yyyy').format(date)}",
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text("📝 ${tx.description}"),
                                    const SizedBox(height: 6),
                                    Text(
                                      "💸 Amount: ${profile.profileCurrency} ${formattedTotal}",
                                    ),
                                    Text("📂 Category: ${tx.category}"),
                                  ],
                                ),
                              ),
                            );
                          },
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
