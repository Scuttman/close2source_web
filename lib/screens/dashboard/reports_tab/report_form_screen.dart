import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
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

  bool _isUploading = false; // progress flag

  /*──────── date picker ───────*/
  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      setState(() {
        _selectedDate = picked;
        _selectedTime = TimeOfDay.now();
      });
    }
  }

  /*──────── image-picker helpers (unchanged) ───────*/
  Future<void> _showImagePickerOptions() async {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder:
          (context) => Wrap(
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
          ),
    );
  }

  Future<bool> _requestPermissions({required bool fromCamera}) async {
    if (fromCamera) {
      final status = await Permission.camera.request();
      return status.isGranted;
    } else {
      if (Platform.isAndroid) {
        // Android 13+ uses the “photos” permission
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
    final granted = await _requestPermissions(fromCamera: fromCamera);
    if (!granted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Permission denied')));
      return;
    }

    final picked = await ImagePicker().pickImage(
      source: fromCamera ? ImageSource.camera : ImageSource.gallery,
      maxWidth: 800,
      maxHeight: 800,
    );

    if (picked != null) {
      final file = File(picked.path);
      final dir = await getApplicationDocumentsDirectory();
      final saved = await file.copy(
        '${dir.path}/${DateTime.now().millisecondsSinceEpoch}_${picked.name}',
      );
      setState(() => _selectedImages.add(saved));
    }
  }

  /*──────────────── submit / upload (ONLY logic we changed) ───────────────*/
  Future<void> _submitReport() async {
    if (!_formKey.currentState!.validate()) return;

    if (_selectedDate == null || _selectedTime == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Please pick date & time')));
      return;
    }
    if (_selectedImages.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please attach at least one image')),
      );
      return;
    }

    setState(() => _isUploading = true);

    try {
      // 1️⃣ upload images
      final urls = <String>[];
      for (final img in _selectedImages) {
        final name =
            '${DateTime.now().millisecondsSinceEpoch}_${img.path.split('/').last}';
        final ref = FirebaseStorage.instance.ref('report_images/$name');
        await ref.putFile(img);
        urls.add(await ref.getDownloadURL());
      }

      // 2️⃣ create combined dateTime
      final combined = DateTime(
        _selectedDate!.year,
        _selectedDate!.month,
        _selectedDate!.day,
        _selectedTime!.hour,
        _selectedTime!.minute,
      );

      // 3️⃣ Firestore write
      await FirebaseFirestore.instance.collection('reports').add({
        'title': _reportTitle.trim(),
        'summary': _reportSummary.trim(),
        'dateTime': combined,
        'imageUrls': urls,
        'createdAt': Timestamp.now(),
      });

      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('✅ Report submitted')));
      Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  /*──────── miniature gallery ───────*/
  Widget _buildImageGrid() {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        ..._selectedImages.map(
          (f) => ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.file(f, width: 80, height: 80, fit: BoxFit.cover),
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

  /*──────── UI scaffold ───────*/
  @override
  Widget build(BuildContext context) {
    final sw = MediaQuery.of(context).size.width;

    return Stack(
      children: [
        BackgroundScaffold(
          child: Scaffold(
            backgroundColor: Colors.transparent,
            body: Column(
              children: [
                /* header */
                Container(
                  color: Colors.deepOrange.withOpacity(0.7),
                  child: Column(
                    children: [
                      const SizedBox(height: 0),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Padding(
                            padding: const EdgeInsets.only(left: 10),
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
                /* form area */
                Expanded(
                  child: Container(
                    color: Colors.white.withOpacity(0.7),
                    child: Form(
                      key: _formKey,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          /* date row */
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
                          /* title */
                          TextFormField(
                            decoration: _inputDecoration('Report Title'),
                            onChanged: (v) => _reportTitle = v,
                            validator:
                                (v) =>
                                    v!.isEmpty ? 'Please enter a title' : null,
                          ),
                          const SizedBox(height: 10),
                          /* summary */
                          TextFormField(
                            maxLines: 3,
                            decoration: _inputDecoration('Report Summary'),
                            onChanged: (v) => _reportSummary = v,
                            validator:
                                (v) =>
                                    v!.isEmpty
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
                                  onPressed:
                                      _isUploading ? null : _submitReport,
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
        ),
        if (_isUploading)
          Container(
            color: Colors.black45,
            child: const Center(child: CircularProgressIndicator()),
          ),
      ],
    );
  }

  /*──────── decoration helper ───────*/
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
