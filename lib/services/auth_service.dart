import 'dart:io';

import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  //------------------------------------------------------------------------------
  // 🔹 Listen to Auth State & Redirect
  //------------------------------------------------------------------------------

  void handleAuthState(BuildContext context) {
    _auth.authStateChanges().listen((User? user) {
      if (!context.mounted) return;

      if (user != null) {
        Navigator.pushReplacementNamed(context, '/dashboard');
      } else {
        Navigator.pushReplacementNamed(context, '/login');
      }
    });
  }

  //------------------------------------------------------------------------------
  // 🔹 Sign In User
  //------------------------------------------------------------------------------

  Future<void> signIn(
    String email,
    String password,
    BuildContext context,
  ) async {
    try {
      await _auth.signInWithEmailAndPassword(email: email, password: password);
      if (!context.mounted) return;
      Navigator.pushReplacementNamed(context, '/dashboard');
    } on FirebaseAuthException catch (e) {
      _showError(context, e.message ?? "Login failed. Try again.");
    }
  }

  //------------------------------------------------------------------------------
  // 🔹 Register User and Save Profile + Upload Image
  //------------------------------------------------------------------------------

  Future<void> registerUser({
    required String name,
    required String organization,
    required String contact,
    required String email,
    required String password,
    required File? profileImage,
    required BuildContext context,
  }) async {
    try {
      final UserCredential userCred = await _auth
          .createUserWithEmailAndPassword(email: email, password: password);

      final uid = userCred.user?.uid;
      if (uid == null) {
        throw FirebaseAuthException(
          code: 'uid-null',
          message: 'User ID is missing',
        );
      }

      String? profileImageUrl;

      // 🔸 Upload Profile Picture if provided
      if (profileImage != null) {
        final ref = FirebaseStorage.instance.ref().child(
          'profile_images/$uid.jpg',
        );
        await ref.putFile(profileImage);
        profileImageUrl = await ref.getDownloadURL();
      }

      // 🔥 Save profile to Firestore
      await FirebaseFirestore.instance.collection('Users').doc(uid).set({
        'uid': uid,
        'name': name,
        'organization': organization,
        'contact': contact,
        'email': email,
        'role': 'admin', // default role
        'profileImageUrl': profileImageUrl,
        'createdAt': FieldValue.serverTimestamp(),
      });

      if (!context.mounted) return;
      Navigator.pushReplacementNamed(context, '/dashboard');
    } on FirebaseAuthException catch (e) {
      _showError(context, e.message ?? "Registration failed. Try again.");
    } catch (e) {
      _showError(context, "Something went wrong. Please try again.");
    }
  }

  //------------------------------------------------------------------------------
  // 🔹 Sign Out User
  //------------------------------------------------------------------------------

  Future<void> signOut(BuildContext context) async {
    await _auth.signOut();
    if (!context.mounted) return;
    Navigator.pushReplacementNamed(context, '/login');
  }

  //------------------------------------------------------------------------------
  // 🔹 Show Error Message
  //------------------------------------------------------------------------------

  void _showError(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(color: Colors.white)),
        backgroundColor: Colors.red,
      ),
    );
  }
}
