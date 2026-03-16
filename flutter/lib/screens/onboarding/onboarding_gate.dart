import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../home_screen.dart';
import 'role_select_screen.dart';
import 'profile_setup_screen.dart';

class OnboardingGate extends StatefulWidget {
  final User user;
  const OnboardingGate({super.key, required this.user});

  @override
  State<OnboardingGate> createState() => _OnboardingGateState();
}

class _OnboardingGateState extends State<OnboardingGate> {
  bool _timeout = false;
  @override
  void initState() {
    super.initState();
    // If Firestore is slow to respond (offline/rules), show a manual continue after a short delay
    Future.delayed(const Duration(seconds: 5), (){ if(mounted) setState(()=> _timeout = true); });
  }

  @override
  Widget build(BuildContext context) {
    final users = FirebaseFirestore.instance.collection('users').doc(widget.user.uid);
    return StreamBuilder<DocumentSnapshot<Map<String,dynamic>>>(
      stream: users.snapshots(),
      builder: (context, snap){
        if(snap.hasError){
          return _FallbackScaffold(user: widget.user);
        }
        if(snap.connectionState == ConnectionState.waiting){
          if(_timeout){
            return _FallbackScaffold(user: widget.user);
          }
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        if(!snap.hasData || !snap.data!.exists){
          return RoleSelectScreen(user: widget.user);
        }
        final data = snap.data!.data() ?? {};
        final status = (data['onboardingStatus'] ?? 'role').toString();
        switch(status){
          case 'role':
            return RoleSelectScreen(user: widget.user);
          case 'profile':
            return ProfileSetupScreen(user: widget.user, role: (data['role'] ?? 'donor').toString());
          case 'done':
          default:
            return HomeScreen(user: widget.user);
        }
      },
    );
  }
}

class _FallbackScaffold extends StatelessWidget {
  final User user;
  const _FallbackScaffold({required this.user});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Getting ready')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("We couldn't load your profile yet.", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            const Text('You can continue with setup now.'),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_)=> RoleSelectScreen(user: user)),
                ),
                child: const Text('Continue to setup'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
