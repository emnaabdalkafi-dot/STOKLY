# 🚀 Setup & Testing Guide - Offline-First Synchronization

## Prerequisites

- Flutter SDK 3.x+
- Dart 3.x+
- pubspec.yaml with dependencies:
  - `sqflite: ^2.4.2` ✅ (Already added)
  - `path: ^1.9.1` ✅ (Already added)
  - `http: ^1.1.0` ✅ (Already added)
  - `shared_preferences: ^2.2.0` ✅ (Already added)

## Installation

### 1. Get dependencies
```bash
cd FrontendAgent
flutter pub get
```

### 2. Verify installation
```bash
flutter doctor
# Should show: ✓ Flutter (Channel stable) 
# ✓ Dart X.x.x
```

## Running the App

### Development Build
```bash
flutter run -d <device_id>
# For Android emulator:
flutter run

# For iOS simulator:
flutter run -d <simulator_id>
```

### Release Build
```bash
flutter build apk        # Android
flutter build ios        # iOS (requires macOS)
```

## Testing the Offline-First System

### Test Case 1: Online Scan
**Setup:**
- Device with internet connection
- App running with real backend

**Steps:**
1. Open app and log in
2. Navigate to an inventory
3. Click "Démarrer"
4. Wait for "Articles téléchargés" message
5. Scan a valid barcode

**Expected Result:**
- ✅ Badge shows "En ligne" (green)
- ✅ Scan appears immediately
- ✅ No "non sync" badge shown
- ✅ SnackBar shows "Scanné avec succès"

---

### Test Case 2: Offline Scan
**Setup:**
- Device WITHOUT internet (airplane mode)
- App running with articles already downloaded

**Steps:**
1. Enable Airplane Mode
2. Scan a valid barcode
3. Observe UI changes
4. Scan 3-4 more barcodes

**Expected Result:**
- ✅ Badge shows "Hors ligne" (orange)
- ✅ SnackBar shows "📱 Enregistré localement"
- ✅ Badge shows "4 non sync." in header
- ✅ "Synchroniser (4)" button appears at bottom
- ✅ All data stored locally in SQLite

---

### Test Case 3: Auto-Sync after Connection Restore
**Setup:**
- Continue from Test Case 2 (4 unsynced scans)
- Device with airplane mode still on

**Steps:**
1. Disable Airplane Mode (restore connection)
2. Wait 30 seconds (auto-sync interval)
3. Check button status

**Expected Result:**
- ✅ Auto-sync triggers after ~30 seconds
- ✅ Button shows "Synchroniser..." with spinner
- ✅ Scans uploaded to server
- ✅ Badge disappears (0 non sync)
- ✅ SnackBar shows "Synchronisé: 4, Échoué: 0"

---

### Test Case 4: Manual Sync
**Setup:**
- 5 unsynced scans in local database
- Device offline (airplane mode)

**Steps:**
1. Click "Synchroniser (5)" button manually
2. Device is still offline

**Expected Result:**
- ✅ Button shows spinner with text "Synchronisation..."
- ✅ Button is disabled (cannot click again)
- ✅ SnackBar shows "Erreur: Network error" or similar
- ✅ Data remains in local_scans table (synced=0)
- ✅ Badge still shows "5 non sync."

---

### Test Case 5: Sync Status Dialog
**Setup:**
- 5 unsynced scans
- Articles downloaded (50 total)

**Steps:**
1. Tap pause button (📍 icon)
2. Select "Statut de Synchronisation"
3. Review the dialog

**Expected Result:**
- ✅ Dialog shows:
  - "Articles téléchargés: 50"
  - "Scans enregistrés: 45"
  - "En attente de sync: 5"
- ✅ Message explains auto-sync behavior
- ✅ Close button works

---

### Test Case 6: Data Cleanup
**Setup:**
- Inventory completed with all scans synced

**Steps:**
1. End the inventory (click "Arrêter Inventaire")
2. Confirm

**Expected Result:**
- ✅ Backend marks as "terminé"
- ✅ Local SQLite cleaned:
  - articles table: empty
  - local_scans table: empty (synced=1 removed)
  - inventaire_downloads: removed
- ✅ Return to inventory list
- ✅ Can start new inventory without old data

---

### Test Case 7: Network Interruption & Retry
**Setup:**
- Device online but weak/unstable connection

**Steps:**
1. Scan multiple items (simulate network lag)
2. Toggle airplane mode on/off during sync
3. Observe retry behavior

**Expected Result:**
- ✅ Failed scans show sync_error message
- ✅ Auto-sync retries after 30 seconds
- ✅ Eventually succeeds when connection stable
- ✅ No data loss

---

### Test Case 8: Barcode Not Found (Offline)
**Setup:**
- Device offline (airplane mode)

**Steps:**
1. Try to scan an invalid barcode (not in article list)
2. Check error dialog

**Expected Result:**
- ✅ Error dialog shows:
  - Title: "Attention"
  - Message: "Article non trouvé (Mode offline: Articles non téléchargés)"
- ✅ Can close and try another scan

---

## Debugging

### Enable Verbose Logging
```bash
flutter run -v
# Shows all debug output
```

### Check SQLite Database (Android)
```bash
# Connect to device
adb shell

# Navigate to app data
cd /data/data/com.example.frontend_agent/databases/

# List files
ls -la

# Access database
sqlite3 stokly.db
sqlite> .tables
sqlite> SELECT * FROM local_scans;
sqlite> .quit
```

### View Logs
```bash
# Real-time logs
flutter logs

# In another terminal
flutter run
```

### Common Issues

#### Issue: "Database not found"
**Solution:**
```dart
// Force rebuild database
await DatabaseService().database; // Initializes
```

#### Issue: "Scans not syncing"
**Check:**
1. Is SyncService started? `_syncService.startAutoSync()`
2. Is there internet? Check badge "Hors ligne"
3. Are there listeners? Check `_syncService.addStatusListener()`

**Debug:**
```dart
final unsynced = await _db.getUnsyncedScans();
print('Unsynced: ${unsynced.length}'); // Should be > 0
```

#### Issue: "Auth token missing"
**Solution:**
```dart
final token = await SharedPreferences.getInstance()
    .getString('token');
if (token == null) {
  // User not logged in, redirect to login
}
```

---

## Performance Testing

### Measure Sync Time
```dart
final startTime = DateTime.now();
await _syncService.syncAllPending();
final duration = DateTime.now().difference(startTime);
print('Sync took: ${duration.inSeconds}s');
```

### Measure Database Speed
```dart
final startTime = DateTime.now();
await _db.insertArticles(articles); // 1000 articles
final duration = DateTime.now().difference(startTime);
print('Insert 1000 articles: ${duration.inMilliseconds}ms');
```

Expected: < 500ms for 1000 articles

---

## Unit Tests (TODO)

Example test file: `test/sync_service_test.dart`

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_agent/src/services/sync_service.dart';

void main() {
  group('SyncService', () {
    late SyncService syncService;

    setUp(() {
      syncService = SyncService();
    });

    test('Should sync unsynced scans', () async {
      // TODO: Implement test
    });

    test('Should handle network errors gracefully', () async {
      // TODO: Implement test
    });
  });
}
```

---

## Integration Tests (TODO)

Test end-to-end flow with real database:

```bash
flutter test integration_test/offline_first_test.dart
```

---

## Checklist before Release

- [ ] All tests pass (`flutter test`)
- [ ] No console errors or warnings
- [ ] Auto-sync interval configured (30s recommended)
- [ ] UI properly shows online/offline status
- [ ] Sync button appears when needed
- [ ] Data cleanup works after inventory completion
- [ ] Database schema matches migrations
- [ ] Backend endpoints implemented and tested
- [ ] Rate limiting configured (100 POST/min)
- [ ] Authentication tokens validated
- [ ] Error messages are user-friendly

---

## Rollback Procedure

If issues occur in production:

```bash
# Disable auto-sync
_syncService.stopAutoSync();

# Force delete local data if corrupted
await _db.cleanupInventaireData(inventaireId);

# Restart app
```

---

## Monitoring in Production

### Key Metrics
1. **Sync Success Rate**: (synced / total) %
2. **Average Sync Time**: X ms
3. **Error Rate**: Y %
4. **Database Size**: Z MB

### Alerts
- If sync_error > 10%
- If database size > 50 MB
- If sync_time > 5 seconds

---

## Support & Troubleshooting

### Logs Location
- Android: `/data/data/com.example.frontend_agent/files/`
- iOS: `Logs/` in app container

### Contact
- Mobile Team: [@dev-mobile]
- Backend Team: [@dev-backend]
- QA Team: [@qa-team]

---

**Version:** 1.0.0  
**Last Updated:** May 2026  
**Maintainer:** Dev Team
