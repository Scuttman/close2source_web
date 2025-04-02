import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../imports.dart';

class ProfileHomeScreen extends StatelessWidget {
  const ProfileHomeScreen({super.key});

  Future<Map<String, dynamic>?> _getCurrentUserData() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return null;

    final doc =
        await FirebaseFirestore.instance
            .collection('UserProfiles')
            .doc(uid)
            .get();
    return doc.data();
  }

  void _navigateToDashboard(BuildContext context) {
    print("📌 Navigating to Dashboard...");
    Navigator.pushReplacementNamed(context, AppRoutes.dashboard);
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        BackgroundScaffold(
          child: Scaffold(
            backgroundColor: Colors.transparent,
            appBar: AppBar(
              title: const Text(
                'Select User Profile',
                style: TextStyle(color: Colors.deepOrange), // Deep orange title
              ),
              backgroundColor: Colors.black,
              actions: [
                IconButton(
                  icon: const Icon(Icons.logout),
                  color: Colors.deepOrange, // Logout icon in deep orange
                  onPressed: () {
                    FirebaseAuth.instance.signOut();
                    Navigator.pushReplacementNamed(
                      context,
                      AppRoutes.login,
                    ); // Redirect to login screen after logout
                  },
                ),
              ],
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

                    return Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Card(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 4,
                        color: Colors.white, // Card color set to white
                        child: ListTile(
                          leading: CircleAvatar(
                            radius: 30,
                            backgroundColor: Colors.grey.shade300,
                            backgroundImage:
                                photoUrl != null
                                    ? NetworkImage(photoUrl)
                                    : null,
                            child:
                                photoUrl == null
                                    ? const Icon(
                                      Icons.person,
                                      size: 30,
                                      color: Colors.deepOrange,
                                    )
                                    : null,
                          ),
                          title: Text(
                            displayName,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.black,
                            ),
                          ),
                          subtitle: Text(
                            email,
                            style: const TextStyle(color: Colors.deepOrange),
                          ),
                          trailing: const Icon(
                            Icons.verified_user,
                            color: Colors.green,
                          ),
                          onTap: () => _navigateToDashboard(context),
                        ),
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
                        return const Center(
                          child: Text(
                            'No users found',
                            style: TextStyle(color: Colors.white70),
                          ),
                        );
                      }

                      final users = snapshot.data!.docs;

                      return ListView.builder(
                        itemCount: users.length,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        itemBuilder: (context, index) {
                          final user = users[index];
                          final userData = user.data() as Map<String, dynamic>;
                          final displayName =
                              userData['displayName'] ?? 'Unnamed User';
                          final email =
                              userData['email'] ?? 'No email provided';
                          final photoUrl = userData['photoUrl'] as String?;

                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            child: Card(
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              elevation: 6,
                              color: Colors.white, // Card color set to white
                              child: InkWell(
                                borderRadius: BorderRadius.circular(12),
                                onTap: () => _navigateToDashboard(context),
                                child: ListTile(
                                  leading: CircleAvatar(
                                    radius: 30,
                                    backgroundColor: Colors.grey.shade300,
                                    backgroundImage:
                                        photoUrl != null
                                            ? NetworkImage(photoUrl)
                                            : null,
                                    child:
                                        photoUrl == null
                                            ? const Icon(
                                              Icons.person,
                                              size: 30,
                                              color: Colors.deepOrange,
                                            )
                                            : null,
                                  ),
                                  title: Text(
                                    displayName,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: Colors.black,
                                    ),
                                  ),
                                  subtitle: Text(
                                    email,
                                    style: const TextStyle(
                                      color: Colors.deepOrange,
                                    ),
                                  ),
                                  trailing: const Icon(
                                    Icons.arrow_forward_ios,
                                    color: Colors.black,
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
