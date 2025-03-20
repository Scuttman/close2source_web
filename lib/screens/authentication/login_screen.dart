import '../../imports.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.of(context).size;
    double screenHeight = screen.height;
    double screenWidth = screen.width;
    return Container(
      width: screenWidth,
      height: screenHeight,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            themeGradientStart,
            themeGradientEnd,
          ],
        ),
      ),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text('Welcome to', style: TextStyle(color: Colors.white, fontSize: 20.0),),

            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                 Text('close2source',
                  style:GoogleFonts.amaticSc(
          textStyle: TextStyle(color: Colors.white, letterSpacing: 0.1, fontSize: 60.0, fontWeight: FontWeight.bold),),
                  )
              ],
            ),
            SizedBox(height: 20.0,),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ElevatedButton(onPressed: _loginUser, child: Text('Login')),
              ],
            )
          ],
        ),
      ),
    );
  }


  _loginUser(){
    AuthService().signIn("chris@edufree.org.uk", "Freedom09!", context);
  }

}
