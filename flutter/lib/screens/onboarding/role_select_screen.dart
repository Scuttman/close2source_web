import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'profile_setup_screen.dart';

class RoleSelectScreen extends StatefulWidget {
  final User user;
  const RoleSelectScreen({super.key, required this.user});
  @override
  State<RoleSelectScreen> createState() => _RoleSelectScreenState();
}

class _RoleSelectScreenState extends State<RoleSelectScreen> {
  String? _role; // donor | individual | staff | business
  bool _saving = false;
  String? _error;

  Future<void> _continue() async {
    if(_role == null) { setState(()=> _error = 'Please select a role'); return; }
    setState(()=> _saving = true);
    try {
      final users = FirebaseFirestore.instance.collection('users').doc(widget.user.uid);
      await users.set({
        'uid': widget.user.uid,
        'email': widget.user.email,
        'role': _role,
        'onboardingStatus': 'profile',
        'createdAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true)).timeout(const Duration(seconds: 10));
      if(mounted){ Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_)=> ProfileSetupScreen(user: widget.user, role: _role!))); }
    } catch (e) {
      setState(()=> _error = 'Failed to save selection. Please check your connection and try again.');
    } finally {
      if(mounted) setState(()=> _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Welcome')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('I am a...', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
            const SizedBox(height: 14),
            _roleTile('donor', 'Donor', 'Follow the work you support'),
            _roleTile('individual', 'Individual', 'Share your work and updates'),
            _roleTile('business', 'Small Business', 'Showcase your business impact'),
            _roleTile('staff', 'Project Staff', 'Post updates for projects'),
            if(_error != null) Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saving? null : _continue,
                child: _saving? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Continue'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _roleTile(String key, String title, String subtitle){
    final selected = _role == key;
    return Card(
      child: ListTile(
        onTap: ()=> setState(()=> _role = key),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle),
        trailing: selected? const Icon(Icons.radio_button_checked) : const Icon(Icons.radio_button_off),
      ),
    );
  }
}

// ProfileSetupScreen is defined in profile_setup_screen.dart
