import '../../../imports.dart';

class HomeTabScreen extends StatefulWidget {
  final Profile projectData;

  const HomeTabScreen({super.key, required this.projectData});

  @override
  State<HomeTabScreen> createState() => _HomeTabScreenState();
}

class _HomeTabScreenState extends State<HomeTabScreen> {
  @override
  void initState() {
    // TODO: implement initState
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: 0, right: 0, top: 0, bottom: 0),
      child: Container(
        child: Column(
          children: [
            Container(
              color: Colors.deepOrange.withOpacity(0.7),
              padding: EdgeInsets.only(left: 10.0),
              child: Column(
                children: [
                  SizedBox(height: 25.0),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'CLOSE2SOURCE',
                        style: GoogleFonts.amaticSc(
                          textStyle: TextStyle(
                            color: Colors.white,
                            letterSpacing: 0.1,
                            fontSize: 40.0,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      IconButton(
                        icon: Icon(
                          Icons.exit_to_app,
                          color: Colors.white,
                          size: 30.0,
                        ),
                        onPressed: () {
                          //       ProfileRepository().createDemoProfile(uid: FirebaseAuth.instance.currentUser!.uid.toString(), email: FirebaseAuth.instance.currentUser!.email.toString());
                          Navigator.pop(context);
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Expanded(
              child: Container(
                constraints: BoxConstraints(minHeight: 20.0),
                color: Colors.white.withOpacity(0.7),
                child: Column(
                  children: [
                    Container(height: 20.0, color: Colors.black),
                    Container(
                      padding: EdgeInsets.all(15.0),
                      child: Column(
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(8.0),
                            child: Text(
                              widget.projectData.profileName,
                              style: TextStyle(
                                fontSize: 22.0,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          Text(widget.projectData.profileDesc),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
