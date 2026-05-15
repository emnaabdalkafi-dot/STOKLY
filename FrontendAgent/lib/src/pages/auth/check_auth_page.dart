import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import 'package:provider/provider.dart';
import '../../providers/user_provider.dart';
import '../home/home_page.dart';
import 'login_page.dart';

class CheckAuthPage extends StatefulWidget {
  const CheckAuthPage({super.key});

  @override
  State<CheckAuthPage> createState() => _CheckAuthPageState();
}

class _CheckAuthPageState extends State<CheckAuthPage> {
  final AuthService authService = AuthService();

  @override
  void initState() {
    super.initState();
    checkLogin();
  }

  void checkLogin() async {
    bool loggedIn = await authService.isLoggedIn();

    if (loggedIn) {
      if (mounted) {
        Provider.of<UserProvider>(context, listen: false).initUser();
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const HomePage()),
        );
      }
    } else {
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const LoginPage()),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}