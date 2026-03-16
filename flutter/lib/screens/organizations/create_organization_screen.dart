import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../services/organization_service.dart';

class CreateOrganizationScreen extends StatefulWidget {
  const CreateOrganizationScreen({super.key});

  @override
  State<CreateOrganizationScreen> createState() => _CreateOrganizationScreenState();
}

class _CreateOrganizationScreenState extends State<CreateOrganizationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _bioCtrl = TextEditingController();
  final _websiteCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  XFile? _bgImage;
  XFile? _logoImage;
  bool _saving = false;
  String? _error;

  Future<void> _pickImage({required bool logo}) async {
    final picker = ImagePicker();
    final x = await picker.pickImage(source: ImageSource.gallery, maxWidth: 2000);
    if (x == null) return;
    setState(() {
      if (logo) {
        _logoImage = x;
      } else {
        _bgImage = x;
      }
    });
  }

  Future<String?> _uploadToStorage(XFile file, String path) async {
    try {
      final ref = FirebaseStorage.instance.ref().child(path);
      final bytes = await file.readAsBytes();
      final ext = file.name.split('.').last.toLowerCase();
      await ref.putData(bytes, SettableMetadata(contentType: 'image/$ext'));
      return await ref.getDownloadURL();
    } catch (_) { return null; }
  }

  Future<void> _submit() async {
    if (_saving) return;
    if (!_formKey.currentState!.validate()) return;
    setState(() { _saving = true; _error = null; });
    try {
      // First, create the org document to get its ID
      final orgRef = await OrganizationService.instance.createOrganizationProfile(
        name: _nameCtrl.text.trim(),
        bio: _bioCtrl.text.trim().isEmpty ? null : _bioCtrl.text.trim(),
        website: _websiteCtrl.text.trim().isEmpty ? null : _websiteCtrl.text.trim(),
        contactEmail: _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
        contactNumber: _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
      );
      // If we have images, upload them to their final paths under organizations/{orgId}/...
      String? bgUrl;
      String? logoUrl;
      if (_bgImage != null) {
        bgUrl = await _uploadToStorage(
          _bgImage!,
          'organizations/${orgRef.id}/background_${_bgImage!.name}',
        );
      }
      if (_logoImage != null) {
        logoUrl = await _uploadToStorage(
          _logoImage!,
          'organizations/${orgRef.id}/logo_${_logoImage!.name}',
        );
      }
      if (bgUrl != null || logoUrl != null) {
        await orgRef.update({
          if (bgUrl != null) 'coverPhotoUrl': bgUrl,
          if (logoUrl != null) 'logoUrl': logoUrl,
          'updatedAt': FieldValue.serverTimestamp(),
        });
      }
      // Return to previous screen
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      if (mounted) setState(() { _saving = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create Organization')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextFormField(
                controller: _nameCtrl,
                decoration: const InputDecoration(labelText: 'Organization name'),
                validator: (v) => (v==null || v.trim().isEmpty) ? 'Name required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _bioCtrl,
                minLines: 2,
                maxLines: 5,
                decoration: const InputDecoration(labelText: 'Bio'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _websiteCtrl,
                decoration: const InputDecoration(labelText: 'Website (optional)', hintText: 'https://example.org'),
                keyboardType: TextInputType.url,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _emailCtrl,
                decoration: const InputDecoration(labelText: 'Contact email (optional)'),
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phoneCtrl,
                decoration: const InputDecoration(labelText: 'Contact number (optional)'),
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _saving ? null : () => _pickImage(logo: false),
                      icon: const Icon(Icons.image),
                      label: Text(_bgImage == null ? 'Choose background image' : 'Change background image'),
                    ),
                  ),
                ],
              ),
              if (_bgImage != null) Padding(
                padding: const EdgeInsets.only(top: 8),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.file(File(_bgImage!.path), height: 140, fit: BoxFit.cover),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _saving ? null : () => _pickImage(logo: true),
                      icon: const Icon(Icons.image_outlined),
                      label: Text(_logoImage == null ? 'Choose logo' : 'Change logo'),
                    ),
                  ),
                ],
              ),
              if (_logoImage != null) Padding(
                padding: const EdgeInsets.only(top: 8),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.file(File(_logoImage!.path), height: 80, width: 80, fit: BoxFit.cover),
                ),
              ),
              const SizedBox(height: 20),
              if (_error != null) Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _saving ? null : _submit,
                  child: _saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Create'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
