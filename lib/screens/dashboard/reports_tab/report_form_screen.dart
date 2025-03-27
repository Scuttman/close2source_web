import 'dart:io';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../../imports.dart';

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

  Future<void> _pickImage(ImageSource source) async {
    final pickedFile = await ImagePicker().pickImage(source: source);
    if (pickedFile != null) {
      setState(() => _selectedImages.add(File(pickedFile.path)));
    }
  }

  void _showImagePickerOptions() {
    showModalBottomSheet(
      context: context,
      builder:
          (context) => SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.camera_alt),
                    title: const Text('Camera'),
                    onTap: () {
                      Navigator.pop(context);
                      _pickImage(ImageSource.camera);
                    },
                  ),
                ),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.photo_library),
                    title: const Text('Gallery'),
                    onTap: () {
                      Navigator.pop(context);
                      _pickImage(ImageSource.gallery);
                    },
                  ),
                ),
              ],
            ),
          ),
    );
  }

  Future<List<String>> _uploadImages(String projectId) async {
    List<String> urls = [];
    for (var imageFile in _selectedImages) {
      String fileName = '${DateTime.now().millisecondsSinceEpoch}.jpg';
      Reference storageRef = FirebaseStorage.instance.ref(
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

      final newReport = {
        "reportDate": Timestamp.fromDate(_selectedDate),
        "updateText":
            _updateTextController.text
                .split('\n')
                .where((e) => e.isNotEmpty)
                .toList(),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Add New Report'),
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [themeGradientStart, themeGradientEnd],
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Card(
              child: ListTile(
                title: const Text("Report Date"),
                trailing: Text(DateFormat('dd/MM/yyyy').format(_selectedDate)),
                onTap: _selectDate,
              ),
            ),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(8.0),
                child: TextField(
                  controller: _updateTextController,
                  maxLines: 5,
                  decoration: const InputDecoration(hintText: "Enter updates"),
                ),
              ),
            ),
            Card(
              child: Column(
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children:
                        _selectedImages
                            .map(
                              (file) => Image.file(
                                file,
                                width: 100,
                                height: 100,
                                fit: BoxFit.cover,
                              ),
                            )
                            .toList(),
                  ),
                  ElevatedButton.icon(
                    icon: const Icon(Icons.add_a_photo),
                    label: const Text("Add Image"),
                    onPressed: _showImagePickerOptions,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            _isUploading
                ? const CircularProgressIndicator()
                : ElevatedButton.icon(
                  icon: const Icon(Icons.send),
                  label: const Text("Submit Report"),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: themeGradientEnd,
                  ),
                  onPressed: _submitReport,
                ),
          ],
        ),
      ),
    );
  }
}
