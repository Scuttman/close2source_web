import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../imports.dart';

class ProfileHomeScreen extends StatelessWidget {
  const ProfileHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Select User Profile'),
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
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance.collection('users').snapshots(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
            return const Center(child: Text('No users found'));
          }

          final users = snapshot.data!.docs;

          return ListView.builder(
            itemCount: users.length,
            itemBuilder: (context, index) {
              final user = users[index];
              final userData = user.data() as Map<String, dynamic>;
              final displayName = userData['displayName'] ?? 'Unnamed User';
              final email = userData['email'] ?? 'No email provided';
              final photoUrl = userData['photoUrl'] as String?;

              return ListTile(
                leading: CircleAvatar(
                  backgroundImage:
                      photoUrl != null ? NetworkImage(photoUrl) : null,
                  child: photoUrl == null ? const Icon(Icons.person) : null,
                ),
                title: Text(displayName),
                subtitle: Text(email),
                onTap: () {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (_) => const DashboardScreen()),
                  );
                },
              );
            },
          );
        },
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
            colors: [themeGradientStart, themeGradientEnd],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
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
