import 'package:flutter/material.dart';
import '../data_imports.dart';

/// **🔥 Projects Provider (Manages the Selected Project)**
class ProjectsProvider extends ChangeNotifier {
  final ProjectsRepository _repository = ProjectsRepository();
  Project? _selectedProject;

  /// **🔹 Get Selected Project**
  Project? get selectedProject => _selectedProject;

  /// **🔹 Select a Project (Fetches Details)**
  Future<void> selectProject(String projectId) async {
    Project? project = await _repository.getProjectById(projectId);
    if (project != null) {
      _selectedProject = project;
      notifyListeners();
    }
  }

  /// **🔹 Update Selected Project**
  Future<void> updateProject(Project updatedProject) async {
    await _repository.updateProject(updatedProject);
    _selectedProject = updatedProject;
    notifyListeners();
  }

  /// **🔹 Clear Selected Project**
  void clearProject() {
    _selectedProject = null;
    notifyListeners();
  }
}