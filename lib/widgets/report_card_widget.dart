import 'dart:io';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:cached_network_image/cached_network_image.dart';

class ReportCard extends StatelessWidget {
  final Map<String, dynamic> report;

  const ReportCard({super.key, required this.report});

  void _showFullImage(BuildContext context, String path) {
    showDialog(
      context: context,
      builder:
          (_) => GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Dialog(
              backgroundColor: Colors.black87,
              insetPadding: const EdgeInsets.all(10),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Padding(
                    padding: EdgeInsets.all(12),
                    child: Text(
                      'Full Report Image View:',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: _buildImage(
                      path,
                      height: 250,
                      width: double.infinity,
                      fit: BoxFit.contain,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Padding(
                    padding: EdgeInsets.only(bottom: 12),
                    child: Text(
                      'Tap image to close full view',
                      style: TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ),
                ],
              ),
            ),
          ),
    );
  }

  static Widget _buildImage(
    String path, {
    double height = 100,
    double width = 100,
    BoxFit fit = BoxFit.cover,
  }) {
    try {
      final isNetwork = path.startsWith('http') || path.startsWith('https');

      return isNetwork
          ? CachedNetworkImage(
            imageUrl: path,
            height: height,
            width: width,
            fit: fit,
            placeholder:
                (context, url) =>
                    const Center(child: CircularProgressIndicator()),
            errorWidget: (context, url, error) {
              print('Error loading network image: $path');
              return const Icon(Icons.broken_image);
            },
          )
          : Image.file(
            File(path),
            height: height,
            width: width,
            fit: fit,
            errorBuilder: (context, error, stackTrace) {
              print('Error loading local image: $path');
              return const Icon(Icons.broken_image);
            },
          );
    } catch (e) {
      print('Exception building image widget: $e');
      return const Icon(Icons.broken_image);
    }
  }

  @override
  Widget build(BuildContext context) {
    final DateTime reportDate =
        report['date'] is DateTime
            ? report['date']
            : DateTime.tryParse(report['date'].toString()) ?? DateTime.now();

    final String title = report['title'] ?? 'Untitled Report';
    final String summary = report['summary'] ?? 'No summary available.';
    final List<dynamic> imageList = report['images'] ?? [];

    return Card(
      elevation: 5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: Colors.grey.shade300, width: 1.2),
      ),
      color: Colors.white70,
      margin: const EdgeInsets.symmetric(horizontal: 1.2, vertical: 1.2),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        leading: const Icon(
          Icons.assignment,
          size: 32,
          color: Colors.deepOrange,
        ),
        title: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                DateFormat('dd/MM/yyyy').format(reportDate),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                  color: Colors.black87,
                ),
              ),
            ),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontSize: 14,
              color: Colors.black54,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: Colors.grey.shade50,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Summary",
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.3,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(
                      Icons.text_snippet,
                      size: 20,
                      color: Colors.deepOrange,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        summary,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Colors.black87,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (imageList.isNotEmpty) ...[
                  const Text(
                    "Attached Photos",
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                      letterSpacing: 0.3,
                    ),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 100,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: imageList.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (context, index) {
                        final path = imageList[index];
                        return GestureDetector(
                          onTap: () => _showFullImage(context, path),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: _buildImage(path),
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
