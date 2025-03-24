import '../../../imports.dart';
import 'spending_form_screen.dart';
import 'package:intl/intl.dart';

class SpendingTabScreen extends StatefulWidget {
  const SpendingTabScreen({super.key});

  @override
  State<SpendingTabScreen> createState() => _SpendingTabScreenState();
}

class _SpendingTabScreenState extends State<SpendingTabScreen> {
  /// Sample list of spendings - replace with provider data
  final List<Map<String, dynamic>> _spendings = [
    {
      'date': DateTime.now(),
      'description': 'Bought materials for construction',
      'amount': 120.50,
      'category': 'Supplies',
    },
    {
      'date': DateTime.now().subtract(Duration(days: 2)),
      'description': 'Transported staff to site',
      'amount': 75.00,
      'category': 'Travel',
    },
  ];

  void _addSpending() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const SpendingFormScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          height: 40.0,
          color: Colors.transparent,
          child: Padding(
            padding: const EdgeInsets.only(top: 10.0, left: 15.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Padding(
                  padding: EdgeInsets.only(top: 4.0),
                  child: Text(
                    'Spending',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 18.0,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: _addSpending,
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
          ),
        ),
        const Divider(),
        Expanded(
          flex: 2,
          child: Container(
            constraints: const BoxConstraints(minHeight: 20.0),
            child: ListView.builder(
              padding: const EdgeInsets.all(10),
              itemCount: _spendings.length,
              itemBuilder: (context, index) {
                final spending = _spendings[index];
                final date = spending['date'] as DateTime;

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
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 8),
                        Text("📝 ${spending['description']}"),
                        const SizedBox(height: 6),
                        Text(
                          "💸 Amount: \$${spending['amount'].toStringAsFixed(2)}",
                        ),
                        Text("📂 Category: ${spending['category']}"),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}
