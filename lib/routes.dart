import 'package:flutter/material.dart';
import 'package:close2source/screens/authentication/user_registration_form.dart';
import 'package:close2source/screens/dashboard/dashboard_screen.dart';
import 'package:close2source/screens/authentication/login_screen.dart';
import 'package:close2source/screens/dashboard/reports_tab/report_form_screen.dart';
import 'package:close2source/screens/profile_home/profile_home.dart'; // ✅ Added this import
class AppRoutes {
  static const String login = '/login';
  static const String dashboard = '/dashboard';
  static const String register = '/register';
  static const String spendingForm = '/spending_form';
  static const String reportForm = '/report_form'; // ✅ Corrected to include type
  static const String profileHome = '/profile_home'; // ✅ Newly added

  static Route<dynamic> generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case login:
        return MaterialPageRoute(builder: (_) => const LoginScreen());
      case dashboard:
      // Expecting a profileCode to be passed as the argument.
        final String profileCode = settings.arguments as String? ?? '';
        return MaterialPageRoute(
            builder: (_) => DashboardScreen(profileCode: profileCode));
      case register:
        return MaterialPageRoute(builder: (_) => const UserRegistrationForm());

      case reportForm:
        return MaterialPageRoute(builder: (_) => const ReportFormScreen());
      case profileHome:
        return MaterialPageRoute(builder: (_) => const ProfileHomeScreen());
      default:
        return MaterialPageRoute(
          builder: (_) => Scaffold(
            body: Center(child: Text('Route not found: ${settings.name}')),
          ),
        );
    }
  }
}