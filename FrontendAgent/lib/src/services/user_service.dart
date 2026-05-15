import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/api_constants.dart';

class UserService {
  final String baseUrl = ApiConstants.baseUrl;

  Future<Map<String, dynamic>> updateProfile({
    required String nom,
    required String prenom,
    required String email,
    required String tel,
    String? currentPassword,
    String? password,
    String? passwordConfirmation,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');

      if (token == null) throw Exception('Non authentifié');

      final body = {
        'nom': nom,
        'prenom': prenom,
        'email': email,
        'tel': tel,
      };

      if (password != null && password.isNotEmpty) {
        body['current_password'] = currentPassword ?? '';
        body['password'] = password;
        body['password_confirmation'] = passwordConfirmation ?? '';
      }

      final response = await http.put(
        Uri.parse('$baseUrl/user/profile'),
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: json.encode(body),
      );

      final responseData = json.decode(response.body);

      if (response.statusCode == 200 && responseData['success'] == true) {
        return {'success': true, 'data': responseData['data']};
      } else if (response.statusCode == 422) {
        return {'success': false, 'errors': responseData['errors']};
      } else {
        return {'success': false, 'message': responseData['message'] ?? 'Erreur lors de la mise à jour'};
      }
    } catch (e) {
      return {'success': false, 'message': 'La connexion Internet est interrompue. Veuillez vérifier votre réseau.'};
    }
  }

  Future<Map<String, dynamic>> uploadAvatar(XFile image) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');

      if (token == null) throw Exception('Non authentifié');

      var request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/user/avatar'),
      );
      request.headers['Authorization'] = 'Bearer $token';
      request.headers['Accept'] = 'application/json';
      request.files.add(await http.MultipartFile.fromPath('avatar', image.path));

      var response = await request.send();
      var responseBody = await response.stream.bytesToString();
      var responseData = json.decode(responseBody);

      if (response.statusCode == 200 && responseData['success'] == true) {
        return {'success': true, 'data': responseData['data']['user']};
      } else {
        return {'success': false, 'message': responseData['message'] ?? 'Erreur lors de l\'upload'};
      }
    } catch (e) {
      return {'success': false, 'message': 'La connexion Internet est interrompue. Veuillez vérifier votre réseau.'};
    }
  }
}
