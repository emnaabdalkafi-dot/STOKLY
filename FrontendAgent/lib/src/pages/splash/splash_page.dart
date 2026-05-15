import 'package:flutter/material.dart';
import '../../constants/app_colors.dart';
import '../auth/login_page.dart';
import '../../services/auth_service.dart';
import 'package:provider/provider.dart';
import '../../providers/user_provider.dart';
import '../home/home_page.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  final AuthService _authService = AuthService();

  @override
  void initState() {
    super.initState();
    _initApp();
  }

  Future<void> _initApp() async {
    // Show splash for a short time
    await Future.delayed(const Duration(milliseconds: 800));
    
    final bool loggedIn = await _authService.isLoggedIn();
    
    if (mounted) {
      if (loggedIn) {
        // Initialize user data before going home
        await Provider.of<UserProvider>(context, listen: false).initUser();
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const HomePage()),
          );
        }
      } else {
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const LoginPage()),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(

      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppColors.backgroundStart,
              AppColors.backgroundEnd
            ],
          ),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [

              ClipRRect(
                borderRadius: BorderRadius.circular(15),
                child: Image.asset(
                  'assets/images/logo.png',
                  width: 70,
                  height: 70,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(height: 12),

              Image.asset(
                'assets/images/logo_text.png',
                width: 80,
              ),

              const SizedBox(height: 30),

            ],
          ),
        ),
      ),
    );
  }
}
