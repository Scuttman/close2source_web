import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart' as fs;
import 'package:provider/provider.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:path_provider/path_provider.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'imports.dart';
import 'services/spending_cache_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  LicenseRegistry.addLicense(() async* {
    final license = await rootBundle.loadString(
      'assets/fonts/Amatic_SC/OFL.txt',
    );
    yield LicenseEntryWithLineBreaks(['google_fonts'], license);
  });

  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  fs.FirebaseFirestore.instance.settings = const fs.Settings(
    persistenceEnabled: true,
    cacheSizeBytes: fs.Settings.CACHE_SIZE_UNLIMITED,
  );

  final appDir = await getApplicationDocumentsDirectory();
  await Hive.initFlutter(appDir.path);
  await SpendingCacheService.init();

  runApp(
    MultiProvider(
      providers: [ChangeNotifierProvider(create: (_) => ProjectsProvider())],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Close2Source',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        scaffoldBackgroundColor: Colors.white,
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepOrange),
      ),
      routes: {
        AppRoutes.login: (context) => const LoginScreen(),
        AppRoutes.register: (context) => const UserRegistrationForm(),
        AppRoutes.dashboard: (context) => const DashboardScreen(),
        AppRoutes.reportForm: (context) => const ReportFormScreen(),
        AppRoutes.profileHome: (context) => const ProfileHomeScreen(),
      },
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> with WidgetsBindingObserver {
  StreamSubscription<ConnectivityResult>? _connectivitySubscription;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      bool isAuthenticated = await AuthService().handleAuthState(context);
      if (isAuthenticated) {
        Navigator.pushReplacementNamed(context, AppRoutes.profileHome);
      } else {
        Navigator.pushReplacementNamed(context, AppRoutes.login);
      }
    });

    _connectivitySubscription = Connectivity().onConnectivityChanged.listen((
      result,
    ) {
      if (result != ConnectivityResult.none) {
        debugPrint('📶 Connectivity restored. Syncing cached data...');
        SpendingCacheService.syncToFirestore();
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      debugPrint('🔄 App resumed. Syncing cached data...');
      SpendingCacheService.syncToFirestore();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _connectivitySubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
