import '../../imports.dart';
import '../../routes.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  String? _email;
  String? _password;
  bool _obscurePassword = true;

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.of(context).size;

    return Container(
      width: screen.width,
      height: screen.height,
      decoration: const BoxDecoration(
        image: DecorationImage(
          image: AssetImage('assets/sitebg.jpg'),
          fit: BoxFit.cover,
        ),
      ),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Form(
              key: _formKey,
              child: Column(
                children: [
                  const Text(
                    'Welcome to',
                    style: TextStyle(color: Colors.white, fontSize: 20.0),
                  ),
                  Text(
                    'close2source',
                    style: GoogleFonts.amaticSc(
                      textStyle: const TextStyle(
                        color: Colors.white,
                        letterSpacing: 0.1,
                        fontSize: 60.0,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(height: 30),

                  /// 🟫 Combined Card for Email & Password
                  _buildCard(
                    Column(
                      children: [
                        TextFormField(
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(
                            labelText: "Email Address",
                            border: InputBorder.none,
                          ),
                          validator:
                              (val) =>
                                  val == null || !val.contains('@')
                                      ? "Enter a valid email"
                                      : null,
                          onSaved: (val) => _email = val,
                        ),
                        const Divider(),
                        TextFormField(
                          obscureText: _obscurePassword,
                          decoration: InputDecoration(
                            labelText: "Password",
                            border: InputBorder.none,
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility
                                    : Icons.visibility_off,
                              ),
                              onPressed: () {
                                setState(() {
                                  _obscurePassword = !_obscurePassword;
                                });
                              },
                            ),
                          ),
                          validator:
                              (val) =>
                                  val == null || val.length < 6
                                      ? "Password must be at least 6 characters"
                                      : null,
                          onSaved: (val) => _password = val,
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  /// 🟫 Login Button
                  _buildActionCard(title: "Login", onTap: _loginUser),

                  const SizedBox(height: 16),
                  const Text(
                    "Don't have an account?",
                    style: TextStyle(
                      color: Colors.white70,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 10),

                  /// 🟫 Register Button
                  _buildActionCard(
                    title: "Register here",
                    onTap:
                        () => Navigator.pushNamed(context, AppRoutes.register),
                  ),
                ],
              ),
            ),
          ),
        ),
        bottomNavigationBar: _bottomBar(),
      ),
    );
  }

  Widget _buildCard(Widget child) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8),
      elevation: 3,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: Colors.white.withOpacity(0.95),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: child,
      ),
    );
  }

  Widget _buildActionCard({
    required String title,
    required VoidCallback onTap,
  }) {
    return FractionallySizedBox(
      widthFactor: 0.50,
      child: GestureDetector(
        onTap: onTap,
        child: Card(
          elevation: 4,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          color: Colors.white.withOpacity(0.9),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            child: Center(
              child: Text(
                title,
                style: const TextStyle(
                  color: Colors.brown,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _bottomBar() {
    return Material(
      color: Colors.transparent, // 👈 Transparent material
      elevation: 0, // Optional: remove shadow if not needed
      child: Container(
        height: 60,
        alignment: Alignment.center,
        child: const Text(
          '© Close2Source',
          style: TextStyle(color: Colors.deepOrange),
        ),
      ),
    );
  }

  void _loginUser() {
    if (_formKey.currentState?.validate() ?? false) {
      _formKey.currentState?.save();
      if (_email != null && _password != null) {
        AuthService().signIn(_email!, _password!, context);
      }
    }
  }
}
