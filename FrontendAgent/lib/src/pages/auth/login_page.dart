import 'package:flutter/material.dart';
import '../../constants/app_colors.dart';
import '../../services/auth_service.dart';
import 'forgot_password_page.dart';
import '../home/home_page.dart';
import 'package:provider/provider.dart';
import '../../providers/user_provider.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _showPassword = false;
  String? _errorMessage;
  bool _isLoading = false;
  final AuthService _authService = AuthService();

  Future<void> _handleLogin() async {
    if (_emailController.text.isEmpty || _passwordController.text.isEmpty) {
      setState(() {
        _errorMessage = "Veuillez remplir tous les champs";
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final result = await _authService.login(
      _emailController.text,
      _passwordController.text,
    );

    if (mounted) {
      setState(() {
        _isLoading = false;
      });

      if (result['success'] == true) {
        final data = result['data'];

        if (data != null && data['user'] != null) {
          Provider.of<UserProvider>(context, listen: false)
              .setUser(data['user']);

          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const HomePage()),
          );
        } else {
          setState(() {
            _errorMessage = "Erreur: données utilisateur manquantes";
            print(result);
          });
        }
      } else {
        setState(() {
          _errorMessage = result['message'] ?? "Erreur de connexion";
        });
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
            colors: [AppColors.backgroundStart, AppColors.backgroundEnd],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 30.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // LOGO
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

                // ERROR MESSAGE
                if (_errorMessage != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    margin: const EdgeInsets.only(bottom: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFE8EC),
                      border: Border.all(color: AppColors.error),
                      borderRadius: BorderRadius.circular(5),
                    ),
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(
                        color: AppColors.error,
                        fontSize: 12,
                      ),
                    ),
                  ),

                const SizedBox(height: 4),

                // EMAIL
                _buildLabel('Email'),
                _buildInputField(
                  controller: _emailController,
                  hint: 'Email @ exemple . com',
                  icon: Icons.email_outlined,

                ),

                const SizedBox(height: 4),

                // PASSWORD
                _buildLabel('Mot de passe'),
                _buildInputField(
                  controller: _passwordController,
                  hint: 'Mot de passe',
                  icon: Icons.lock_outline,
                  isPassword: true,
                  showPassword: _showPassword,
                  onTogglePassword: () {
                    setState(() {
                      _showPassword = !_showPassword;
                    });
                  },
                ),
                const SizedBox(height: 20),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(
                    onPressed: () {
                      Navigator.push(context, MaterialPageRoute(builder: (context) => const ForgotPasswordPage()));
                    },
                    child: const Text('Mot de passe oublié ?', style: TextStyle(color: AppColors.accent, fontSize: 10, decoration: TextDecoration.underline)),
                  ),
                ),

                const Spacer(), // Pushes button to the bottom

                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _handleLogin,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      elevation: 2,
                    ),
                    child: _isLoading
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Se connecter', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(text, style: const TextStyle(color: AppColors.accent, fontWeight: FontWeight.bold, fontSize: 11)),
    );
  }

  Widget _buildInputField({required TextEditingController controller, required String hint, required IconData icon, bool isPassword = false, bool showPassword = false, VoidCallback? onTogglePassword}) {
    return Container(
      margin: const EdgeInsets.only(top: 3),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: TextField(

        controller: controller,
        textAlignVertical: TextAlignVertical.center,
        obscureText: isPassword && !showPassword,
        style: const TextStyle(fontSize: 15),
        decoration: InputDecoration(
          prefixIcon: Icon(
            icon,
            color: AppColors.primary,
            size: 16,
          ),
          suffixIcon: isPassword
              ? IconButton(
            icon: Icon(
              showPassword
                  ? Icons.visibility_off_outlined
                  : Icons.visibility_outlined,
              size: 16,
            ),
            onPressed: onTogglePassword,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          )
              : null,
          hintText: hint,
          hintStyle: const TextStyle(fontSize: 11),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            vertical: 2,
          ),
        ),
      ),
    );
  }


}
