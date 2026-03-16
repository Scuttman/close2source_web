import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../services/auth_service.dart';

class OrganizationsHome extends StatelessWidget {
  final User user;
  const OrganizationsHome({super.key, required this.user});

  Stream<QuerySnapshot<Map<String, dynamic>>> _orgsStream() {
    return FirebaseFirestore.instance
        .collection('organizations')
        .where('ownerUid', isEqualTo: user.uid)
        .limit(25)
        .snapshots();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Your Organizations'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => AuthService.instance.signOut(),
            tooltip: 'Sign out',
          )
        ],
      ),
      body: Column(
        children: [
          StreamBuilder<ConnectivityResult>(
            stream: Connectivity()
                .onConnectivityChanged
                .map((results) => results.isNotEmpty ? results.last : ConnectivityResult.none)
                .distinct(),
            builder: (context, snap) {
              final offline = snap.data == ConnectivityResult.none;
              if (offline) {
                return Container(
                  width: double.infinity,
                  color: Colors.amber.shade700,
                  padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
                  child: const Text(
                    'Offline – showing cached data',
                    style: TextStyle(color: Colors.white, fontSize: 12),
                  ),
                );
              }
              return const SizedBox.shrink();
            },
          ),
          Expanded(
            child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: _orgsStream(),
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snap.hasError) {
                  return Center(
                    child: Text(
                      'Error: ${snap.error}',
                      style: const TextStyle(color: Colors.red),
                    ),
                  );
                }
                final docs = snap.data?.docs ?? [];
                if (docs.isEmpty) {
                  return const Center(child: Text('No organizations yet.'));
                }
                return ListView.separated(
                  itemCount: docs.length,
                  separatorBuilder: (_, __) => const Divider(height: 0),
                  itemBuilder: (context, i) {
                    final d = docs[i].data();
                    return ListTile(
                      title: Text(d['name'] ?? '(Unnamed)'),
                      subtitle: Text(d['orgId'] ?? docs[i].id),
                      leading: CircleAvatar(
                        backgroundColor: const Color(0xFFFF6A1A),
                        child: Text(
                          (d['name'] ?? '?').toString().substring(0, 1).toUpperCase(),
                        ),
                      ),
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => OrganizationDetailScreen(
                              data: d,
                              id: docs[i].id,
                            ),
                          ),
                        );
                      },
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class OrganizationDetailScreen extends StatelessWidget {
  final Map<String, dynamic> data;
  final String id;
  const OrganizationDetailScreen({super.key, required this.data, required this.id});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(data['name'] ?? 'Organization')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Org Code: ${data['orgId'] ?? id}',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            if (data['bio'] != null) Text(data['bio']),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () {},
              child: const Text('View Projects (TODO)'),
            ),
          ],
        ),
      ),
    );
  }
}
