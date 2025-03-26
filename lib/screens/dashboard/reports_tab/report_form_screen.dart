import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../../imports.dart'; // Includes ProjectsProvider & themeGradientStart/themeGradientEnd

class ReportFormScreen extends StatefulWidget {
  const ReportFormScreen({super.key});

  @override
  State<ReportFormScreen> createState() => _ReportFormScreenState();
}

class _ReportFormScreenState extends State<ReportFormScreen> {
  final TextEditingController _updateTextController = TextEditingController();
  DateTime _selectedDate = DateTime.now();
  final List<File> _selectedImages = [];
  bool _isUploading = false;

  Future<void> _pickImage() async {
    final pickedFile = await ImagePicker().pickImage(
      source: ImageSource.gallery,
    );
    if (pickedFile != null) {
      setState(() => _selectedImages.add(File(pickedFile.path)));
    }
  }

  Future<List<String>> _uploadImages(String projectId) async {
    List<String> urls = [];
    for (int i = 0; i < _selectedImages.length; i++) {
      File imageFile = _selectedImages[i];
      String fileName = '${DateTime.now().millisecondsSinceEpoch}_$i.jpg';
      Reference storageRef = FirebaseStorage.instance.ref().child(
        'reports/$projectId/$fileName',
      );
      UploadTask uploadTask = storageRef.putFile(imageFile);
      TaskSnapshot snapshot = await uploadTask;
      urls.add(await snapshot.ref.getDownloadURL());
    }
    return urls;
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _selectedDate = picked);
  }

  Future<void> _submitReport() async {
    final project =
        Provider.of<ProjectsProvider>(context, listen: false).selectedProject;

    if (project == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("❌ No project selected!")));
      return;
    }

    setState(() => _isUploading = true);

    try {
      List<String> reportPhotos =
          _selectedImages.isNotEmpty
              ? await _uploadImages(project.projectId)
              : [];

      List<String> updateTextList =
          _updateTextController.text
              .split('\n')
              .map((line) => line.trim())
              .where((line) => line.isNotEmpty)
              .toList();

      final newReport = {
        "reportDate": Timestamp.fromDate(_selectedDate),
        "updateText": updateTextList,
        "reportPhotos": reportPhotos,
      };

      await ProjectsRepository().addReportToProject(
        project.projectId,
        newReport,
      );

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("✅ Report added successfully!")),
      );
      Navigator.pop(context);
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("❌ Failed to add report!")));
    } finally {
      setState(() => _isUploading = false);
    }
  }

  Widget _buildCard(Widget child) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 10),
      elevation: 3,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(padding: const EdgeInsets.all(16), child: child),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Add New Report'),
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [themeGradientStart, themeGradientEnd],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _buildCard(
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    "Report Date",
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  InkWell(
                    onTap: _selectDate,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        vertical: 12,
                        horizontal: 16,
                      ),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        DateFormat('dd/MM/yyyy').format(_selectedDate),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            _buildCard(
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    "Update Text",
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _updateTextController,
                    maxLines: 5,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      hintText: "Enter updates, one per line",
                    ),
                  ),
                ],
              ),
            ),
            _buildCard(
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    "Report Photos",
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children:
                        _selectedImages.map((file) {
                          return Stack(
                            alignment: Alignment.topRight,
                            children: [
                              Image.file(
                                file,
                                width: 100,
                                height: 100,
                                fit: BoxFit.cover,
                              ),
                              GestureDetector(
                                onTap:
                                    () => setState(
                                      () => _selectedImages.remove(file),
                                    ),
                                child: Container(
                                  color: Colors.black54,
                                  child: const Icon(
                                    Icons.close,
                                    color: Colors.white,
                                    size: 16,
                                  ),
                                ),
                              ),
                            ],
                          );
                        }).toList(),
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton.icon(
                    onPressed: _pickImage,
                    icon: const Icon(Icons.add_a_photo),
                    label: const Text("Add Image"),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: themeGradientStart,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Center(
              child:
                  _isUploading
                      ? const CircularProgressIndicator()
                      : ElevatedButton.icon(
                        onPressed: _submitReport,
                        icon: const Icon(Icons.send),
                        label: const Text("Submit Report"),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: themeGradientEnd,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 32,
                            vertical: 14,
                          ),
                        ),
                      ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: _bottomBar(),
    );
  }

  Widget _bottomBar() {
    return Material(
      elevation: 4.0,
      borderRadius: const BorderRadius.only(
        topLeft: Radius.circular(20),
        topRight: Radius.circular(20),
      ),
      child: Container(
        height: 60,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [themeGradientStart, themeGradientEnd],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(20),
            topRight: Radius.circular(20),
          ),
        ),
        child: const Center(
          child: Text(
            '© Close2Source',
            style: TextStyle(color: Colors.white70),
          ),
        ),
      ),
    );
  }
}
