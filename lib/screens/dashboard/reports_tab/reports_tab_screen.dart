import '../../../imports.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

class ReportsTabScreen extends StatefulWidget {
  const ReportsTabScreen({super.key});

  @override
  State<ReportsTabScreen> createState() => _ReportsTabScreenState();
}

class _ReportsTabScreenState extends State<ReportsTabScreen> {


  Future<void> _addNewReport() async {
    final projectProvider = Provider.of<ProjectsProvider>(context, listen: false);
    final project = projectProvider.selectedProject;

    if (project == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("❌ No project selected!"), backgroundColor: Colors.red),
      );
      return;
    }

    // 📌 Define a new report entry
    final newReport = {
      "reportDate": Timestamp.now(),
      "updateText": [
        "Completed phase 1 of the construction.",
        "Installed new water pumps.",
        "Awaiting final approval from the supervisor."
      ],
      "reportPhotos": [
        "https://example.com/report_photos/photo1.jpg",
        "https://example.com/report_photos/photo2.jpg",
        "https://example.com/report_photos/photo3.jpg"
      ]
    };

    try {
      final repo = ProjectsRepository();
      await repo.addReportToProject(project.projectId, newReport);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("✅ Report added successfully!"), backgroundColor: Colors.green),
      );

      setState(() {}); // Refresh the UI to show the new report
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("❌ Failed to add report!"), backgroundColor: Colors.red),
      );
    }
  }


  @override
  Widget build(BuildContext context) {
    /// ✅ FIX: Correct way to access provider
    final projectProvider = Provider.of<ProjectsProvider>(context, listen: true);
    final project = projectProvider.selectedProject;

    /// ❌ FIX: If no project is selected
    if (project == null) {
      return Center(child: Text('No project selected!'));
    }

    /// ✅ Extract reports
    final List<dynamic> reports = project.reportList;



    return Column(
      children: [
        Container(
          height: 40.0,
          color: Colors.transparent,
          child: Padding(
            padding: const EdgeInsets.only(top:10.0,left: 15.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top:4.0),
                  child: Text('Project Reports', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18.0),),
                ),
                IconButton(onPressed: _addNewReport, icon: Icon(Icons.add),),
              ],
            ),
          ),
        ),
        Divider(),
        Expanded(
          flex: 2,
          child: Container(
            constraints: BoxConstraints(minHeight: 20.0),
            child: ListView.builder(
              padding: EdgeInsets.all(10),
              itemCount: reports.length,
              itemBuilder: (context, index) {
                final report = reports[index];

                /// ✅ FIX: Handle Timestamp correctly
                final reportDate = report['reportDate'] is Timestamp
                    ? (report['reportDate'] as Timestamp).toDate()
                    : DateTime.now(); // Fallback

                /// ✅ Extract data safely
                final List<String> updateText =
                    (report['updateText'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [];

                final List<String> reportPhotos =
                    (report['reportPhotos'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [];

                return Card(
                  margin: EdgeInsets.symmetric(vertical: 8),
                  elevation: 3,
                  child: Padding(
                    padding: EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        /// ✅ Report Date
                        Text(
                          "📅 Report Date: ${DateFormat('dd/MM/yyyy').format(reportDate)}",
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                        SizedBox(height: 8),

                        /// ✅ Update Text List
                        ...updateText.map((text) => Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Text("📝 $text"),
                        )),

                        SizedBox(height: 8),

                        /// ✅ Report Photos
                        if (reportPhotos.isNotEmpty) ...[
                          Text("📸 Report Photos:", style: TextStyle(fontWeight: FontWeight.bold)),
                          SizedBox(height: 8),
                          SizedBox(
                            height: 100, // Fixed height for photo previews
                            child: ListView.builder(
                              scrollDirection: Axis.horizontal,
                              itemCount: reportPhotos.length,
                              itemBuilder: (context, photoIndex) {
                                return Padding(
                                  padding: EdgeInsets.only(right: 8),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: Image.network(
                                      reportPhotos[photoIndex],
                                      width: 100,
                                      height: 100,
                                      fit: BoxFit.cover,
                                      errorBuilder: (context, error, stackTrace) => Icon(Icons.image_not_supported),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                        ],
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