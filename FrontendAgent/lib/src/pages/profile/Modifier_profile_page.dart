import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../constants/app_colors.dart';
import '../../constants/api_constants.dart';
import '../../providers/user_provider.dart';
import '../../services/user_service.dart';
import '../../widgets/custom_app_bar.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final TextEditingController _nomController = TextEditingController();
  final TextEditingController _prenomController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _telController = TextEditingController();
  final TextEditingController _currentPasswordController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _passwordConfirmController = TextEditingController();

  bool _isLoading = false;
  Map<String, dynamic> _errors = {};

  final String baseAppUrl = ApiConstants.serverUrl;
  final UserService _userService = UserService();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = Provider.of<UserProvider>(context, listen: false).user;
      if (user != null) {
        _nomController.text = user['nom'] ?? '';
        _prenomController.text = user['prenom'] ?? '';
        _emailController.text = user['email'] ?? '';
        _telController.text = user['tel'] ?? '';
      }
    });
  }

  @override
  void dispose() {
    _nomController.dispose();
    _prenomController.dispose();
    _emailController.dispose();
    _telController.dispose();
    _currentPasswordController.dispose();
    _passwordController.dispose();
    _passwordConfirmController.dispose();
    super.dispose();
  }

  Future<void> _updateProfile() async {
    setState(() {
      _isLoading = true;
      _errors = {};
    });

    final result = await _userService.updateProfile(
      nom: _nomController.text,
      prenom: _prenomController.text,
      email: _emailController.text,
      tel: _telController.text,
      currentPassword: _currentPasswordController.text,
      password: _passwordController.text,
      passwordConfirmation: _passwordConfirmController.text,
    );

    if (!mounted) return;

    if (result['success']) {
      Provider.of<UserProvider>(context, listen: false).setUser(result['data']);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profil mis à jour avec succès'), backgroundColor: Colors.green),
      );
      Navigator.pop(context); // Retour à la page de profil après succès
    } else if (result['errors'] != null) {
      setState(() {
        _errors = result['errors'];
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['message'] ?? 'Erreur lors de la mise à jour'), backgroundColor: Colors.red),
      );
    }

    if (mounted) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _pickAndUploadAvatar() async {
    final ImagePicker picker = ImagePicker();
    final XFile? image = await picker.pickImage(source: ImageSource.gallery);

    if (image == null) return;

    setState(() {
      _isLoading = true;
    });

    final result = await _userService.uploadAvatar(image);

    if (!mounted) return;

    if (result['success']) {
      Provider.of<UserProvider>(context, listen: false).setUser(result['data']);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Avatar mis à jour avec succès'), backgroundColor: Colors.green),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['message'] ?? 'Erreur lors de l\'upload'), backgroundColor: Colors.red),
      );
    }

    if (mounted) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Widget _buildAvatarWidget(Map<String, dynamic>? user) {
    if (user == null || user['avatar'] == null || user['avatar'].toString().isEmpty) {
      String initials = "";
      if (user != null) {
        if (user['nom'] != null && user['nom'].toString().trim().isNotEmpty) {
          initials += user['nom'].toString().trim()[0].toUpperCase();
        }
        if (user['prenom'] != null && user['prenom'].toString().trim().isNotEmpty) {
          initials += user['prenom'].toString().trim()[0].toUpperCase();
        }
      }
      
      return Container(
        width: 120,
        height: 120,
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Center(
          child: Text(
            initials.isNotEmpty ? initials : "?",
            style: const TextStyle(
              color: Colors.white,
              fontSize: 48,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      );
    }

    String avatarUrl = user['avatar'].toString().startsWith('http')
        ? user['avatar'].toString()
        : '$baseAppUrl${user['avatar']}';

    return Container(
      width: 120,
      height: 120,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(4),
        image: DecorationImage(
          image: NetworkImage(avatarUrl),
          fit: BoxFit.cover,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<UserProvider>(context).user;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: const CustomAppBar(
        title: 'Modifier Profil',
      ),
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
        child: SafeArea(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    children: [
                      const SizedBox(height: 10),

                  // IMAGE
                  GestureDetector(
                    onTap: _pickAndUploadAvatar,
                    child: Stack(
                      children: [
                        _buildAvatarWidget(user),
                        Positioned(
                          bottom: 5,
                          right: 5,
                          child: Container(
                            padding: const EdgeInsets.all(5),
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.edit, size: 18, color: AppColors.primary),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 30),

                  // FIELDS
                  _buildField("Nom", _nomController, Icons.person, errorKey: 'nom'),
                  _buildField("Prénom", _prenomController, Icons.person_outline, errorKey: 'prenom'),
                  _buildField("Email", _emailController, Icons.email, errorKey: 'email', keyboardType: TextInputType.emailAddress),
                  _buildField("Téléphone", _telController, Icons.phone, errorKey: 'tel', keyboardType: TextInputType.phone),

                  const Divider(height: 40, thickness: 1),
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      "Changer le mot de passe (optionnel)",
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.primary),
                    ),
                  ),
                  const SizedBox(height: 15),

                  _buildField("Mot de passe actuel", _currentPasswordController, Icons.lock, isPassword: true, errorKey: 'current_password'),
                  _buildField("Nouveau mot de passe", _passwordController, Icons.shield_outlined, isPassword: true, errorKey: 'password'),
                  _buildField("Confirmer mot de passe", _passwordConfirmController, Icons.shield, isPassword: true),

                  const SizedBox(height: 30),

                  // BUTTON
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _updateProfile,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        padding: const EdgeInsets.symmetric(vertical: 15),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      child: const Text(
                        'Enregistrer',
                        style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ),
      ),
    );
  }

  Widget _buildField(String label, TextEditingController controller, IconData icon, {bool isPassword = false, String? errorKey, TextInputType? keyboardType}) {
    List<dynamic>? fieldErrors = errorKey != null ? _errors[errorKey] : null;
    String? errorText = fieldErrors != null && fieldErrors.isNotEmpty ? fieldErrors[0].toString() : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.accent,
            fontWeight: FontWeight.bold,
            fontSize: 11,
          ),
        ),
        const SizedBox(height: 5),
        Container(
          margin: EdgeInsets.only(bottom: errorText != null ? 5 : 15),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: errorText != null ? Colors.red : Colors.grey.shade300),
          ),
          child: TextField(
            controller: controller,
            obscureText: isPassword,
            keyboardType: keyboardType,
            decoration: InputDecoration(
              prefixIcon: Icon(icon, color: AppColors.primary, size: 18),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
              isDense: true,
              hintStyle: const TextStyle(fontSize: 12),
            ),
            style: const TextStyle(fontSize: 13),
          ),
        ),
        if (errorText != null)
          Padding(
            padding: const EdgeInsets.only(left: 10, bottom: 15),
            child: Text(
              errorText,
              style: const TextStyle(color: Colors.red, fontSize: 12),
            ),
          ),
      ],
    );
  }
}