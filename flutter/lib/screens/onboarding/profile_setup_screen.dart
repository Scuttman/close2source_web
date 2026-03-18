import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';
import '../../services/image_cache_service.dart';
import '../../widgets/ai_text_field.dart';
import 'package:flutter/material.dart';

class ProfileSetupScreen extends StatefulWidget {
  final User user; final String role;
  const ProfileSetupScreen({super.key, required this.user, required this.role});
  @override
  State<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends State<ProfileSetupScreen> {
  final _name = TextEditingController();
  final _surname = TextEditingController();
  final _bio = TextEditingController();
  static const Duration _dnsTimeout = Duration(seconds: 3);
  PlatformFile? _avatar;
  File? _avatarLocal;
  bool _saving = false;

  Future<void> _pickAvatar() async {
    final res = await FilePicker.platform.pickFiles(type: FileType.image, withData: false);
    if(res != null && res.files.isNotEmpty){
      final picked = res.files.first;
      // Square-crop to 250x250 to keep size down
      final dir = await getTemporaryDirectory();
      final outPath = '${dir.path}/avatar_250_${DateTime.now().millisecondsSinceEpoch}.jpg';
      try {
        if (picked.path == null) {
          setState((){ _avatar = picked; });
          return;
        }
        final bytes = await File(picked.path!).readAsBytes();
        final decoded = img.decodeImage(bytes);
        if(decoded != null){
          const size = 250;
          // center-crop square then resize
          final minSide = decoded.width < decoded.height ? decoded.width : decoded.height;
          final x = (decoded.width - minSide) ~/ 2;
          final y = (decoded.height - minSide) ~/ 2;
          final cropped = img.copyCrop(decoded, x: x, y: y, width: minSide, height: minSide);
          final resized = img.copyResize(cropped, width: size, height: size, interpolation: img.Interpolation.cubic);
          final jpg = img.encodeJpg(resized, quality: 82);
          final file = File(outPath);
          await file.writeAsBytes(jpg, flush: true);
          setState((){ _avatar = picked; _avatarLocal = file; });
        } else {
          // fallback to compress-only
          final compressed = await FlutterImageCompress.compressAndGetFile(picked.path!, outPath, minWidth: 250, minHeight: 250, quality: 82, format: CompressFormat.jpeg);
          if(compressed != null){ setState((){ _avatar = picked; _avatarLocal = File(compressed.path); }); }
          else { setState(()=> _avatar = picked); }
        }
      } catch(_){ setState(()=> _avatar = picked); }
    }
  }

  Future<void> _save() async {
    setState(()=> _saving = true);
    String? photoUrl = widget.user.photoURL;
    if(_avatarLocal != null){
      // Try online upload; if offline, queue and save local path now
  bool online = true; try { await InternetAddress.lookup('firebase.google.com').timeout(_dnsTimeout); } catch(_){ online = false; }
      if(online){
        final avatarFile = _avatarLocal;
        final picked = _avatar;
        if (avatarFile != null && picked != null) {
          final ref = FirebaseStorage.instance.ref('users/${widget.user.uid}/avatar/${DateTime.now().millisecondsSinceEpoch}_${picked.name}');
          await ref.putFile(avatarFile, SettableMetadata(contentType: 'image/jpeg'));
          photoUrl = await ref.getDownloadURL();
          // cache mapping so we don't re-download later
          await ImageCacheService.I.cacheRemoteMapping(photoUrl, avatarFile.path);
        }
      } else {
        // store local path first; UI shows it now
        final avatarFile = _avatarLocal;
        if (avatarFile != null) {
          photoUrl = avatarFile.path;
          // enqueue avatar-specific upload for background sync
          await ImageCacheService.I.queueAvatarUpload(file: avatarFile, userId: widget.user.uid);
        }
        ImageCacheService.I.syncPending();
      }
    }
    final users = FirebaseFirestore.instance.collection('users').doc(widget.user.uid);
    await users.set({
      'name': _name.text.trim(),
      'surname': _surname.text.trim(),
      'bio': _bio.text.trim(),
      'role': widget.role,
      'photoURL': photoUrl,
      'onboardingStatus': 'done',
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
    if(mounted){ Navigator.of(context).popUntil((r)=> r.isFirst); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Set up your profile')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Tell us about yourself', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          // Square avatar picker with + overlay
          Center(
            child: InkWell(
              onTap: _saving? null : _pickAvatar,
              borderRadius: BorderRadius.circular(12),
              child: Ink(
                width: 120, height: 120,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                  image: _avatarLocal != null ? DecorationImage(image: FileImage(_avatarLocal!), fit: BoxFit.cover) : null,
                ),
                child: _avatarLocal == null ? Center(
                  child: Icon(Icons.add, size: 34, color: Colors.white.withValues(alpha: 0.85)),
                ) : null,
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'First name')),          
          const SizedBox(height: 12),
          TextField(controller: _surname, decoration: const InputDecoration(labelText: 'Surname')),          
          const SizedBox(height: 12),
          AITextField(
            controller: _bio,
            labelText: 'Short bio',
            hintText: 'Tell us about yourself...',
            maxLines: 4,
            aiContext: 'a professional bio',
          ),
          const SizedBox(height: 12),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _saving? null : _save,
              child: _saving? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Finish'),
            ),
          ),
        ],
      ),
    );
  }
}
