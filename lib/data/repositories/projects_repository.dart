import 'package:close2source/imports.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class ProjectsRepository {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final CollectionReference _projectsCollection;

  ProjectsRepository() : _projectsCollection = FirebaseFirestore.instance.collection(projectDataUrl);

  /// **📌 Fetch a Single Project**
  Future<Project?> getProjectById(String projectId) async {
    return await Future.delayed(Duration.zero, () async {
      DocumentSnapshot doc = await _projectsCollection.doc(projectId).get();
      return Project.fromFirestore(doc);
    });
  }

  /// **📌 Fetch All Projects as a Stream**
  Stream<List<Project>> getAllProjects() {
    return _projectsCollection.snapshots().map((snapshot) {
      return snapshot.docs.map((doc) => Project.fromFirestore(doc)).toList();
    });
  }

  /// **📌 Add a New Project**
  Future<void> addProject(Project project) async {
    try {
      await _projectsCollection.doc(project.projectId).set(project.toJson());
    } catch (e) {
      print("Error adding project: $e");
    }
  }

  /// **📌 Update an Existing Project**
  Future<void> updateProject(Project project) async {
    try {
      await _projectsCollection.doc(project.projectId).update(project.toJson());
    } catch (e) {
      print("Error updating project: $e");
    }
  }

  /// **📌 Delete a Project**
  Future<void> deleteProject(String projectId) async {
    try {
      await _projectsCollection.doc(projectId).delete();
    } catch (e) {
      print("Error deleting project: $e");
    }
  }

  Future<void> addReportToProject(String projectId, Map<String, dynamic> report) async {
    try {
      final projectRef = _projectsCollection.doc(projectId);

      await projectRef.update({
        "reportList": FieldValue.arrayUnion([report])
      });

      print("✅ Report added successfully!");
    } catch (e) {
      print("❌ Error adding report: $e");
      throw Exception("Failed to add report.");
    }
  }
}