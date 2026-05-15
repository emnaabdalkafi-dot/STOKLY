# 📚 API Reference - Offline-First Services

Quick reference for developers using the offline-first synchronization system.

---

## DatabaseService

Singleton service for SQLite operations.

### Initialization
```dart
final db = DatabaseService();
```

### Articles Operations

```dart
// Insert single article
await db.insertArticle({
  'id': 1,
  'code_barres': '123456',
  'nom': 'Article A',
  'ligne_inventaire_id': 10,
  'inventaire_id': 1,
});

// Insert multiple articles (faster)
await db.insertArticles([
  {'id': 1, 'code_barres': '123456', ...},
  {'id': 2, 'code_barres': '789012', ...},
]);

// Get all articles for inventory
List<Map<String, dynamic>> articles = 
  await db.getArticlesByInventaire(inventaireId);

// Find article by barcode
Map<String, dynamic>? article = 
  await db.getArticleByBarcode('123456');

// Delete all articles for inventory
await db.deleteArticlesByInventaire(inventaireId);
```

### Local Scans Operations

```dart
// Record a scan locally
int scanId = await db.insertLocalScan({
  'inventaire_id': 1,
  'ligne_inventaire_id': 10,
  'code_barres': '123456',
  'article_nom': 'Article A',
  'quantite_comptee': 1,
});

// Get all unsynced scans (all inventories)
List<Map<String, dynamic>> unsynced = 
  await db.getUnsyncedScans();

// Get unsynced scans for specific inventory
List<Map<String, dynamic>> unsynced = 
  await db.getUnsyncedScansByInventaire(inventaireId);

// Mark scan as synced
await db.markScanAsSynced(scanId);

// Mark scan as failed with error
await db.markScanAsSyncFailed(scanId, 'Network timeout');

// Get scans for inventory (paginated)
List<Map<String, dynamic>> scans = 
  await db.getScansByInventaire(inventaireId, limit: 50, offset: 0);

// Count unsynced scans
int count = await db.countUnsyncedScans(inventaireId);

// Delete synced scans
await db.deleteSyncedScans(inventaireId);
```

### Download Tracking

```dart
// Record download
await db.recordDownload(inventaireId, articlesCount);

// Check if downloaded
bool downloaded = 
  await db.isInventaireDownloaded(inventaireId);

// Get stats
Map<String, dynamic>? stats = 
  await db.getDownloadStats(inventaireId);

// Update sync count
await db.updateSyncedCount(inventaireId, count);

// Delete download record
await db.deleteDownloadRecord(inventaireId);
```

### Cleanup

```dart
// Clean all data for inventory
await db.cleanupInventaireData(inventaireId);

// Clean old data (> 30 days)
await db.cleanupOldData(daysOld: 30);

// Close database
await db.close();
```

---

## SyncService

Singleton service for synchronization.

### Initialization
```dart
final sync = SyncService();
```

### Auto-Sync Control

```dart
// Start auto-sync (every 30 seconds)
sync.startAutoSync(interval: const Duration(seconds: 30));

// Start with custom interval
sync.startAutoSync(interval: const Duration(minutes: 1));

// Stop auto-sync
sync.stopAutoSync();
```

### Status Listeners

```dart
// Add listener for sync status changes
sync.addStatusListener((status) {
  setState(() {
    _isSyncing = status.issyncing;
    _message = status.message;
  });
});

// Remove listener
sync.removeStatusListener(_onStatusChanged);

// Listener callback receives SyncStatus object:
// {
//   issyncing: bool,
//   message: String,
//   syncedCount: int?,
//   failedCount: int?,
//   error: String?
// }
```

### Manual Sync

```dart
// Sync all pending scans
Map<String, dynamic> result = await sync.syncAllPending();

// Response:
// {
//   'success': true/false,
//   'message': 'Synchronisé: 5, Échoué: 0',
//   'synced': 5,
//   'failed': 0
// }

// Sync specific inventory
result = await sync.syncInventaireScans(inventaireId);

// Get sync status
Map<String, dynamic> status = 
  await sync.getSyncStatus(inventaireId);
// {
//   'unsyncedCount': 5,
//   'totalArticles': 50,
//   'syncedCount': 45,
//   'isOffline': true
// }

// Cleanup after completion
await sync.cleanupCompletedInventaire(inventaireId);
```

---

## InventoryService

Enhanced with offline-first methods.

### Download Articles

```dart
// Download articles for offline use
Map<String, dynamic> result = 
  await _inventoryService.downloadArticles(inventaireId);

// Response:
// {
//   'success': true,
//   'message': 'Articles téléchargés: 50',
//   'articles_count': 50
// }
```

### Local Scanning

```dart
// Record scan locally (offline mode)
Map<String, dynamic> result = 
  await _inventoryService.recordScanLocally(
    inventaireId: 1,
    codeBarres: '123456',
    ligneInventaireId: 10,
    articleName: 'Article A',
    quantiteComptee: 1,
  );

// Response:
// {
//   'success': true,
//   'message': 'Scan enregistré localement',
//   'article': {'nom': '...', 'code_barres': '...'}
// }
```

### Check Download Status

```dart
// Check if articles are downloaded
bool downloaded = 
  await _inventoryService.areArticlesDownloaded(inventaireId);

// Get local articles
List<Map<String, dynamic>> articles = 
  await _inventoryService.getLocalArticles(inventaireId);

// Find article by barcode locally
Map<String, dynamic>? article = 
  await _inventoryService.getLocalArticleByBarcode('123456');

// Get sync statistics
Map<String, dynamic> stats = 
  await _inventoryService.getSyncStats(inventaireId);
// {
//   'unsyncedCount': 5,
//   'totalArticles': 50,
//   'syncedCount': 45
// }
```

---

## Usage Examples

### Example 1: Download and Start Scanning

```dart
// On "Démarrer" button click
Future<void> _handleStart() async {
  setState(() => _isStarting = true);
  
  try {
    // Start inventory on server
    await _inventoryService.startInventaire(inventoryId);
    
    // Download articles locally
    await _inventoryService.downloadArticles(inventoryId);
    
    // Start auto-sync
    _syncService.startAutoSync();
    
    // Navigate to scan page
    Navigator.push(context, MaterialPageRoute(...));
  } catch (e) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Error: $e')),
    );
  } finally {
    setState(() => _isStarting = false);
  }
}
```

### Example 2: Handle Online/Offline Scan

```dart
Future<void> _handleScan(String barcode) async {
  // Try online first
  final result = await _inventoryService.scanBarcode(
    inventoryId, barcode
  );
  
  if (result['success'] == true) {
    // Online success
    setState(() {
      _isOnline = true;
      _snackMessage = 'Scanné avec succès';
    });
  } else {
    // Try offline recording
    final localResult = await _inventoryService.recordScanLocally(
      inventaireId: inventoryId,
      codeBarres: barcode,
      ligneInventaireId: article['ligne_inventaire_id'],
    );
    
    if (localResult['success'] == true) {
      setState(() {
        _isOnline = false;
        _snackMessage = '📱 Enregistré localement';
      });
      
      // Update unsynced count
      await _updateUnsyncedCount();
    }
  }
}
```

### Example 3: Manual Sync with UI Feedback

```dart
Future<void> _handleSync() async {
  setState(() => _isSyncing = true);
  
  try {
    final result = await _syncService.syncInventaireScans(inventoryId);
    
    if (result['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message'] ?? 'Synchronisé'),
          backgroundColor: Colors.green,
        ),
      );
      
      // Refresh UI
      await _loadSyncStatus();
    } else {
      throw Exception(result['message']);
    }
  } catch (e) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Erreur: $e'),
        backgroundColor: Colors.red,
      ),
    );
  } finally {
    setState(() => _isSyncing = false);
  }
}
```

### Example 4: Monitor Sync Status

```dart
@override
void initState() {
  super.initState();
  
  // Listen to sync status changes
  _syncService.addStatusListener((status) {
    setState(() {
      _isSyncing = status.issyncing;
      if (!status.issyncing) {
        _loadSyncStatus(); // Refresh UI
      }
    });
  });
  
  // Start monitoring
  _loadSyncStatus();
}

@override
void dispose() {
  _syncService.removeStatusListener(_onSyncStatusChanged);
  super.dispose();
}
```

### Example 5: Cleanup After Completion

```dart
// After inventory is marked as "terminé"
await _syncService.cleanupCompletedInventaire(inventoryId);

// Or manually via database
await _db.cleanupInventaireData(inventoryId);
```

---

## Error Handling

### Network Errors
```dart
try {
  await _syncService.syncAllPending();
} catch (e) {
  if (e.toString().contains('Network')) {
    // Retry will happen automatically
    print('Network error, retrying in 30s');
  }
}
```

### Missing Articles
```dart
final article = await _db.getArticleByBarcode(barcode);
if (article == null) {
  // Article not in local database
  _showError('Article not found. Download articles first.');
}
```

### Database Errors
```dart
try {
  await _db.insertLocalScan(...);
} on DatabaseException catch (e) {
  print('Database error: $e');
  // Handle accordingly
}
```

---

## Performance Tips

1. **Use batch insert** for multiple articles
   ```dart
   await db.insertArticles(articles); // Faster than loop
   ```

2. **Limit sync batch size**
   ```dart
   // Sync max 100 scans at a time
   List<Map> unsynced = await db.getUnsyncedScans();
   for (int i = 0; i < unsynced.length; i += 100) {
     // Process batch
   }
   ```

3. **Clean old data regularly**
   ```dart
   await db.cleanupOldData(daysOld: 30); // Weekly
   ```

4. **Monitor database size**
   ```dart
   // Keep under 100 MB
   ```

---

## Constants & Configuration

```dart
// SyncService
const Duration DEFAULT_SYNC_INTERVAL = Duration(seconds: 30);
const int MAX_BATCH_SIZE = 100;

// DatabaseService
const String DB_NAME = 'stokly.db';
const int DB_VERSION = 1;

// InventoryService
const String API_BASE = 'https://your-api.com';
```

---

## Testing Checklist

- [ ] Articles downloaded on start
- [ ] Scans recorded locally when offline
- [ ] Auto-sync triggers every 30s
- [ ] Manual sync works
- [ ] UI shows online/offline status
- [ ] Sync button appears when needed
- [ ] Data cleaned after completion
- [ ] No data loss on crash
- [ ] Error messages user-friendly

---

**API Version:** 1.0.0  
**Last Updated:** May 2026
