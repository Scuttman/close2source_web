import 'package:flutter/material.dart';
import '../updates_tab.dart';

class FeedTab extends StatelessWidget {
  final String projectDocId;
  final String orgCode;
  final Map<String, dynamic> orgData;
  final bool allowEdit;
  final String? description;
  const FeedTab({
    super.key,
    required this.projectDocId,
    required this.orgCode,
    required this.orgData,
    required this.allowEdit,
    this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if ((description ?? '').isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Text(description!, style: TextStyle(color: Colors.white.withValues(alpha: 0.9))),
          ),
        Expanded(
          child: UpdatesTab(
            orgId: projectDocId,
            orgCode: orgCode,
            orgData: orgData,
            allowEdit: allowEdit,
            forceProject: true,
            projectDocId: projectDocId,
          ),
        ),
      ],
    );
  }
}
