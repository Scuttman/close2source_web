import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../../../imports.dart';
import 'package:intl/intl.dart';

class ReportFormScreen extends StatefulWidget {
  const ReportFormScreen({Key? key}) : super(key: key);

  @override
  _ReportFormScreenState createState() => _ReportFormScreenState();
}

class _ReportFormScreenState extends State<ReportFormScreen> {
  final _formKey = GlobalKey<FormState>();
  String _reportTitle = '';
  String _reportSummary = '';
  List<File> _selectedImages = [];
  DateTime? _selectedDate;

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

  Future<void> _pickImage({required bool fromCamera}) async {
    final pickedFile = await ImagePicker().pickImage(
      source: fromCamera ? ImageSource.camera : ImageSource.gallery,
      maxWidth: 800,
      maxHeight: 800,
    );

    if (pickedFile != null) {
      setState(() {
        _selectedImages.add(File(pickedFile.path));
      });
    }
  }

  Future<void> _submitReport() async {
    if (_formKey.currentState?.validate() ?? false) {
      if (_selectedDate == null) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Please pick a date')));
        return;
      }

      final newReport = {
        'title': _reportTitle,
        'timestamp': Timestamp.now(),
        'summary': _reportSummary,
        'date': _selectedDate,
        'images': _selectedImages.map((image) => image.path).toList(),
      };

      Navigator.pop(context, newReport);
    }
  }

  Widget _buildImageGrid() {
    return GridView.builder(
      shrinkWrap: true,
      physics: NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 4,
        mainAxisSpacing: 4,
      ),
      itemCount: _selectedImages.length + 1,
      itemBuilder: (context, index) {
        if (index == _selectedImages.length) {
          return GestureDetector(
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
          );
        }
        return Image.file(_selectedImages[index], fit: BoxFit.cover);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return BackgroundScaffold(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Padding(
          padding: const EdgeInsets.all(10.0),
          child: Column(
            children: [
              Container(
                color: Colors.deepOrange.withOpacity(0.7),
                padding: const EdgeInsets.only(left: 10.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'CLOSE2SOURCE',
                      style: GoogleFonts.amaticSc(
                        textStyle: const TextStyle(
                          color: Colors.white,
                          letterSpacing: 0.1,
                          fontSize: 40.0,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(
                        Icons.exit_to_app,
                        color: Colors.white,
                        size: 30.0,
                      ),
                      onPressed: () {
                        Navigator.pop(context);
                      },
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Container(
                  color: Colors.white.withOpacity(0.7),
                  padding: const EdgeInsets.all(0.0),
                  child: Form(
                    key: _formKey,
                    child: ListView(
                      children: [
                        // Moved Date Picker outside the Card widget
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16.0,
                            vertical: 6.0,
                          ),
                          child: Row(
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
                                      : 'Date: ${DateFormat('dd/MM/yyyy').format(_selectedDate!)}',
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
                        ),
                        // Removed the Card around TextFormField for Report Title
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16.0,
                            vertical: 6.0,
                          ),
                          child: TextFormField(
                            decoration: InputDecoration(
                              labelText: 'Report Title',
                              filled: true,
                              fillColor: Colors.transparent,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10.0),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10.0),
                                borderSide: const BorderSide(
                                  color: Colors.deepOrange,
                                ),
                              ),
                            ),
                            onChanged: (value) => _reportTitle = value,
                          ),
                        ),
                        // Removed the Card around TextFormField for Report Summary
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16.0,
                            vertical: 6.0,
                          ),
                          child: TextFormField(
                            decoration: InputDecoration(
                              labelText: 'Report Summary',
                              filled: true,
                              fillColor: Colors.transparent,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10.0),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10.0),
                                borderSide: const BorderSide(
                                  color: Colors.deepOrange,
                                ),
                              ),
                            ),
                            maxLines: 3,
                            onChanged: (value) => _reportSummary = value,
                          ),
                        ),
                        // Image Grid (not inside Card now)
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16.0,
                            vertical: 6.0,
                          ),
                          child: _buildImageGrid(),
                        ),
                        const SizedBox(height: 24),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(right: 15.0),
                              child: Container(
                                width: 150.0,
                                child: ElevatedButton.icon(
                                  onPressed: _submitReport,
                                  icon: const Icon(
                                    Icons.send,
                                    color: Colors.white,
                                  ),
                                  label: const Text(
                                    'Submit',
                                    style: TextStyle(color: Colors.white),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.deepOrange,
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 24,
                                      vertical: 12,
                                    ),
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
      ),
    );
  }
}
