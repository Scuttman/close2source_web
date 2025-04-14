import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../../imports.dart';

class ReportFormScreen extends StatefulWidget {
  const ReportFormScreen({super.key});

  @override
  _ReportFormScreenState createState() => _ReportFormScreenState();
}

class _ReportFormScreenState extends State<ReportFormScreen> {
  final _formKey = GlobalKey<FormState>();
  String _reportTitle = '';
  String _reportSummary = '';
  final List<File> _selectedImages = [];
  DateTime? _selectedDate;
  TimeOfDay? _selectedTime;

  Future<void> _pickDate() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      setState(() {
        _selectedDate = picked;
        _selectedTime = TimeOfDay.now(); // Automatically pick current time
      });
    }
  }

  Future<void> _showImagePickerOptions() async {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Take Photo'),
              onTap: () async {
                Navigator.pop(context);
                await _pickImage(fromCamera: true);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Choose from Gallery'),
              onTap: () async {
                Navigator.pop(context);
                await _pickImage(fromCamera: false);
              },
            ),
          ],
        );
      },
    );
  }

  Future<bool> _requestPermissions({required bool fromCamera}) async {
    if (fromCamera) {
      final status = await Permission.camera.request();
      return status.isGranted;
    } else {
      if (Platform.isAndroid) {
        if (Platform.version.startsWith('13')) {
          final status = await Permission.photos.request();
          return status.isGranted;
        } else {
          final status = await Permission.storage.request();
          return status.isGranted;
        }
      } else {
        final status = await Permission.photos.request();
        return status.isGranted;
      }
    }
  }

  Future<void> _pickImage({required bool fromCamera}) async {
    bool granted = await _requestPermissions(fromCamera: fromCamera);
    if (!granted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Permission denied')));
      return;
    }

    final pickedFile = await ImagePicker().pickImage(
      source: fromCamera ? ImageSource.camera : ImageSource.gallery,
      maxWidth: 800,
      maxHeight: 800,
    );

    if (pickedFile != null) {
      final File imageFile = File(pickedFile.path);
      final directory = await getApplicationDocumentsDirectory();
      final savedImage = await imageFile.copy(
        '${directory.path}/${DateTime.now().millisecondsSinceEpoch}_${pickedFile.name}',
      );
      setState(() {
        _selectedImages.add(savedImage);
      });
    }
  }

  Future<void> _submitReport() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedDate == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Please pick a date')));
      return;
    }

    try {
      List<String> imageUrls = [];
      for (File image in _selectedImages) {
        String fileName = '${DateTime.now().millisecondsSinceEpoch}.jpg';
        Reference ref = FirebaseStorage.instance.ref().child(
          'report_images/$fileName',
        );
        await ref.putFile(image);
        String downloadUrl = await ref.getDownloadURL();
        imageUrls.add(downloadUrl);
      }

      await FirebaseFirestore.instance.collection('reports').add({
        'title': _reportTitle,
        'summary': _reportSummary,
        'timestamp': Timestamp.now(),
        'date': _selectedDate,
        'images': imageUrls,
        'time': _selectedTime?.format(context) ?? '',
      });

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Report submitted successfully.')),
      );
      await Future.delayed(const Duration(milliseconds: 300));
      Navigator.pop(context, true);
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error: ${e.toString()}')));
    }
  }

  Widget _buildImageGrid() {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        ..._selectedImages.map(
          (file) => ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.file(file, height: 80, width: 80, fit: BoxFit.cover),
          ),
        ),
        GestureDetector(
          onTap: _showImagePickerOptions,
          child: Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Center(
              child: Icon(Icons.add, size: 30, color: Colors.black54),
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    double sw = MediaQuery.of(context).size.width;
    return BackgroundScaffold(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Column(
          children: [
            Container(
              color: Colors.deepOrange.withOpacity(0.7),
              child: Column(
                children: [
                  const SizedBox(height: 0),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(left: 10.0),
                        child: Text(
                          'CLOSE2SOURCE',
                          style: GoogleFonts.amaticSc(
                            textStyle: const TextStyle(
                              color: Colors.white,
                              fontSize: 40,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(
                          Icons.exit_to_app,
                          color: Colors.white,
                          size: 30,
                        ),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                  Container(height: 20, width: sw, color: Colors.black),
                ],
              ),
            ),
            Expanded(
              child: Container(
                color: Colors.white.withOpacity(0.7),
                child: Form(
                  key: _formKey,
                  child: ListView(
                    padding: const EdgeInsets.all(16.0),
                    children: [
                      Row(
                        children: [
                          const Icon(
                            Icons.calendar_today,
                            color: Colors.deepOrange,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _selectedDate == null
                                  ? 'Select Date'
                                  : 'Date: ${DateFormat('dd/MM/yyyy').format(_selectedDate!)} at ${_selectedTime?.format(context) ?? ''}',
                              style: const TextStyle(fontSize: 16),
                            ),
                          ),
                          TextButton(
                            onPressed: _pickDate,
                            child: const Text(
                              'Pick Date',
                              style: TextStyle(color: Colors.deepOrange),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      TextFormField(
                        decoration: _inputDecoration('Report Title'),
                        onChanged: (value) => _reportTitle = value,
                        validator:
                            (value) =>
                                value!.isEmpty ? 'Please enter a title' : null,
                      ),
                      const SizedBox(height: 10),
                      TextFormField(
                        maxLines: 3,
                        decoration: _inputDecoration('Report Summary'),
                        onChanged: (value) => _reportSummary = value,
                        validator:
                            (value) =>
                                value!.isEmpty
                                    ? 'Please enter a summary'
                                    : null,
                      ),
                      const SizedBox(height: 10),
                      _buildImageGrid(),
                      const SizedBox(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          SizedBox(
                            width: 150,
                            child: ElevatedButton.icon(
                              onPressed: _submitReport,
                              icon: const Icon(Icons.send, color: Colors.white),
                              label: const Text(
                                'Submit',
                                style: TextStyle(color: Colors.white),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.deepOrange,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String label) {
    return InputDecoration(
      labelText: label,
      filled: true,
      fillColor: Colors.transparent,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Colors.deepOrange),
      ),
    );
  }
}
