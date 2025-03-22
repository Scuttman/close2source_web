import 'dart:io';

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../../imports.dart'; // Assumes this includes ProjectsProvider & ProjectsRepository

class ReportFormScreen extends StatefulWidget {
  const ReportFormScreen({Key? key}) : super(key: key);

  @override
  _AddReportScreenState createState() => _AddReportScreenState();
}

class _AddReportScreenState extends State<ReportFormScreen> {
  final TextEditingController _updateTextController = TextEditingController();
  DateTime _selectedDate = DateTime.now();
  final List<File> _selectedImages = [];
  bool _isUploading = false;

  /// Pick an image from the gallery.
  Future<void> _pickImage() async {
    final pickedFile =
    await ImagePicker().pickImage(source: ImageSource.gallery);
    if (pickedFile != null) {
      setState(() {
        _selectedImages.add(File(pickedFile.path));
      });
    }
  }

  /// Uploads each selected image to Cloud Storage and returns their download URLs.
  Future<List<String>> _uploadImages(String projectId) async {
    List<String> downloadUrls = [];
    for (int i = 0; i < _selectedImages.length; i++) {
      File imageFile = _selectedImages[i];
      String fileName = '${DateTime.now().millisecondsSinceEpoch}_$i.jpg';
      Reference storageRef = FirebaseStorage.instance
          .ref()
          .child('reports')
          .child(projectId)
          .child(fileName);
      UploadTask uploadTask = storageRef.putFile(imageFile);
      TaskSnapshot snapshot = await uploadTask;
      String downloadUrl = await snapshot.ref.getDownloadURL();
      downloadUrls.add(downloadUrl);
    }
    return downloadUrls;
  }

  /// Opens a date picker for selecting the report date.
  Future<void> _selectDate() async {
    DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      setState(() {
        _selectedDate = picked;
      });
    }
  }

  /// Submit the report by uploading images and saving report data to Firestore.
  Future<void> _submitReport() async {
    final projectProvider =
    Provider.of<ProjectsProvider>(context, listen: false);
    final project = projectProvider.selectedProject;

    if (project == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text("❌ No project selected!"),
            backgroundColor: Colors.red),
      );
      return;
    }

    setState(() {
      _isUploading = true;
    });

    try {
      // Upload images if available.
      List<String> reportPhotos = [];
      if (_selectedImages.isNotEmpty) {
        reportPhotos = await _uploadImages(project.projectId);
      }

      // Split the update text by newline, trim, and filter out empty lines.
      List<String> updateTextList = _updateTextController.text
          .split('\n')
          .map((line) => line.trim())
          .where((line) => line.isNotEmpty)
          .toList();

      // Build the new report object.
      final newReport = {
        "reportDate": Timestamp.fromDate(_selectedDate),
        "updateText": updateTextList,
        "reportPhotos": reportPhotos,
      };

      // Use your ProjectsRepository to add the report.
      final repo = ProjectsRepository();
      await repo.addReportToProject(project.projectId, newReport);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text("✅ Report added successfully!"),
            backgroundColor: Colors.green),
      );

      Navigator.of(context).pop(); // Return to the previous screen.
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text("❌ Failed to add report!"),
            backgroundColor: Colors.red),
      );
    } finally {
      setState(() {
        _isUploading = false;
      });
    }
  }

  @override
  void dispose() {
    _updateTextController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Add New Report'),
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Date picker field.
              Text("Report Date",
                  style: TextStyle(fontWeight: FontWeight.bold)),
              SizedBox(height: 8),
              InkWell(
                onTap: _selectDate,
                child: Container(
                  padding:
                  EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                  decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey),
                      borderRadius: BorderRadius.circular(8)),
                  child: Text(DateFormat('dd/MM/yyyy').format(_selectedDate)),
                ),
              ),
              SizedBox(height: 16),
              // Update text field.
              Text("Update Text",
                  style: TextStyle(fontWeight: FontWeight.bold)),
              SizedBox(height: 8),
              TextField(
                controller: _updateTextController,
                maxLines: 5,
                decoration: InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: "Enter updates, one per line",
                ),
              ),
              SizedBox(height: 16),
              // Image selection section.
              Text("Report Photos",
                  style: TextStyle(fontWeight: FontWeight.bold)),
              SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _selectedImages.map((file) {
                  return Stack(
                    alignment: Alignment.topRight,
                    children: [
                      Image.file(file,
                          width: 100, height: 100, fit: BoxFit.cover),
                      GestureDetector(
                        onTap: () {
                          setState(() {
                            _selectedImages.remove(file);
                          });
                        },
                        child: Container(
                          color: Colors.black54,
                          child: Icon(Icons.close,
                              color: Colors.white, size: 16),
                        ),
                      )
                    ],
                  );
                }).toList(),
              ),
              SizedBox(height: 8),
              ElevatedButton.icon(
                onPressed: _pickImage,
                icon: Icon(Icons.add_a_photo),
                label: Text("Add Image"),
              ),
              SizedBox(height: 24),
              // Submit button.
              Center(
                child: _isUploading
                    ? CircularProgressIndicator()
                    : ElevatedButton(
                  onPressed: _submitReport,
                  child: Text("Submit Report"),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}