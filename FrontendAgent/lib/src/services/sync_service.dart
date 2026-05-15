import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../constants/api_constants.dart';
import 'database_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SyncStatus {
  final bool issyncing;
  final int? syncedCount;
  SyncStatus(this.issyncing, {this.syncedCount});
}

class SyncService {
  static final SyncService _instance = SyncService._internal();
  factory SyncService() => _instance;
  SyncService._internal();

  final DatabaseService _dbService = DatabaseService();
  bool _isSyncing = false;
  Timer? _syncTimer;
  StreamSubscription? _connectivitySubscription;

  final _statusController = StreamController<SyncStatus>.broadcast();
  Stream<SyncStatus> get statusStream => _statusController.stream;

  final List<void Function(SyncStatus)> _listeners = [];

  void addStatusListener(void Function(SyncStatus) listener) {
    _listeners.add(listener);
  }

  void removeStatusListener(void Function(SyncStatus) listener) {
    _listeners.remove(listener);
  }

  void _notify(SyncStatus status) {
    for (var listener in _listeners) {
      listener(status);
    }
    if (!_statusController.isClosed) {
      _statusController.add(status);
    }
  }

  void startAutoSync({Duration interval = const Duration(seconds: 30)}) {
    _syncTimer?.cancel();
    _syncTimer = Timer.periodic(interval, (_) => syncNow());

    _connectivitySubscription?.cancel();
    _connectivitySubscription = Connectivity()
        .onConnectivityChanged
        .listen((List<ConnectivityResult> results) {
      if (results.isNotEmpty && results.first != ConnectivityResult.none) {
        syncNow();
      }
    });
  }

  void stopAutoSync() {
    _syncTimer?.cancel();
    _syncTimer = null;
    _connectivitySubscription?.cancel();
    _connectivitySubscription = null;
  }

  Future<void> syncNow() async {
    if (_isSyncing) return;

    final unsynced = await _dbService.getUnsyncedScans();
    if (unsynced.isEmpty) return;

    _isSyncing = true;
    _notify(SyncStatus(true));

    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (token == null) {
      _isSyncing = false;
      _notify(SyncStatus(false));
      return;
    }

    int successCount = 0;
    for (var scan in unsynced) {
      try {
        final response = await http.post(
          Uri.parse('${ApiConstants.baseUrl}/inventaires/${scan['inventaire_id']}/scan'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode({
            'code_barres': scan['code_barres'],
            'quantite': scan['quantite_comptee'],
          }),
        ).timeout(const Duration(seconds: 10));

        if (response.statusCode == 200 || response.statusCode == 201) {
          await _dbService.markScanAsSynced(scan['id']);
          successCount++;
        } else {
          // Mark as failed but continue with other scans
          await _dbService.markScanAsSyncFailed(
            scan['id'],
            'HTTP ${response.statusCode}',
          );
        }
      } catch (e) {
        // Network error — stop trying for now, will retry on next cycle
        break;
      }
    }

    _isSyncing = false;
    _notify(SyncStatus(false, syncedCount: successCount));
  }

  Future<Map<String, dynamic>> syncInventaireScans(int inventaireId) async {
    if (_isSyncing) {
      return {'success': false, 'message': 'Synchronisation déjà en cours'};
    }

    final unsynced = await _dbService.getUnsyncedScansByInventaire(inventaireId);
    if (unsynced.isEmpty) return {'success': true, 'message': 'Tout est à jour'};

    _isSyncing = true;
    _notify(SyncStatus(true));

    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (token == null) {
      _isSyncing = false;
      _notify(SyncStatus(false));
      return {'success': false, 'message': 'Non authentifié'};
    }

    int successCount = 0;
    int failCount = 0;

    for (var scan in unsynced) {
      try {
        final response = await http.post(
          Uri.parse('${ApiConstants.baseUrl}/inventaires/$inventaireId/scan'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode({
            'code_barres': scan['code_barres'],
            'quantite': scan['quantite_comptee'],
          }),
        ).timeout(const Duration(seconds: 10));

        if (response.statusCode == 200 || response.statusCode == 201) {
          await _dbService.markScanAsSynced(scan['id']);
          successCount++;
        } else {
          await _dbService.markScanAsSyncFailed(
            scan['id'],
            'HTTP ${response.statusCode}',
          );
          failCount++;
        }
      } catch (e) {
        failCount++;
        // Continue trying remaining scans even if one fails
      }
    }

    _isSyncing = false;
    _notify(SyncStatus(false, syncedCount: successCount));

    return {
      'success': failCount == 0,
      'message': failCount == 0
          ? '$successCount scan(s) synchronisés'
          : '$successCount synchronisés, $failCount échoués',
      'syncedCount': successCount,
      'failCount': failCount,
    };
  }
}
