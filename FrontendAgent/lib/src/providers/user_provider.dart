import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class UserProvider with ChangeNotifier {
  Map<String, dynamic>? user;
  int? activeInventoryId;

  Future<void> initUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userString = prefs.getString('user');
    activeInventoryId = prefs.getInt('active_inventory_id');
    if (userString != null) {
      user = json.decode(userString);
      notifyListeners();
    }
  }

  void setActiveInventory(int? id) async {
    activeInventoryId = id;
    final prefs = await SharedPreferences.getInstance();
    if (id == null) {
      prefs.remove('active_inventory_id');
    } else {
      prefs.setInt('active_inventory_id', id);
    }
    notifyListeners();
  }

  void setUser(Map<String, dynamic> data) {
    user = data;
    notifyListeners();
  }

  void clearUser() {
    user = null;
    notifyListeners();
  }
}