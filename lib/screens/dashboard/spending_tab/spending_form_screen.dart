import '../../../imports.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';

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
    final pickedFile =
        await ImagePicker().pickImage(source: ImageSource.gallery);

    if (pickedFile != null) {
      setState(() {
        _receiptImage = File(pickedFile.path);
      });
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

  void _submitForm() {
    if (_formKey.currentState!.validate()) {
      // Save data
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Spending submitted!')),
      );

      // Clear form or save to DB
    }
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
              // Date Picker
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
              const SizedBox(height: 16),

              // Description
              TextFormField(
                controller: _descController,
                decoration: const InputDecoration(labelText: 'Description'),
                validator: (val) =>
                    val == null || val.isEmpty ? 'Enter a description' : null,
              ),
              const SizedBox(height: 16),

              // Budget Category
              DropdownButtonFormField<String>(
                value: _selectedCategory,
                items: _categories
                    .map((cat) => DropdownMenuItem(
                          value: cat,
                          child: Text(cat),
                        ))
                    .toList(),
                onChanged: (val) {
                  setState(() {
                    _selectedCategory = val;
                  });
                },
                decoration: const InputDecoration(labelText: 'Budget Category'),
                validator: (val) =>
                    val == null ? 'Select a category' : null,
              ),
              const SizedBox(height: 16),

              // Total Amount
              TextFormField(
                controller: _totalController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Total Amount'),
                validator: (val) =>
                    val == null || val.isEmpty ? 'Enter total amount' : null,
              ),
              const SizedBox(height: 16),

              // Receipt Upload
              Row(
                children: [
                  ElevatedButton(
                    onPressed: _pickReceiptImage,
                    child: const Text('Upload Receipt'),
                  ),
                  const SizedBox(width: 12),
                  _receiptImage != null
                      ? const Icon(Icons.check_circle, color: Colors.green)
                      : const Text('No file selected'),
                ],
              ),
              const SizedBox(height: 32),

              // Submit Button
              ElevatedButton.icon(
                onPressed: _submitForm,
                icon: const Icon(Icons.send),
                label: const Text('Submit'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: themeGradientEnd,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 24, vertical: 12),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
