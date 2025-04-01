import '../../imports.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:uuid/uuid.dart';

class DashboardScreen extends StatefulWidget {

  final String profileCode;
  const DashboardScreen({super.key, required this.profileCode});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  Profile? _profileData;
  bool _loadingProfile = true;

  Future<void> _loadProfileData() async {
    // Use the offline-first repository to retrieve the profile data for the given profileCode.
    final Profile data = await ProfileRepository().getProfileByCode(widget.profileCode) as Profile;
    setState(() {
      _profileData = data;
      _loadingProfile = false;
    });
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  //  createDemoProject();
    _loadProfileData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
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

            body: Column(
              children: [
               if(_profileData != null)
                 Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      HomeTabScreen(projectData: _profileData as Profile,),
                      ReportsTabScreen(projectData: _profileData as Profile,),
                      SpendingTabScreen(projectData: _profileData as Profile,),
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
        topLeft: Radius.circular(0),
        topRight: Radius.circular(0),
      ),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [themeGradientStart, themeGradientEnd],
          ),
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(0),
            topRight: Radius.circular(0),
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



  Future<void> createDemoProject() async {
    // Get the current user.
    final User? currentUser = FirebaseAuth.instance.currentUser;
    if (currentUser == null) {
      print("No user is currently logged in.");
      return;
    }

    // Generate a unique project ID.
    final String projectId = Uuid().v4();

    // Optionally, generate a project code (here we simply prepend "EPC" to a random string).
    // You can customize this function as needed.
    String generateProjectCode() {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      final random = Uuid().v4().substring(0, 6).toUpperCase();
      return 'EPC$random';
    }

    final String projectCode = generateProjectCode();

    // Create a new Project instance with demo details.
    final demoProject = Project(
      projectId: projectId,
      projectCode: projectCode,
      projectName: "Evolution Power Centre",
      projectDesc:
      "A vocational training college in the village of Chiwaya which will provide training to students after they complete primary education at Thanthwe.",
      projectOwner: currentUser.uid,
      projectSponsor: "None", // You can update this if needed.
      projectBudget: 1000000.0, // Demo budget value.
      projectBalance: "0",
      projectCurrency: "USD",
      projectStartDate: Timestamp.fromDate(DateTime.now()),
      creationDate: Timestamp.fromDate(DateTime.now()),
      lastUpdated: Timestamp.fromDate(DateTime.now()),
      createdBy: currentUser.uid,
      expiryDate: Timestamp.fromDate(DateTime.now().add(const Duration(days: 365))),
      status: "active",
      reportList: [],
      transactionList: [],
      photoList: [],
      profileUsersIds: [currentUser.uid],
      profileUsers: [
        {
          "email": "chris@cjsconsultingservices.com",
          "role": "owner",
          "uid": currentUser.uid,
        }
      ],
    );

    // Save the project to Firestore in the "Projects" collection.
    await FirebaseFirestore.instance
        .collection('Profiles')
        .doc(projectId)
        .set(demoProject.toJson());

    print("Demo project created successfully with ID: $projectId");
  }
}
