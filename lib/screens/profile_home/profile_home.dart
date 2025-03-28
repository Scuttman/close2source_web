import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../imports.dart';

class ProfileHomeScreen extends StatelessWidget {
  const ProfileHomeScreen({super.key});

  Future<Map<String, dynamic>?> _getCurrentUserData() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return null;

    final doc =
        await FirebaseFirestore.instance.collection('users').doc(uid).get();
    return doc.data();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        BackgroundScaffold(
          child: Scaffold(
            backgroundColor: Colors.transparent,
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
            body: Column(
              children: [
                FutureBuilder<Map<String, dynamic>?>(
                  future: _getCurrentUserData(),
                  builder: (context, snapshot) {
                    if (!snapshot.hasData) return const SizedBox.shrink();

                    final userData = snapshot.data!;
                    final displayName =
                        userData['displayName'] ?? 'Unnamed User';
                    final email = userData['email'] ?? 'No email';
                    final photoUrl = userData['photoUrl'] as String?;

                    return ListTile(
                      tileColor: Colors.white.withOpacity(0.1),
                      leading: CircleAvatar(
                        radius: 30,
                        backgroundImage:
                            photoUrl != null ? NetworkImage(photoUrl) : null,
                        child:
                            photoUrl == null ? const Icon(Icons.person) : null,
                      ),
                      title: Text(
                        displayName,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Text(email),
                      trailing: const Icon(
                        Icons.verified_user,
                        color: Colors.green,
                      ),
                    );
                  },
                ),
                const Divider(
                  color: Colors.white38,
                  thickness: 1,
                  indent: 16,
                  endIndent: 16,
                ),
                const SizedBox(height: 10),
                Expanded(
                  child: StreamBuilder<QuerySnapshot>(
                    stream:
                        FirebaseFirestore.instance
                            .collection('users')
                            .snapshots(),
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
                          final displayName =
                              userData['displayName'] ?? 'Unnamed User';
                          final email =
                              userData['email'] ?? 'No email provided';
                          final photoUrl = userData['photoUrl'] as String?;

                          return ListTile(
                            leading: CircleAvatar(
                              backgroundImage:
                                  photoUrl != null
                                      ? NetworkImage(photoUrl)
                                      : null,
                              child:
                                  photoUrl == null
                                      ? const Icon(Icons.person)
                                      : null,
                            ),
                            title: Text(displayName),
                            subtitle: Text(email),
                            onTap: () {
                              Navigator.pushReplacement(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const DashboardScreen(),
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
            bottomNavigationBar: const SizedBox(
              height: 60,
              child: Center(
                child: Text(
                  '© Close2Source',
                  style: TextStyle(color: Colors.deepOrange),
                ),
              ),
            ),
          ),
        ),

        // Logout Card Button (Positioned Top Right)
        Positioned(
          top: 25,
          right: 10,
          child: Card(
            color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            elevation: 6,
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () async {
                await FirebaseAuth.instance.signOut();
                Navigator.pushReplacementNamed(context, AppRoutes.login);
              },
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    Icon(Icons.logout, color: Colors.redAccent),
                    SizedBox(width: 6),
                    Text('Logout', style: TextStyle(color: Colors.redAccent)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
