import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;
  bool _registerMode = false;

  Future<void> _submit() async {
    setState(() { _busy = true; _error = null; });
    try {
      if (_registerMode) {
        await AuthService.instance.register(_email.text, _password.text);
      } else {
        await AuthService.instance.signIn(_email.text, _password.text);
      }
    } on FirebaseAuthException catch (e) {
      setState(() { _error = e.message; });
    } catch (_) {
      setState(() { _error = 'Authentication failed'; });
    } finally {
      if (mounted) setState(() { _busy = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background image
          Image.asset(
            'assets/images/sitebg.jpg',
            fit: BoxFit.cover,
            alignment: Alignment.center,
            color: Colors.black.withValues(alpha: 0.35),
            colorBlendMode: BlendMode.darken,
          ),
          // Gradient overlay similar to web (top darker fade)
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0xAA000000),
                  Color(0x33000000),
                ],
              ),
            ),
          ),
          // Content (scrollable to avoid keyboard overflow)
          SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final bottomInset = MediaQuery.of(context).viewInsets.bottom;
                return SingleChildScrollView(
                  padding: EdgeInsets.only(bottom: bottomInset + 32),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: constraints.maxHeight - bottomInset,
                      maxWidth: 520,
                    ),
                    child: Align(
                      alignment: Alignment.topCenter,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'close2source',
                              textAlign: TextAlign.left,
                              style: Theme.of(context).textTheme.displaySmall?.copyWith(
                                    fontWeight: FontWeight.w200,
                                    color: Colors.white,
                                    letterSpacing: -1.5,
                                  ),
                            ),
                            const SizedBox(height: 40),
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 250),
                              padding: const EdgeInsets.all(28),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.03),
                                borderRadius: BorderRadius.circular(22),
                                border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.4),
                                    blurRadius: 24,
                                    offset: const Offset(0, 18),
                                  ),
                                ],
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    _registerMode ? 'Create account' : 'Sign in',
                                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                          fontWeight: FontWeight.w600,
                                          letterSpacing: -0.5,
                                        ),
                                  ),
                                  const SizedBox(height: 20),
                                  TextField(
                                    controller: _email,
                                    enabled: !_busy,
                                    keyboardType: TextInputType.emailAddress,
                                    decoration: const InputDecoration(labelText: 'Email'),
                                  ),
                                  const SizedBox(height: 14),
                                  TextField(
                                    controller: _password,
                                    enabled: !_busy,
                                    obscureText: true,
                                    decoration: const InputDecoration(labelText: 'Password'),
                                  ),
                                  const SizedBox(height: 18),
                                  if (_error != null)
                                    Padding(
                                      padding: const EdgeInsets.only(bottom: 6),
                                      child: Text(
                                        _error!,
                                        style: const TextStyle(color: Colors.redAccent, fontSize: 12),
                                      ),
                                    ),
                                  FilledButton(
                                    onPressed: _busy ? null : _submit,
                                    child: _busy
                                        ? const SizedBox(
                                            height: 18,
                                            width: 18,
                                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                          )
                                        : Text(_registerMode ? 'Create Account' : 'Sign In'),
                                  ),
                                  const SizedBox(height: 4),
                                  TextButton(
                                    onPressed: _busy ? null : () => setState(() => _registerMode = !_registerMode),
                                    child: Text(
                                      _registerMode ? 'Have an account? Sign In' : 'Need an account? Register',
                                      style: const TextStyle(fontWeight: FontWeight.w500),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
