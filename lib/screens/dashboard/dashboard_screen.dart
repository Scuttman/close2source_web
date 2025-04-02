import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../imports.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  // Fetch user profile data (name & photo)
  Future<Map<String, dynamic>> _getUserProfileData() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) {
      return {'displayName': 'User', 'photoUrl': null}; // Default values
    }

    final doc =
        await FirebaseFirestore.instance
            .collection('UserProfiles')
            .doc(uid)
            .get();

    final data = doc.data();
    return {
      'displayName': data?['displayName'] ?? 'Unnamed User',
      'photoUrl': data?['photoUrl'], // Can be null if no image is set
    };
  }

  @override
  Widget build(BuildContext context) {
    double sw = MediaQuery.of(context).size.width;
    double sh = MediaQuery.of(context).size.height;

    return Stack(
      children: [
        Container(
          width: sw,
          height: sh,
          decoration: const BoxDecoration(
            image: DecorationImage(
              image: AssetImage('assets/sitebg.jpg'),
              fit: BoxFit.cover,
            ),
          ),
          child: Scaffold(
            backgroundColor: Colors.transparent,
            appBar: PreferredSize(
              preferredSize: const Size.fromHeight(kToolbarHeight),
              child: AppBar(
                backgroundColor: Colors.black, // AppBar background
                title: FutureBuilder<Map<String, dynamic>>(
                  future: _getUserProfileData(),
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const CircularProgressIndicator(); // Show loading indicator
                    }

                    if (snapshot.hasError) {
                      return const Text(
                        'Error loading profile',
                        style: TextStyle(color: Colors.deepOrange),
                      );
                    }

                    // Extract user data
                    final userProfile = snapshot.data!;
                    final displayName = userProfile['displayName'];
                    final photoUrl = userProfile['photoUrl'];

                    return Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          displayName,
                          style: const TextStyle(
                            color: Colors.deepOrange,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        CircleAvatar(
                          radius: 18,
                          backgroundColor: Colors.grey.shade300,
                          backgroundImage:
                              photoUrl != null ? NetworkImage(photoUrl) : null,
                          child:
                              photoUrl == null
                                  ? const Icon(
                                    Icons.person,
                                    color: Colors.black,
                                  )
                                  : null,
                        ),
                      ],
                    );
                  },
                ),
                leading: IconButton(
                  icon: const Icon(Icons.arrow_back),
                  color: Colors.deepOrange, // Set back button color
                  onPressed: () {
                    Navigator.pushReplacementNamed(
                      context,
                      AppRoutes.profileHome,
                    );
                  },
                ),
              ),
            ),
            body: Column(
              children: [
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: const [
                      HomeTabScreen(),
                      ReportsTabScreen(),
                      SpendingTabScreen(),
                    ],
                  ),
                ),
              ],
            ),
            bottomNavigationBar: _bottomTabBar(),
          ),
        ),
      ],
    );
  }

  Widget _bottomTabBar() {
    return Material(
      elevation: 4.0,
      borderRadius: const BorderRadius.only(
        topLeft: Radius.circular(20),
        topRight: Radius.circular(20),
      ),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [themeGradientStart, themeGradientEnd],
          ),
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(20),
            topRight: Radius.circular(20),
          ),
        ),
        child: TabBar(
          controller: _tabController,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
          tabs: const [
            Tab(text: 'Home', icon: Icon(Icons.home)),
            Tab(text: 'Report', icon: Icon(Icons.menu_book)),
            Tab(text: 'Spend', icon: Icon(Icons.attach_money)),
          ],
        ),
      ),
    );
  }
}
