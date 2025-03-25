import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../data/data_imports.dart';

class ProjectDetailWidget extends StatefulWidget {
  final String projectId; // Ensure we pass the project ID to fetch details

  const ProjectDetailWidget({super.key, required this.projectId});

  @override
  _ProjectDetailWidgetState createState() => _ProjectDetailWidgetState();
}

class _ProjectDetailWidgetState extends State<ProjectDetailWidget> {
  bool _isLoading = true;
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _fetchProjectDetails();
  }

  /// **Fetch Project from Repository and Update Provider**
  Future<void> _fetchProjectDetails() async {
    try {
      final projectProvider =
      Provider.of<ProjectsProvider>(context, listen: false);
      final projectRepo = ProjectsRepository();

      final project = await projectRepo.getProjectById(widget.projectId);

      if (project != null) {
        projectProvider.selectProject(widget.projectId);
      } else {
        setState(() {
          _errorMessage = "Project not found!";
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = "Error loading project: $e";
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final projectProvider = Provider.of<ProjectsProvider>(context);

    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage.isNotEmpty) {
      return Center(child: Text(_errorMessage, style: TextStyle(color: Colors.red)));
    }

    if (projectProvider.selectedProject == null) {
      return Container(
        width: MediaQuery.of(context).size.width,
        constraints: const BoxConstraints(minHeight: 20.0),
        child: const Center(
          child: Text('No Project!'),
        ),
      );
    }

    final project = projectProvider.selectedProject!;

    return Container(
      width: MediaQuery.of(context).size.width,
      constraints: const BoxConstraints(minHeight: 20.0),
      padding: const EdgeInsets.all(16.0),
      child: Card(
        elevation: 3,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10.0),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("📌 Project Name: ${project.projectName}",
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              Text("👤 Owner: ${project.projectOwner}"),
              Text("💰 Budget: ${project.projectBudget} ${project.projectCurrency}"),
              Text("🕒 Created: ${project.creationDate.toDate()}"),
              Text("🔄 Last Updated: ${project.lastUpdated.toDate()}"),
              Text("✅ Status: ${project.status}"),
              const SizedBox(height: 10),
              ElevatedButton(
                onPressed: _fetchProjectDetails, // Refresh button to reload project
                child: const Text("Refresh Project Data"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}