import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/api_constants.dart';

class AuthService {
  final String baseUrl = ApiConstants.baseUrl;
  Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token') != null;
  }
  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/agent/login'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'email': email,
          'password': password,
        })
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('token', data['data']['token']);
        await prefs.setString('user', json.encode(data['data']['user']));
        return {
          'success': true,
          'data': data['data'],
        };
      } else {
        return {'success': false, 'message': data['message'] ?? 'Erreur de connexion'};
      }
    } catch (e) {
      return {'success': false, 'message': 'La connexion Internet est interrompue. Veuillez vérifier votre réseau.'};
    }
  }
  Future<Map<String, dynamic>?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userString = prefs.getString('user');

    if (userString != null) {
      return json.decode(userString);
    }
    return null;
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
  }

  Future<Map<String, dynamic>> forgotPassword(String email) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/forgot-password'),
        headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
        body: json.encode({'email': email}),
      );

      final data = json.decode(response.body);
      return {
        'success': response.statusCode == 200,
        'message': data['message'] ?? 'Une erreur est survenue',
      };
    } catch (e) {
      return {'success': false, 'message': 'La connexion Internet est interrompue. Veuillez vérifier votre réseau.'};
    }
  }
}
