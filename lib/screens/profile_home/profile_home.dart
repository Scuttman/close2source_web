import 'package:cloud_firestore/cloud_firestore.dart';
import '../../imports.dart';

class ProfileHomeScreen extends StatefulWidget {
  const ProfileHomeScreen({super.key});

  @override
  State<ProfileHomeScreen> createState() => _ProfileHomeScreenState();
}

class _ProfileHomeScreenState extends State<ProfileHomeScreen> {
  Map<String, dynamic>? _userData;
  bool _loading = true;


  Future<void> _fetchUserData() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid != null) {
      final doc = await FirebaseFirestore.instance
          .collection('UserProfiles')
          .doc(uid)
          .get();
      setState(() {
        _userData = doc.data();
        _loading = false;
      });
    } else {
      setState(() {
        _loading = false;
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _fetchUserData();
  }

  Widget _buildUserTile() {
    if (_userData == null) {
      return const Center(child: Text('User data not found.'));
    }

    final String displayName = (_userData!['forename'] ?? '') +
        ' ' +
        (_userData!['surname'] ?? '');
    final String email = _userData!['email'] ?? 'No email provided';
    final String? photoUrl = _userData!['profilePicUrl'] as String?;

    return Container(
      color: Colors.white,
      constraints: BoxConstraints(minHeight: 20.0),
      child: Column(
        children: [
          SizedBox(height: 10.0,),
          ListTile(
            tileColor: Colors.white.withOpacity(0.9),
            leading: CircleAvatar(
              radius: 30,
              backgroundImage:
              photoUrl != null ? NetworkImage(photoUrl) : null,
              child: photoUrl == null ? const Icon(Icons.person) : null,
            ),
            title: Text(
              displayName,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),

            trailing: const Icon(
              Icons.verified_user,
              color: Colors.green,
            ),
            onTap: () {
              // Handle tap if needed.
            },
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: Text(email),
            )
          ],)
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        BackgroundScaffold(
          child: Scaffold(
            backgroundColor: Colors.transparent,

            body: Padding(
              padding: EdgeInsets.all(10.0),
              child: Container(
                child: Column(
                  children: [
                  Container(
                    color: Colors.deepOrange.withOpacity(0.7),
                    padding: EdgeInsets.only(left: 10.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                        'CLOSE2SOURCE',
                        style: GoogleFonts.amaticSc(
                          textStyle: TextStyle(
                            color: Colors.white,
                            letterSpacing: 0.1,
                            fontSize: 40.0,
                            fontWeight: FontWeight.bold,
                          )
                        )),
                        IconButton(
                          icon: Icon(Icons.exit_to_app, color: Colors.white, size: 30.0,),
                          onPressed: (){
                            AuthService().signOut(context);
                          },
                        )
                      ],
                    ),
                  ),
                    Expanded(
                      child: Container(
                        color: Colors.white.withOpacity(0.7),
                        child: Column(
                          children: [

                            Container(
                              height: 20.0,
                              color: Colors.black,
                            ),
                            _loading
                                ? const Center(child: CircularProgressIndicator())
                                : _buildUserTile(),
                            const Divider(
                              color: Colors.white38,
                              thickness: 1,
                              indent: 16,
                              endIndent: 16,
                            ),
                            const SizedBox(height: 10),
                            Padding(
                              padding: const EdgeInsets.only(left:15.0, right: 15.0),
                              child: Row(
                                children: [
                                  Text('My Registered Profiles', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18.0),),
                                ],
                              ),
                            ),
                            Expanded(
                              child: FutureBuilder<List<Profile>>(
                                future: ProfileRepository().getProfilesForCurrentUser(),
                                builder: (context, snapshot) {
                                  if (snapshot.connectionState == ConnectionState.waiting) {
                                    return const Center(child: CircularProgressIndicator());
                                  }

                                  if (!snapshot.hasData || snapshot.data!.isEmpty) {
                                    return const Center(child: Text('No profiles found'));
                                  }

                                  final profiles = snapshot.data!;

                                  return Padding(
                                    padding: const EdgeInsets.all(8.0),
                                    child: ListView.builder(
                                      itemCount: profiles.length,
                                      itemBuilder: (context, index) {
                                        final profile = profiles[index];
                                        return Card(
                                          child: ListTile(
                                            title: Text(profile.profileName),
                                            subtitle: Text(profile.profileType),
                                            onTap: () {

                                             Navigator.pushNamed(
                                                context,
                                                '/dashboard',
                                                arguments: profile.profileCode,
                                              );
                                            },
                                          ),
                                        );
                                      },
                                    ),
                                  );
                                },
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            bottomNavigationBar: const SizedBox(
              height: 30,
              child: Center(
                child: Padding(
                  padding: EdgeInsets.only(bottom:8.0),
                  child: Text(
                    '© CLOSE2SOURCE 2025',
                    style: TextStyle(color: Colors.deepOrange),
                  ),
                ),
              ),
            ),
          ),
        ),


      ],
    );
  }
}
