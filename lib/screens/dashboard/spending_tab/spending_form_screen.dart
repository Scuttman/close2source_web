import '../../../imports.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'package:intl/intl.dart';

class SpendingFormScreen extends StatefulWidget {
  final Profile profile;

  const SpendingFormScreen({super.key, required this.profile});

  @override
  State<SpendingFormScreen> createState() => _SpendingFormScreenState();
}

class _SpendingFormScreenState extends State<SpendingFormScreen> {
  final _formKey = GlobalKey<FormState>();
  DateTime? _selectedDate;
  final TextEditingController _descController = TextEditingController();
  String? _selectedCategory;
  final TextEditingController _totalController = TextEditingController();
  final List<String> _receiptImages = [];
  final ImagePicker _picker = ImagePicker();

  final List<String> _categories = [
    'Travel',
    'Supplies',
    'Food',
    'Utilities',
    'Other',
  ];

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
    final pickedFile = await _picker.pickImage(
      source: fromCamera ? ImageSource.camera : ImageSource.gallery,
      imageQuality: 85,
    );

    if (pickedFile != null) {
      setState(() {
        _receiptImages.add(pickedFile.path);
      });
    }
  }

  Future<void> _submitForm() async {
    if (!_formKey.currentState!.validate()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please complete the form')),
      );
      return;
    }

    if (_selectedDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please pick a date')),
      );
      return;
    }

    if (_receiptImages.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add at least one image')),
      );
      return;
    }

    // ✅ Now it's safe to use _selectedDate!
    final spending = SpendingEntry(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      description: _descController.text.trim(),
      category: _selectedCategory ?? '',
      amount: double.tryParse(_totalController.text) ?? 0,
      date: _selectedDate!, // Safe now
      receiptImages: _receiptImages,
      isUploaded: false,
      profileId: widget.profile.profileId,
    );

    try {
      await ProfileRepository().addTransactionToProfile(
        profileId: widget.profile.profileId,
        transaction: spending,
      );

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✅ Saved locally. Will sync when online.'),
        ),
      );

      Navigator.of(context).pop();
    } catch (e) {
      debugPrint("Error saving: $e");
    }
  }

  Widget _buildImageGrid() {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        ..._receiptImages.map(
          (path) => ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.file(
              File(path),
              height: 80,
              width: 80,
              fit: BoxFit.cover,
            ),
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
    return BackgroundScaffold(
      child: Scaffold(
        backgroundColor: Colors.transparent,

        body: Padding(
          padding: const EdgeInsets.only(
            left: 10.0,
            right: 10.0,
            top: 10.0,
            bottom: 10.0,
          ),
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
                    key:   _formKey,
                    child: ListView(
                      children: [
                        _buildCard(
                          Row(
                            children: [
                              const Icon(Icons.calendar_today, color: Colors.deepOrange),
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
                        _buildCard(
                          TextFormField(
                            controller: _descController,
                            maxLines: 3,
                            decoration: InputDecoration(
                              labelText: 'Description',
                              prefixIcon: const Icon(Icons.description, color: Colors.deepOrange),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10.0),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10.0),
                                borderSide: const BorderSide(color: Colors.deepOrange),
                              ),
                            ),
                            validator: (val) =>
                            val == null || val.isEmpty ? 'Enter a description' : null,
                          ),
                        ),
                        _buildCard(
                          DropdownButtonFormField<String>(
                            value: _selectedCategory,
                            items: _categories
                                .map(
                                  (cat) => DropdownMenuItem(
                                value: cat,
                                child: Text(cat),
                              ),
                            )
                                .toList(),
                            onChanged: (val) => setState(() => _selectedCategory = val),
                            decoration: InputDecoration(
                              labelText: 'Budget Category',
                              prefixIcon: const Icon(Icons.category, color: Colors.deepOrange),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10.0),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10.0),
                                borderSide: const BorderSide(color: Colors.deepOrange),
                              ),
                            ),
                            validator: (val) => val == null ? 'Select a category' : null,
                          ),
                        ),
                        _buildCard(
                          TextFormField(
                            controller: _totalController,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: 'Total Amount',
                              prefixIcon: const Icon(Icons.attach_money, color: Colors.deepOrange),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10.0),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10.0),
                                borderSide: const BorderSide(color: Colors.deepOrange),
                              ),
                            ),
                            validator: (val) =>
                            val == null || val.isEmpty ? 'Enter total amount' : null,
                          ),
                        ),
                        _buildCard(_buildImageGrid()),
                        const SizedBox(height: 24),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(right:15.0),
                              child: Container(
                                width: 150.0,
                                child: ElevatedButton.icon(
                                  onPressed: _submitForm,
                                  icon: const Icon(Icons.send, color: Colors.white,),
                                  label: const Text('Submit', style: TextStyle(color:Colors.white)),
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
              )
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCard(Widget child) {
    return  Padding(padding: const EdgeInsets.only(
      left:16,
      right: 16.0,
      top: 6.0, bottom: 6.0
    ), child: child);
  }
}
