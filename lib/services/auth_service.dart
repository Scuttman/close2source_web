import '../imports.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  /// Check if the user is currently authenticated
  Future<bool> handleAuthState(BuildContext context) async {
    final user = _auth.currentUser;
    return user != null;
  }

  /// Listen continuously to auth state changes (optional helper)
  void authStateListener(BuildContext context) {
    _auth.authStateChanges().listen((User? user) {
      if (user == null) {
        Navigator.pushReplacementNamed(context, AppRoutes.login);
      } else {
        Navigator.pushReplacementNamed(context, AppRoutes.profileHome);
      }
    });
  }

  /// Method to sign in with email/password
  Future<User?> signIn(String email, String password) async {
    try {
      UserCredential userCredential = await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
      return userCredential.user;
    } on FirebaseAuthException catch (e) {
      debugPrint('❌ Sign-in error: ${e.message}');
      return null;
    }
  }

  /// Method to register a new user
  Future<User?> registerUser(String email, String password) async {
    try {
      UserCredential userCredential = await _auth
          .createUserWithEmailAndPassword(email: email, password: password);
      return userCredential.user;
    } on FirebaseAuthException catch (e) {
      debugPrint('❌ Registration error: ${e.message}');
      return null;
    }
  }

  /// Method to sign out
  Future<void> signOut() async {
    await _auth.signOut();
  }
}
