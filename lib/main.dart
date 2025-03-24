//------------------------------------------------------------------------------
// Essential imports: Imports plus those packages that can clash
//------------------------------------------------------------------------------

import 'imports.dart';
import 'package:cloud_firestore/cloud_firestore.dart' as fs;
import 'package:provider/provider.dart';

//------------------------------------------------------------------------------
// Setup and Initialize App
//------------------------------------------------------------------------------

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Register Google Fonts
  LicenseRegistry.addLicense(() async* {
    final license = await rootBundle.loadString(
      'assets/fonts/Amatic_SC/OFL.txt',
    );
    yield LicenseEntryWithLineBreaks(['google_fonts'], license);
  });

  // Register & Initialize Firebase
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  fs.FirebaseFirestore firestore = fs.FirebaseFirestore.instance;
  firestore.settings = const fs.Settings(
    persistenceEnabled: true,
    cacheSizeBytes: fs.Settings.CACHE_SIZE_UNLIMITED,
  );

  // Ensure MultiProvider wraps MyApp and is returned
  runApp(
    MultiProvider(
      providers: [ChangeNotifierProvider(create: (_) => ProjectsProvider())],
      child: MyApp(),
    ),
  );
}

//------------------------------------------------------------------------------
// App Default Settings
//------------------------------------------------------------------------------

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'close2source',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        scaffoldBackgroundColor: Colors.white,
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepOrange),
      ),
      initialRoute:
          FirebaseAuth.instance.currentUser == null
              ? AppRoutes.login
              : AppRoutes.dashboard,
      onGenerateRoute: AppRoutes.generateRoute,
    );
  }
}
