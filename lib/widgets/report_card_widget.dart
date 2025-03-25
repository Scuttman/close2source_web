import '../imports.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';

class ReportCard extends StatelessWidget {
  final Map<String, dynamic> report;

  const ReportCard({super.key, required this.report});

  @override
  Widget build(BuildContext context) {
    // Safely extract and convert the report date.
    final reportDate =
        report['reportDate'] is Timestamp
            ? (report['reportDate'] as Timestamp).toDate()
            : DateTime.now();

    // Extract update texts and photos, falling back to empty lists if necessary.
    final List<String> updateText =
        (report['updateText'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ??
        [];
    final List<String> reportPhotos =
        (report['reportPhotos'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ??
        [];

    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ExpansionTile(
        leading: Icon(Icons.report, color: Theme.of(context).primaryColor),
        title: Text(
          "Report Date: ${DateFormat('dd/MM/yyyy').format(reportDate)}",
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: updateText.isNotEmpty ? Text(updateText.first) : null,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Display each update text with a leading icon.
                ...updateText.map(
                  (text) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      children: [
                        Icon(
                          Icons.check_circle_outline,
                          size: 16,
                          color: Colors.green,
                        ),
                        SizedBox(width: 6),
                        Expanded(child: Text(text)),
                      ],
                    ),
                  ),
                ),
                if (reportPhotos.isNotEmpty) ...[
                  SizedBox(height: 12),
                  Text(
                    "Report Photos:",
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 8),
                  SizedBox(
                    height: 100,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: reportPhotos.length,
                      separatorBuilder: (context, _) => SizedBox(width: 8),
                      itemBuilder: (context, photoIndex) {
                        return ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.network(
                            reportPhotos[photoIndex],
                            width: 100,
                            height: 100,
                            fit: BoxFit.cover,
                            errorBuilder:
                                (context, error, stackTrace) =>
                                    Icon(Icons.image_not_supported),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
