import '../../imports.dart';
import 'spending_tab/spending_tab_screen.dart';
import 'package:flutter/material.dart';
import 'home_tab/home_tab_screen.dart';
import 'reports_tab/reports_tab_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final bool _isLoading = true;

  @override
  void initState() {
    // TODO: implement initState
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
    return  Stack(
      children: [
      Container(
      width: sw,
      height: sh,
      decoration: BoxDecoration(
        image: DecorationImage(
          image: AssetImage('assets/sitebg.jpg'),
          fit: BoxFit.cover,
        ),
      ),
      child:Scaffold(
        backgroundColor: Colors.transparent,
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ScreenNormalAppBarWidget(title: "close2source", logOut: true),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
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
    )]
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
