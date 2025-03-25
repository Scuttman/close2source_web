import '../../../imports.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image_cropper/image_cropper.dart';
import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';

class SpendingFormScreen extends StatefulWidget {
  const SpendingFormScreen({super.key});

  @override
  State<SpendingFormScreen> createState() => _SpendingFormScreenState();
}

class _SpendingFormScreenState extends State<SpendingFormScreen> {
  final _formKey = GlobalKey<FormState>();

  DateTime? _selectedDate;
  final TextEditingController _descController = TextEditingController();
  String? _selectedCategory;
  final TextEditingController _totalController = TextEditingController();
  File? _receiptImage;

  final List<String> _categories = [
    'Travel',
    'Supplies',
    'Food',
    'Utilities',
    'Other',
  ];

  Future<void> _pickReceiptImage() async {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildImageOption(
                icon: Icons.camera_alt,
                text: "Take Photo",
                onTap: () => _pickAndCrop(ImageSource.camera),
              ),
              const SizedBox(height: 12),
              _buildImageOption(
                icon: Icons.photo_library,
                text: "Choose from Gallery",
                onTap: () => _pickAndCrop(ImageSource.gallery),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildImageOption({
    required IconData icon,
    required String text,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: () {
        Navigator.pop(context);
        onTap();
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.brown.shade50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.brown.shade200),
        ),
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
        child: Row(
          children: [
            Icon(icon, size: 28, color: Colors.brown),
            const SizedBox(width: 16),
            Text(
              text,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickAndCrop(ImageSource source) async {
    final picked = await ImagePicker().pickImage(
      source: source,
      imageQuality: 85,
    );
    if (picked != null) {
      final cropped = await ImageCropper().cropImage(
        sourcePath: picked.path,
        compressQuality: 80,
        uiSettings: [
          AndroidUiSettings(
            toolbarTitle: 'Crop Receipt',
            toolbarColor: themeGradientStart,
            statusBarColor: themeGradientStart,
            toolbarWidgetColor: Colors.white,
            lockAspectRatio: false,
          ),
        ],
      );

      if (cropped != null) {
        setState(() {
          _receiptImage = File(cropped.path);
        });
      }
    }
  }

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

  Future<void> _submitForm() async {
    if (!_formKey.currentState!.validate()) return;

    if (_selectedDate == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('📅 Please select a date')));
      return;
    }

    if (_receiptImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('📸 Please upload a receipt image')),
      );
      return;
    }

    try {
      final spendingId = DateTime.now().millisecondsSinceEpoch.toString();
      final receiptRef = FirebaseStorage.instance
          .ref()
          .child('receipts')
          .child('$spendingId.jpg');

      await receiptRef.putFile(_receiptImage!);
      final receiptUrl = await receiptRef.getDownloadURL();

      await FirebaseFirestore.instance
          .collection('spendings')
          .doc(spendingId)
          .set({
            'description': _descController.text.trim(),
            'category': _selectedCategory,
            'amount': double.tryParse(_totalController.text),
            'date': _selectedDate,
            'receiptUrl': receiptUrl,
            'createdAt': FieldValue.serverTimestamp(),
          });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('✅ Spending submitted and saved!')),
      );

      Navigator.pop(context);
    } catch (e) {
      debugPrint('🔥 Error saving spending: $e');
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('❌ Failed to submit: $e')));
    }
  }

  Widget _buildCard(Widget child) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 10),
      elevation: 3,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: child,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Add Spending'),
        backgroundColor: themeGradientStart,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              _buildCard(
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _selectedDate == null
                            ? 'Select Date'
                            : 'Date: ${_selectedDate!.toLocal()}'.split(' ')[0],
                      ),
                    ),
                    TextButton(
                      onPressed: _pickDate,
                      child: const Text('Pick Date'),
                    ),
                  ],
                ),
              ),
              _buildCard(
                TextFormField(
                  controller: _descController,
                  decoration: const InputDecoration(labelText: 'Description'),
                  validator:
                      (val) =>
                          val == null || val.isEmpty
                              ? 'Enter a description'
                              : null,
                ),
              ),
              _buildCard(
                DropdownButtonFormField<String>(
                  value: _selectedCategory,
                  items:
                      _categories
                          .map(
                            (cat) =>
                                DropdownMenuItem(value: cat, child: Text(cat)),
                          )
                          .toList(),
                  onChanged: (val) {
                    setState(() {
                      _selectedCategory = val;
                    });
                  },
                  decoration: const InputDecoration(
                    labelText: 'Budget Category',
                  ),
                  validator: (val) => val == null ? 'Select a category' : null,
                ),
              ),
              _buildCard(
                TextFormField(
                  controller: _totalController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Total Amount'),
                  validator:
                      (val) =>
                          val == null || val.isEmpty
                              ? 'Enter total amount'
                              : null,
                ),
              ),
              _buildCard(
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ElevatedButton(
                      onPressed: _pickReceiptImage,
                      child: const Text('Upload Receipt'),
                    ),
                    const SizedBox(height: 8),
                    if (_receiptImage != null)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.file(
                          _receiptImage!,
                          height: 150,
                          fit: BoxFit.cover,
                        ),
                      )
                    else
                      const Text('No file selected'),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _submitForm,
                icon: const Icon(Icons.send),
                label: const Text('Submit'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: themeGradientEnd,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 12,
                  ),
                ),
              ),
            ],
          ),
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
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [themeGradientStart, themeGradientEnd],
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
