import 'package:firebase_auth/firebase_auth.dart';

class AuthService {
  AuthService._();
  static final instance = AuthService._();
  final FirebaseAuth _auth = FirebaseAuth.instance;

  Stream<User?> get authStateChanges => _auth.authStateChanges();
  User? get currentUser => _auth.currentUser;

  Future<UserCredential> signIn(String email, String password) async {
    return _auth.signInWithEmailAndPassword(email: email.trim(), password: password);
  }

  Future<UserCredential> register(String email, String password) async {
    final cred = await _auth.createUserWithEmailAndPassword(email: email.trim(), password: password);
    try { await cred.user?.sendEmailVerification(); } catch (_) {}
    return cred;
  }

  Future<void> signOut() => _auth.signOut();
}
