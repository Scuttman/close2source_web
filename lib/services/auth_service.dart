import '../imports.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  //----------------------------------------------------------------------------
  // Manage Auth Navigation
  //----------------------------------------------------------------------------

  /// **🔹 Listen to Auth State & Redirect**
  void handleAuthState(BuildContext context) {
    _auth.authStateChanges().listen((User? user) {
      if (!context.mounted) return; // Ensure context is mounted before navigation

      if (user != null) {
        Navigator.pushReplacementNamed(context, '/dashboard');
      } else {
        Navigator.pushReplacementNamed(context, '/login');
      }
    });
  }

  //----------------------------------------------------------------------------
  // Sign In function
  //----------------------------------------------------------------------------

  /// **🔹 Sign In User**
  Future<void> signIn(String email, String password, BuildContext context) async {
    try {
      await _auth.signInWithEmailAndPassword(email: email, password: password);

      if (!context.mounted) return;

      /// Navigate explicitly to dashboard after login
      Navigator.pushReplacementNamed(context, '/dashboard');
    } on FirebaseAuthException catch (e) {
      _showError(context, e.message ?? "Login failed. Try again.");
    }
  }

  //----------------------------------------------------------------------------
  // Sign Out and return to Login
  //----------------------------------------------------------------------------

  Future<void> signOut(BuildContext context) async {
    await _auth.signOut();
    if (!context.mounted) return;

    /// Explicitly navigate to login screen after signing out
    Navigator.pushReplacementNamed(context, '/login');
  }

  /// **🔹 Show Error Message**
  void _showError(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message, style: TextStyle(color: Colors.white)), backgroundColor: Colors.red),
    );
  }
}