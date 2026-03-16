import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

class ConnectTab extends StatelessWidget {
  final String projectCode;
  const ConnectTab({super.key, required this.projectCode});

  @override
  Widget build(BuildContext context) {
    if (projectCode.isEmpty) {
      return const Center(child: Text('No project code available.'));
    }
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const SizedBox(height: 16),
          Text('Share this code to link', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text(projectCode, style: const TextStyle(fontSize: 16, letterSpacing: 1.2)),
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
            ),
            padding: const EdgeInsets.all(12),
            child: QrImageView(
              data: projectCode,
              version: QrVersions.auto,
              size: 220,
              eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.circle, color: Colors.black),
              dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: Colors.black),
            ),
          ),
          const SizedBox(height: 16),
          Text('Ask another account to scan this to link to the project.', style: TextStyle(color: Colors.white.withValues(alpha: 0.8))),
        ],
      ),
    );
  }
}
