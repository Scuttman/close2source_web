import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../imports.dart';
import 'spending_form_screen.dart';
import '../../../widgets/spending_card_widget.dart';

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

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 0, right: 0, top: 0, bottom: 0),
      child: Column(
        children: [
          Container(
            color: Colors.deepOrange.withOpacity(0.8),
            padding: const EdgeInsets.symmetric(horizontal: 10.0),
            child: Column(
              children: [
                SizedBox(height: 25.0),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'CLOSE2SOURCE',
                      style: GoogleFonts.amaticSc(
                        textStyle: const TextStyle(
                          color: Colors.white,
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
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: Container(
              color: Colors.white70,
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

                      return Container(
                        height: 40.0,
                        color: Colors.black,
                        alignment: Alignment.centerLeft,
                        padding: const EdgeInsets.only(left: 15.0),
                        child: Text(
                          'Total Spending: $currency ${total.toStringAsFixed(2)}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      );
                    },
                  ),
                  Container(
                    height: 50.0,
                    padding: const EdgeInsets.only(top: 10.0, left: 15.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Spending Transactions',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 18.0,
                          ),
                        ),
                        Container(
                          width: 100.0,
                          child: Row(
                            children: [
                              IconButton(
                                onPressed: () {
                                  SpendingSyncService()
                                      .syncPendingTransactions();
                                },
                                icon: const Icon(Icons.sync),
                              ),
                              IconButton(
                                onPressed: _addSpending,
                                icon: const Icon(Icons.add),
                              ),
                            ],
                          ),
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

                        // ✅ Sort by date (latest first)
                        transactions.sort((a, b) => b.date.compareTo(a.date));

                        return ListView.builder(
                          padding: const EdgeInsets.all(10),
                          itemCount: transactions.length,
                          itemBuilder: (context, index) {
                            final tx = transactions[index];

                            return SpendingCardWidget(
                              tx: tx,
                              currency: profile.profileCurrency ?? 'MWK',
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
