import '../../imports.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:path/path.dart' as path;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:hive/hive.dart';
import 'dart:io';

class UserRegistrationForm extends StatefulWidget {
  const UserRegistrationForm({super.key});

  @override
  State<UserRegistrationForm> createState() => _UserRegistrationFormState();
}

class _UserRegistrationFormState extends State<UserRegistrationForm> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _organisationController = TextEditingController();
  final TextEditingController _contactController = TextEditingController();

  bool _isLoading = false;
  File? _selectedImage;
  final ImagePicker _picker = ImagePicker();

  Future<void> _pickImage(ImageSource source) async {
    try {
      final pickedFile = await _picker.pickImage(
        source: source,
        imageQuality: 50,
        maxWidth: 800,
        maxHeight: 800,
      );
      if (pickedFile != null) {
        setState(() {
          _selectedImage = File(pickedFile.path);
        });
      }
    } catch (e) {
      print("Image picking failed: $e");
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("Failed to pick image")));
    }
  }

  Future<String?> _uploadImage(String uid) async {
    try {
      if (_selectedImage == null) return null;
      final fileName = path.basename(_selectedImage!.path);
      final ref = FirebaseStorage.instance.ref().child(
        'profile_pics/$uid/$fileName',
      );
      final uploadTask = await ref.putFile(_selectedImage!);
      return await uploadTask.ref.getDownloadURL();
    } catch (e) {
      print("Image upload failed: $e");
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("Image upload failed")));
      return null;
    }
  }

  Future<void> _storeOfflineProfile(Map<String, dynamic> data) async {
    final box = await Hive.openBox('user_profiles');
    await box.put('profile', data);
  }

  Widget _buildCardField({
    required String label,
    required TextEditingController controller,
    required IconData icon,
    bool obscureText = false,
    TextInputType keyboardType = TextInputType.text,
  }) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: TextField(
          controller: controller,
          obscureText: obscureText,
          keyboardType: keyboardType,
          decoration: InputDecoration(
            labelText: label,
            prefixIcon: Icon(icon),
            border: InputBorder.none,
          ),
        ),
      ),
    );
  }

  Widget _buildProfilePictureCard() {
    return GestureDetector(
      onTap: _showImageSourceOptions,
      child: Card(
        elevation: 4,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Container(
          height: 150,
          width: double.infinity,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            image:
                _selectedImage != null
                    ? DecorationImage(
                      image: FileImage(_selectedImage!),
                      fit: BoxFit.cover,
                    )
                    : null,
            color: Colors.grey.shade200,
          ),
          child:
              _selectedImage == null
                  ? const Center(
                    child: Icon(Icons.camera_alt, size: 50, color: Colors.grey),
                  )
                  : null,
        ),
      ),
    );
  }

  void _showImageSourceOptions() {
    showModalBottomSheet(
      context: context,
      builder: (context) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera),
              title: const Text('Take Photo'),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Choose from Gallery'),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.gallery);
              },
            ),
          ],
        );
      },
    );
  }

  Future<void> _register() async {
    setState(() => _isLoading = true);

    final user = await AuthService().registerUser(
      _emailController.text.trim(),
      _passwordController.text.trim(),
    );

    if (user != null) {
      final uid = user.uid;
      final photoUrl = await _uploadImage(uid);

      final profileData = {
        'email': _emailController.text.trim(),
        'organisation': _organisationController.text.trim(),
        'contact': _contactController.text.trim(),
        'photoUrl': photoUrl ?? '',
      };

      await FirebaseFirestore.instance
          .collection('users')
          .doc(uid)
          .set(profileData);
      await _storeOfflineProfile(profileData);
      Navigator.pushReplacementNamed(context, AppRoutes.profileHome);
    } else {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Registration failed')));
    }

    setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    return BackgroundScaffold(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text("User Registration"),
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
              _buildProfilePictureCard(),
              _buildCardField(
                label: "Email",
                controller: _emailController,
                icon: Icons.email,
                keyboardType: TextInputType.emailAddress,
              ),
              _buildCardField(
                label: "Password",
                controller: _passwordController,
                icon: Icons.lock,
                obscureText: true,
              ),
              _buildCardField(
                label: "Organisation",
                controller: _organisationController,
                icon: Icons.business,
              ),
              _buildCardField(
                label: "Contact Number",
                controller: _contactController,
                icon: Icons.phone,
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 24),
              _isLoading
                  ? const CircularProgressIndicator()
                  : ElevatedButton(
                    onPressed: _register,
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 50),
                      backgroundColor: themeGradientEnd,
                      foregroundColor: Colors.white,
                    ),
                    child: const Text("Register"),
                  ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}
