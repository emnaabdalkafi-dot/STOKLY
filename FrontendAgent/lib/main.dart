import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'src/pages/splash/splash_page.dart';
import 'src/providers/user_provider.dart';
import 'src/services/inventory_service.dart';
import 'src/services/notification_service.dart';

void main() {
  runZonedGuarded(() {
    WidgetsFlutterBinding.ensureInitialized();
    NotificationService().init();
    runApp(
      ChangeNotifierProvider(
        create: (_) => UserProvider(),
        child: const StoklyAgentApp(),
      ),
    );
  }, (error, stack) {
    debugPrint('Uncaught error: $error');
    debugPrint(stack.toString());
  });
}

class StoklyAgentApp extends StatefulWidget {
  const StoklyAgentApp({super.key});

  @override
  State<StoklyAgentApp> createState() => _StoklyAgentAppState();
}

class _StoklyAgentAppState extends State<StoklyAgentApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.detached) {
      _setInactive();
    } else if (state == AppLifecycleState.resumed) {
      _setActive();
    }
  }

  Future<void> _setActive() async {
    try {
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      final invId = userProvider.activeInventoryId;
      if (invId != null) {
        await InventoryService().startInventaire(invId);
      }
    } catch (e) {
      debugPrint('Error setting active: $e');
    }
  }

  Future<void> _setInactive() async {
    try {
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      final invId = userProvider.activeInventoryId;
      if (invId != null) {
        // Envoi asynchrone sans attendre pour ne pas bloquer le lifecycle
        InventoryService().stopInventaire(invId);
      }
    } catch (e) {
      debugPrint('Error setting inactive: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'STOKLY Agent',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF102A43)),
        fontFamily: 'Roboto', // Use system font — avoids network download on first run
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFFFFBF6),
      ),
      home: const SplashPage(),
    );
  }
}