import '../../imports.dart';

class ScreenNormalAppBarWidget extends StatelessWidget {

  final String title;
  final bool? logOut;
  const ScreenNormalAppBarWidget({super.key, required this.title, this.logOut});

  @override
  Widget build(BuildContext context) {
      double screenWidth = MediaQuery.of(context).size.width;
      return Material(
        elevation: 4.0,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(0),
          bottomRight: Radius.circular(0),
        ),
        child: Container(
          constraints: const BoxConstraints(minHeight: 30.0),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                themeGradientStart,
               themeGradientEnd,
              ],
            ),
            borderRadius: const BorderRadius.only(
              bottomLeft: Radius.circular(0),
              bottomRight: Radius.circular(0),
            ),
          ),
          child: Column(
            children: [
              Container(height: 50.0),
              SizedBox(
                height: 60.0,
                child: Row(
                  children: [
                    const SizedBox(width: 15.0),
                    Container(
                        constraints: BoxConstraints(
                            maxWidth: screenWidth - 80,
                            minHeight: 10.0
                        ),
                        child: Text(title.toString(), style: AppTextService().courseTitle)),
                    Expanded(child: Container()),
                    IconButton(
                      icon: const Icon(Icons.logout, color: Colors.white),
                      onPressed: () async {
                        if(logOut == null) {
                          Navigator.pop(context);
                        } else {
                          AuthService().signOut(context);
                        }
                      },
                    ),
                    const SizedBox(width: 0.0),
                  ],
                ),
              ),
              const SizedBox(height: 15.0),
            ],
          ),
        ),
      );
    }
}
