import '../../imports.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';

class UserRegistrationForm extends StatefulWidget {
  const UserRegistrationForm({super.key});

  @override
  State<UserRegistrationForm> createState() => _UserRegistrationFormState();
}

class _UserRegistrationFormState extends State<UserRegistrationForm> {
  final _formKey = GlobalKey<FormState>();
  final ImagePicker _picker = ImagePicker();
  File? _profileImage;

  String? _name;
  String? _organization;
  String? _contact;
  String? _email;
  String? _password;
  bool _obscurePassword = true;

  Future<void> _pickImage() async {
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
                onTap: () async {
                  Navigator.pop(context);
                  final pickedFile = await _picker.pickImage(
                    source: ImageSource.camera,
                    imageQuality: 80,
                  );
                  if (pickedFile != null) {
                    setState(() {
                      _profileImage = File(pickedFile.path);
                    });
                  }
                },
              ),
              const SizedBox(height: 12),
              _buildImageOption(
                icon: Icons.photo_library,
                text: "Choose from Gallery",
                onTap: () async {
                  Navigator.pop(context);
                  final pickedFile = await _picker.pickImage(
                    source: ImageSource.gallery,
                    imageQuality: 80,
                  );
                  if (pickedFile != null) {
                    setState(() {
                      _profileImage = File(pickedFile.path);
                    });
                  }
                },
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
      onTap: onTap,
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

  void _submitForm() {
    if (_formKey.currentState?.validate() ?? false) {
      _formKey.currentState?.save();

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('✅ User Registered')));

      Navigator.pop(context);
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
      body: Column(
        children: [
          const ScreenNormalAppBarWidget(title: "Register", logOut: false),
          Container(
            height: 40,
            padding: const EdgeInsets.only(top: 10, left: 15),
            child: const Row(
              children: [
                Text(
                  'Register New User',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                ),
              ],
            ),
          ),
          const Divider(),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  children: [
                    _buildCard(
                      Center(
                        child: GestureDetector(
                          onTap: _pickImage,
                          child: CircleAvatar(
                            radius: 50,
                            backgroundColor: Colors.grey[300],
                            backgroundImage:
                                _profileImage != null
                                    ? FileImage(_profileImage!)
                                    : null,
                            child:
                                _profileImage == null
                                    ? const Icon(
                                      Icons.camera_alt,
                                      size: 40,
                                      color: Colors.brown,
                                    )
                                    : null,
                          ),
                        ),
                      ),
                    ),
                    _buildCard(
                      TextFormField(
                        decoration: const InputDecoration(
                          labelText: "Full Name",
                        ),
                        onSaved: (val) => _name = val,
                        validator:
                            (val) =>
                                val == null || val.isEmpty
                                    ? "Enter your name"
                                    : null,
                      ),
                    ),
                    _buildCard(
                      TextFormField(
                        decoration: const InputDecoration(
                          labelText: "Organization",
                        ),
                        onSaved: (val) => _organization = val,
                        validator:
                            (val) =>
                                val == null || val.isEmpty
                                    ? "Enter organization name"
                                    : null,
                      ),
                    ),
                    _buildCard(
                      TextFormField(
                        decoration: const InputDecoration(
                          labelText: "Contact Number",
                        ),
                        keyboardType: TextInputType.phone,
                        onSaved: (val) => _contact = val,
                        validator:
                            (val) =>
                                val == null || val.length < 7
                                    ? "Enter a valid contact"
                                    : null,
                      ),
                    ),
                    _buildCard(
                      TextFormField(
                        decoration: const InputDecoration(
                          labelText: "Email Address",
                        ),
                        keyboardType: TextInputType.emailAddress,
                        onSaved: (val) => _email = val,
                        validator:
                            (val) =>
                                val == null || !val.contains('@')
                                    ? "Enter a valid email"
                                    : null,
                      ),
                    ),
                    _buildCard(
                      TextFormField(
                        obscureText: _obscurePassword,
                        decoration: InputDecoration(
                          labelText: "Password",
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword
                                  ? Icons.visibility
                                  : Icons.visibility_off,
                            ),
                            onPressed: () {
                              setState(() {
                                _obscurePassword = !_obscurePassword;
                              });
                            },
                          ),
                        ),
                        onSaved: (val) => _password = val,
                        validator:
                            (val) =>
                                val == null || val.length < 6
                                    ? "Password must be at least 6 characters"
                                    : null,
                      ),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      onPressed: _submitForm,
                      icon: const Icon(Icons.save),
                      label: const Text("Submit"),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.brown,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 30,
                          vertical: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
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
