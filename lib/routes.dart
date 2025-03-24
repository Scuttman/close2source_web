import 'package:flutter/material.dart';
import 'package:close2source/screens/authentication/user_registration_form.dart';
import 'package:close2source/screens/dashboard/dashboard_screen.dart';
import 'package:close2source/screens/authentication/login_screen.dart';
import 'package:close2source/screens/dashboard/spending_tab/spending_form_screen.dart'; // ✅ Add this

class AppRoutes {
  static const String login = '/login';
  static const String dashboard = '/dashboard';
  static const String register = '/register';
  static const String spendingForm = '/spending-form'; // ✅ Add route name

  static Route<dynamic> generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case login:
        return MaterialPageRoute(builder: (_) => const LoginScreen());
      case dashboard:
        return MaterialPageRoute(builder: (_) => const DashboardScreen());
      case register:
        return MaterialPageRoute(builder: (_) => const UserRegistrationForm());
      case spendingForm:
        return MaterialPageRoute(
          builder: (_) => const SpendingFormScreen(),
        ); // ✅ Add this
      default:
        return MaterialPageRoute(
          builder:
              (_) => Scaffold(
                body: Center(child: Text('Route not found: ${settings.name}')),
              ),
        );
    }
  }
}
