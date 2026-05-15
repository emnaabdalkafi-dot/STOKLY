import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class DatabaseService {
  static final DatabaseService _instance = DatabaseService._internal();
  static Database? _database;

  factory DatabaseService() {
    return _instance;
  }

  DatabaseService._internal();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB();
    return _database!;
  }

  Future<Database> _initDB() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'stokly.db');

    return openDatabase(
      path,
      version: 3,
      onCreate: (db, version) async {
        await _createTables(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          // Drop articles table to fix NOT NULL constraint on ligne_inventaire_id
          await db.execute('DROP TABLE IF EXISTS articles');
          await _createArticlesTable(db);
        }
        if (oldVersion < 3) {
          // Add id_entrepot column if it doesn't exist
          try {
            await db.execute('ALTER TABLE articles ADD COLUMN id_entrepot INTEGER');
          } catch (_) {
            // Table might already have it or need recreation
          }
        }
      },
    );
  }

  Future<void> _createTables(Database db) async {
        await _createArticlesTable(db);

        // Table pour stocker les scans/quantités localement
        await db.execute('''
          CREATE TABLE local_scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inventaire_id INTEGER NOT NULL,
            ligne_inventaire_id INTEGER NOT NULL,
            code_barres TEXT NOT NULL,
            article_nom TEXT,
            quantite_comptee INTEGER DEFAULT 1,
            synced INTEGER DEFAULT 0,
            sync_error TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        ''');

        // Table pour tracker les inventaires téléchargés localement
        await db.execute('''
          CREATE TABLE inventaire_downloads (
            inventaire_id INTEGER PRIMARY KEY,
            status TEXT DEFAULT 'in_progress',
            downloaded_at TEXT,
            articles_count INTEGER,
            synced_count INTEGER DEFAULT 0
          )
        ''');
  }

  Future<void> _createArticlesTable(Database db) async {
    await db.execute('''
      CREATE TABLE articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_barres TEXT NOT NULL,
        nom TEXT NOT NULL,
        ligne_inventaire_id INTEGER NOT NULL,
        inventaire_id INTEGER NOT NULL,
        id_entrepot INTEGER,
        created_at TEXT,
        updated_at TEXT
      )
    ''');
    // Important: we remove the UNIQUE constraint on code_barres because an article can be in multiple warehouses
    await db.execute('CREATE INDEX idx_articles_barcode ON articles (code_barres)');
  }

  // ======== ARTICLES ========

  /// Insérer ou mettre à jour un article
  Future<void> insertArticle(Map<String, dynamic> article) async {
    final db = await database;
    await db.insert(
      'articles',
      {
        ...article,
        'created_at': article['created_at'] ?? DateTime.now().toIso8601String(),
        'updated_at': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Insérer plusieurs articles en une transaction
  Future<void> insertArticles(List<Map<String, dynamic>> articles) async {
    final db = await database;
    final batch = db.batch();
    for (var article in articles) {
      batch.insert(
        'articles',
        {
          ...article,
          'created_at': article['created_at'] ?? DateTime.now().toIso8601String(),
          'updated_at': DateTime.now().toIso8601String(),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit();
  }

  /// Récupérer tous les articles d'un inventaire
  Future<List<Map<String, dynamic>>> getArticlesByInventaire(int inventaireId) async {
    final db = await database;
    return db.query(
      'articles',
      where: 'inventaire_id = ?',
      whereArgs: [inventaireId],
    );
  }

  /// Trouver un article par code-barres (et optionnellement par entrepôt)
  Future<Map<String, dynamic>?> getArticleByBarcode(String barcode, {int? idEntrepot}) async {
    final db = await database;
    
    if (idEntrepot != null) {
      final results = await db.query(
        'articles',
        where: 'code_barres = ? AND id_entrepot = ?',
        whereArgs: [barcode, idEntrepot],
        limit: 1,
      );
      if (results.isNotEmpty) return results.first;
    }

    // Fallback search or if idEntrepot is null
    final results = await db.query(
      'articles',
      where: 'code_barres = ?',
      whereArgs: [barcode],
      limit: 1,
    );
    return results.isNotEmpty ? results.first : null;
  }

  /// Supprimer tous les articles d'un inventaire
  Future<void> deleteArticlesByInventaire(int inventaireId) async {
    final db = await database;
    await db.delete(
      'articles',
      where: 'inventaire_id = ?',
      whereArgs: [inventaireId],
    );
  }

  // ======== LOCAL SCANS ========

  /// Insérer un nouveau scan local
  Future<int> insertLocalScan(Map<String, dynamic> scan) async {
    final db = await database;
    return db.insert(
      'local_scans',
      {
        ...scan,
        'synced': 0,
        'created_at': scan['created_at'] ?? DateTime.now().toIso8601String(),
        'updated_at': DateTime.now().toIso8601String(),
      },
    );
  }

  /// Récupérer tous les scans non synchronisés
  Future<List<Map<String, dynamic>>> getUnsyncedScans() async {
    final db = await database;
    return db.query(
      'local_scans',
      where: 'synced = 0',
      orderBy: 'created_at ASC',
    );
  }

  /// Récupérer tous les scans non synchronisés pour un inventaire
  Future<List<Map<String, dynamic>>> getUnsyncedScansByInventaire(int inventaireId) async {
    final db = await database;
    return db.query(
      'local_scans',
      where: 'synced = 0 AND inventaire_id = ?',
      whereArgs: [inventaireId],
      orderBy: 'created_at ASC',
    );
  }

  /// Marquer un scan comme synchronisé
  Future<void> markScanAsSynced(int scanId) async {
    final db = await database;
    await db.update(
      'local_scans',
      {
        'synced': 1,
        'sync_error': null,
        'updated_at': DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [scanId],
    );
  }

  /// Marquer un scan comme échoué avec erreur
  Future<void> markScanAsSyncFailed(int scanId, String error) async {
    final db = await database;
    await db.update(
      'local_scans',
      {
        'synced': 0,
        'sync_error': error,
        'updated_at': DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [scanId],
    );
  }

  /// Récupérer tous les scans pour un inventaire (paginé)
  Future<List<Map<String, dynamic>>> getScansByInventaire(int inventaireId, {int limit = 100, int offset = 0}) async {
    final db = await database;
    return db.query(
      'local_scans',
      where: 'inventaire_id = ?',
      whereArgs: [inventaireId],
      orderBy: 'created_at DESC',
      limit: limit,
      offset: offset,
    );
  }

  /// Compter les scans non synchronisés pour un inventaire
  Future<int> countUnsyncedScans(int inventaireId) async {
    final db = await database;
    final result = await db.rawQuery(
      'SELECT COUNT(*) as count FROM local_scans WHERE synced = 0 AND inventaire_id = ?',
      [inventaireId],
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  /// Supprimer les scans synchronisés d'un inventaire
  Future<void> deleteSyncedScans(int inventaireId) async {
    final db = await database;
    await db.delete(
      'local_scans',
      where: 'inventaire_id = ? AND synced = 1',
      whereArgs: [inventaireId],
    );
  }

  // ======== INVENTAIRE DOWNLOADS ========

  /// Enregistrer le téléchargement d'un inventaire
  Future<void> recordDownload(int inventaireId, int articlesCount) async {
    final db = await database;
    await db.insert(
      'inventaire_downloads',
      {
        'inventaire_id': inventaireId,
        'status': 'completed',
        'downloaded_at': DateTime.now().toIso8601String(),
        'articles_count': articlesCount,
        'synced_count': 0,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Vérifier si un inventaire a été téléchargé
  Future<bool> isInventaireDownloaded(int inventaireId) async {
    final db = await database;
    final results = await db.query(
      'inventaire_downloads',
      where: 'inventaire_id = ? AND status = ?',
      whereArgs: [inventaireId, 'completed'],
      limit: 1,
    );
    return results.isNotEmpty;
  }

  /// Obtenir les stats de téléchargement
  Future<Map<String, dynamic>?> getDownloadStats(int inventaireId) async {
    final db = await database;
    final results = await db.query(
      'inventaire_downloads',
      where: 'inventaire_id = ?',
      whereArgs: [inventaireId],
      limit: 1,
    );
    return results.isNotEmpty ? results.first : null;
  }

  /// Mettre à jour le compteur de synchronisés
  Future<void> updateSyncedCount(int inventaireId, int count) async {
    final db = await database;
    await db.update(
      'inventaire_downloads',
      {'synced_count': count},
      where: 'inventaire_id = ?',
      whereArgs: [inventaireId],
    );
  }

  /// Supprimer un enregistrement de téléchargement
  Future<void> deleteDownloadRecord(int inventaireId) async {
    final db = await database;
    await db.delete(
      'inventaire_downloads',
      where: 'inventaire_id = ?',
      whereArgs: [inventaireId],
    );
  }

  // ======== UTILITIES ========

  /// Nettoyer toutes les données locales d'un inventaire (après synchronisation complète)
  Future<void> cleanupInventaireData(int inventaireId) async {
    final db = await database;
    final batch = db.batch();

    // Supprimer les scans synchronisés
    batch.delete(
      'local_scans',
      where: 'inventaire_id = ? AND synced = 1',
      whereArgs: [inventaireId],
    );

    // Supprimer les articles
    batch.delete(
      'articles',
      where: 'inventaire_id = ?',
      whereArgs: [inventaireId],
    );

    // Supprimer l'enregistrement de téléchargement
    batch.delete(
      'inventaire_downloads',
      where: 'inventaire_id = ?',
      whereArgs: [inventaireId],
    );

    await batch.commit();
  }

  /// Nettoyer les données anciennes (optionnel)
  Future<void> cleanupOldData({int daysOld = 30}) async {
    final db = await database;
    final cutoffDate = DateTime.now().subtract(Duration(days: daysOld)).toIso8601String();

    await db.delete(
      'local_scans',
      where: 'synced = 1 AND updated_at < ?',
      whereArgs: [cutoffDate],
    );
  }

  /// Fermer la base de données
  Future<void> close() async {
    if (_database != null) {
      await _database!.close();
      _database = null;
    }
  }
}
