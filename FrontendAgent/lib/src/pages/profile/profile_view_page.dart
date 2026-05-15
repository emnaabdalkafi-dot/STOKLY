import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../constants/app_colors.dart';
import '../../constants/api_constants.dart';
import '../../services/auth_service.dart';
import '../../providers/user_provider.dart';
import '../auth/login_page.dart';
import 'Modifier_profile_page.dart';

class ProfileViewPage extends StatelessWidget {
  const ProfileViewPage({super.key});

  @override
  Widget build(BuildContext context) {
    final authService = AuthService();
    final user = Provider.of<UserProvider>(context).user;

    return Scaffold(
      backgroundColor: AppColors.backgroundStart,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            // HEADER
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Profil',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: Image.asset(
                    'assets/images/logo.png',
                    width: 30,
                    height: 30,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 30),

            // AVATAR
            _buildAvatarWidget(user),

            const SizedBox(height: 15),

            Text(
              user != null
                  ? "${user['nom']} ${user['prenom']}"
                  : "Utilisateur",
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: AppColors.primary,
              ),
            ),

            Text(
              user?['email'] ?? "",
              style: const TextStyle(color: Colors.grey, fontSize: 12),
            ),

            const SizedBox(height: 30),

            // EDIT BUTTON
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const ProfilePage(),
                    ),
                  );
                },
                icon: const Icon(Icons.edit, color: Colors.white),
                label: const Text(
                  'Modifier Profil',
                  style: TextStyle(color: Colors.white),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 15),

            // LOGOUT
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () async {
                  await authService.logout();

                  Provider.of<UserProvider>(context, listen: false)
                      .clearUser();

                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(
                      builder: (_) => const LoginPage(),
                    ),
                        (route) => false,
                  );
                },
                icon: const Icon(Icons.logout, color: AppColors.error),
                label: const Text(
                  'Déconnexion',
                  style: TextStyle(color: AppColors.error),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.error),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(5),
                  ),
                ),

              ),
            ),
          ],
        ),
      ),
    );
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
        width: 100,
        height: 100,
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Center(
          child: Text(
            initials.isNotEmpty ? initials : "?",
            style: const TextStyle(
              color: Colors.white,
              fontSize: 40,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      );
    }

    String avatarUrl = user['avatar'].toString().startsWith('http')
        ? user['avatar'].toString()
        : '${ApiConstants.serverUrl}${user['avatar']}';

    return ClipRRect(
      borderRadius: BorderRadius.circular(4),
      child: Image.network(
        avatarUrl,
        width: 100,
        height: 100,
        fit: BoxFit.cover,
      ),
    );
  }
}