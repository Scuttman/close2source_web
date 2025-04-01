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
            appBar: AppBar(
              backgroundColor: themeGradientStart, // Set background color
              title: const Text("close2source"),
              flexibleSpace: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [themeGradientStart, themeGradientEnd],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
              ),
              leading: IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () {
                  Navigator.pushReplacementNamed(
                    context,
                    AppRoutes.profileHome,
                  );
                },
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
