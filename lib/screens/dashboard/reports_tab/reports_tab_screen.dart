import '../../../imports.dart';
import 'package:flutter/material.dart';
import '../../dashboard/reports_tab/report_form_screen.dart'; // Import your ReportFormScreen

class ReportsTabScreen extends StatefulWidget {
  final Profile projectData;

  const ReportsTabScreen({super.key, required this.projectData});

  @override
  State<ReportsTabScreen> createState() => _ReportsTabScreenState();
}

class _ReportsTabScreenState extends State<ReportsTabScreen> {
  List<dynamic> _reports = [];

  @override
  void initState() {
    super.initState();
    _reports = List.from(widget.projectData.reportList);
  }

  // Navigate to the ReportFormScreen when the Add button is pressed
  Future<void> _addNewReport() async {
    // Navigate to ReportFormScreen and wait for the new report
    final newReport = await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => ReportFormScreen()),
    );

    // If a new report is returned, update the list and save it
    if (newReport != null) {
      setState(() {
        _reports.add(newReport);
      });

      final updatedProfile = widget.projectData.copyWith(reportList: _reports);
      await ProfileRepository().saveProfile(updatedProfile);

      // Show success message
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Report added successfully!')),
      );
    }
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
                  Container(height: 20.0, color: Colors.black),
                  Container(
                    height: 40.0,
                    padding: const EdgeInsets.only(top: 10.0, left: 15.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Project Reports',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 18.0,
                          ),
                        ),
                        IconButton(
                          onPressed: _addNewReport,
                          icon: const Icon(Icons.add),
                        ),
                      ],
                    ),
                  ),
                  const Divider(),
                  Expanded(
                    child:
                        _reports.isEmpty
                            ? const Center(child: Text('No reports found.'))
                            : ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: _reports.length,
                              separatorBuilder:
                                  (_, __) => const SizedBox(height: 12),
                              itemBuilder: (context, index) {
                                final report = _reports[index];
                                return ReportCard(report: report);
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
