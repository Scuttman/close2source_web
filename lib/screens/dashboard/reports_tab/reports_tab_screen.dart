import '../../../imports.dart';
import 'package:provider/provider.dart';

class ReportsTabScreen extends StatefulWidget {
  const ReportsTabScreen({super.key});

  @override
  State<ReportsTabScreen> createState() => _ReportsTabScreenState();
}

class _ReportsTabScreenState extends State<ReportsTabScreen> {
  void _addNewReport() {
    Navigator.pushNamed(context, 'report_form'); // ✅ This triggers navigation
  }

  @override
  Widget build(BuildContext context) {
    final projectProvider = Provider.of<ProjectsProvider>(
      context,
      listen: true,
    );
    final project = projectProvider.selectedProject;

    if (project == null) {
      return const Center(child: Text('No project selected!'));
    }

    final List<dynamic> reports = project.reportList;

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
                    'Project Reports',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 18.0,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: _addNewReport,
                  icon: const Icon(Icons.add), // ✅ Add icon
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
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: reports.length,
              separatorBuilder: (context, index) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                return ReportCard(report: reports[index]);
              },
            ),
          ),
        ),
      ],
    );
  }
}
