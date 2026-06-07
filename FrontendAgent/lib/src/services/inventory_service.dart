import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/api_constants.dart';
import 'database_service.dart';

class InventoryService {
  final String baseUrl = ApiConstants.baseUrl;

  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  /// GET /agents/inventories
  Future<Map<String, dynamic>> getInventories({String? status, String? search}) async {
    try {
      final token = await _getToken();
      final queryParams = <String, String>{};
      if (status != null && status.isNotEmpty) queryParams['statut'] = status;
      if (search != null && search.isNotEmpty) queryParams['search'] = search;

      final uri = Uri.parse('$baseUrl/agents/inventories')
          .replace(queryParameters: queryParams.isNotEmpty ? queryParams : null);

      final response = await http.get(uri, headers: {
        'Authorization': 'Bearer $token',
        'Accept': 'application/json',
      });

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return {'success': true, 'data': data['data'] ?? []};
      } else {
        return {'success': false, 'message': 'Erreur ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'La connexion Internet est interrompue. Veuillez vérifier votre réseau.'};
    }
  }

  /// GET /inventaires/{id}
  Future<Map<String, dynamic>> getInventoryDetails(int id) async {
    try {
      final token = await _getToken();
      final response = await http.get(
        Uri.parse('$baseUrl/inventaires/$id'),
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return {'success': true, 'data': data['data']};
      } else {
        return {'success': false, 'message': 'Erreur ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'La connexion Internet est interrompue. Veuillez vérifier votre réseau.'};
    }
  }

  /// POST /inventaires/{id}/start — Démarrer l'inventaire
  Future<Map<String, dynamic>> startInventaire(int id) async {
    try {
      final token = await _getToken();
      final response = await http.post(
        Uri.parse('$baseUrl/inventaires/$id/start'),
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return {'success': true, 'data': data['data']};
      } else {
        return {'success': false, 'message': 'Erreur ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'La connexion Internet est interrompue. Veuillez vérifier votre réseau.'};
    }
  }

  /// POST /inventaires/{id}/stop — Arrêter l'inventaire
  Future<Map<String, dynamic>> stopInventaire(int id) async {
    try {
      final token = await _getToken();
      final response = await http.post(
        Uri.parse('$baseUrl/inventaires/$id/stop'),
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        return {'success': true};
      } else {
        return {'success': false, 'message': 'Erreur ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'La connexion Internet est interrompue. Veuillez vérifier votre réseau.'};
    }
  }

  /// POST /inventaires/{id}/scan — Scanner un code-barres
  Future<Map<String, dynamic>> scanBarcode(int inventaireId, String codeBarres, {int quantite = 1, int? idEntrepot}) async {
    try {
      final token = await _getToken();
      final response = await http.post(
        Uri.parse('$baseUrl/inventaires/$inventaireId/scan'),
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: json.encode({
          'code_barres': codeBarres,
          'quantite': quantite,
          if (idEntrepot != null) 'id_entrepot': idEntrepot,
        }),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, ...data};
      } else {
        return {'success': false, ...data};
      }
    } catch (e) {
      return {'success': false, 'message': 'La connexion Internet est interrompue. Veuillez vérifier votre réseau.'};
    }
  }

  /// POST /inventaires/{id}/add-known-article
  Future<Map<String, dynamic>> addKnownArticleToInventory(int inventaireId, String codeBarres, {int quantite = 1, int? idEntrepot}) async {
    try {
      final token = await _getToken();
      final response = await http.post(
        Uri.parse('$baseUrl/inventaires/$inventaireId/add-known-article'),
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: json.encode({
          'code_barres': codeBarres,
          'quantite': quantite,
          if (idEntrepot != null) 'id_entrepot': idEntrepot,
        }),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 201) {
        return {'success': true, ...data};
      } else {
        return {'success': false, ...data};
      }
    } catch (e) {
      return {'success': false, 'message': 'La connexion Internet est interrompue. Veuillez vérifier votre réseau.'};
    }
  }

  /// GET /inventaires/{id}/notes
  Future<Map<String, dynamic>> getNotes(int inventoryId, {String? filter, String? search}) async {
    try {
      final token = await _getToken();
      final queryParams = <String, String>{};
      if (filter != null && filter.isNotEmpty) queryParams['filter'] = filter;
      if (search != null && search.isNotEmpty) queryParams['search'] = search;

      final uri = Uri.parse('$baseUrl/inventaires/$inventoryId/notes')
          .replace(queryParameters: queryParams.isNotEmpty ? queryParams : null);

      final response = await http.get(uri, headers: {
        'Authorization': 'Bearer $token',
        'Accept': 'application/json',
      });

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return {'success': true, 'data': data['data'] ?? []};
      } else {
        return {'success': false, 'message': 'Erreur ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Erreur réseau: $e'};
    }
  }

  /// POST /inventaires/{id}/notes
  Future<Map<String, dynamic>> addNote({required int inventoryId, required String content}) async {
    try {
      final token = await _getToken();
      final response = await http.post(
        Uri.parse('$baseUrl/inventaires/$inventoryId/notes'),
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: json.encode({
          'contenu': content,
        }),
      );

      final data = json.decode(response.body);
      if (response.statusCode == 201) {
        return {'success': true, 'message': 'Note envoyée', 'data': data['data']};
      } else {
        return {'success': false, 'message': data['message'] ?? 'Erreur ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Erreur réseau: $e'};
    }
  }

  /// PUT /inventaires/notes/{id}
  Future<Map<String, dynamic>> updateNote({required int noteId, required String content}) async {
    try {
      final token = await _getToken();
      final response = await http.put(
        Uri.parse('$baseUrl/inventaires/notes/$noteId'),
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: json.encode({'contenu': content}),
      );

      final data = json.decode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'message': 'Note modifiée', 'data': data['data']};
      } else {
        return {'success': false, 'message': data['message'] ?? 'Erreur ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Erreur réseau: $e'};
    }
  }

  /// DELETE /inventaires/notes/{id}
  Future<Map<String, dynamic>> deleteNote(int noteId) async {
    try {
      final token = await _getToken();
      final response = await http.delete(
        Uri.parse('$baseUrl/inventaires/notes/$noteId'),
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        return {'success': true, 'message': 'Note supprimée'};
      } else {
        final data = json.decode(response.body);
        return {'success': false, 'message': data['message'] ?? 'Erreur ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Erreur réseau: $e'};
    }
  }

  /// PUT /inventaires/notes/{id}/read
  Future<Map<String, dynamic>> markNoteAsRead(int noteId) async {
    try {
      final token = await _getToken();
      final response = await http.put(
        Uri.parse('$baseUrl/inventaires/notes/$noteId/read'),
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        return {'success': true};
      } else {
        return {'success': false, 'message': 'Erreur ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Erreur réseau: $e'};
    }
  }

  /// POST correction
  Future<Map<String, dynamic>> submitCorrection({
    required int ligneInventaireId,
    required int quantity,
    required String remark,
    String? articleCode,
    int? entrepotId,
  }) async {
    try {
      final token = await _getToken();
      final response = await http.post(
        Uri.parse('$baseUrl/corrections'),
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: json.encode({
          'id_ligne_inventaire': ligneInventaireId,
          'qte': quantity,
          'description': remark,
          if (articleCode != null) 'article_code': articleCode,
          if (entrepotId != null) 'id_entrepot': entrepotId,
        }),
      );

      final data = json.decode(response.body);
      if (response.statusCode == 201) {
        return {'success': true, 'message': data['message'] ?? 'Demande de correction envoyée', 'data': data['data']};
      }
      return {'success': false, 'message': data['message'] ?? 'Erreur ${response.statusCode}'};
    } catch (e) {
      return {'success': false, 'message': 'La connexion Internet est interrompue. Veuillez vérifier votre réseau.'};
    }
  }

  /// ========== OFFLINE-FIRST METHODS ==========

  /// Télécharger les articles essentiels pour un inventaire
  /// Extrait: barcode, nom, ligne_inventaire_id depuis les lignes de l'inventaire
  Future<Map<String, dynamic>> downloadArticles(int inventaireId) async {
    final db = DatabaseService();
    
    try {
      // Étape 1: Vérifier si déjà téléchargé
      final bool isDownloaded = await db.isInventaireDownloaded(inventaireId);
      if (isDownloaded) {
        return {
          'success': true,
          'message': 'Base locale déjà prête',
          'already_downloaded': true
        };
      }

      final token = await _getToken();
      final response = await http.get(
        Uri.parse('$baseUrl/inventaires/$inventaireId'),
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final inventaire = data['data'];
        final lignes = (inventaire['lignes'] as List?) ?? [];

        // Extraire les articles essentiels
        final articles = <Map<String, dynamic>>[];
        for (var ligne in lignes) {
          final article = ligne['article'];
          if (article != null) {
            articles.add({
              'code_barres': article['code_barres'] ?? '',
              'nom': article['nom'] ?? 'Article #${article['id_article']}',
              'ligne_inventaire_id': ligne['id_ligne'],
              'inventaire_id': inventaireId,
              'id_entrepot': ligne['id_entrepot'],
            });
          }
        }

        // Enregistrer en base locale
        if (articles.isNotEmpty) {
          final db = DatabaseService();
          await db.insertArticles(articles);
          await db.recordDownload(inventaireId, articles.length);
        }

        return {
          'success': true,
          'message': 'Articles téléchargés: ${articles.length}',
          'articles_count': articles.length,
        };
      } else {
        return {'success': false, 'message': 'Erreur ${response.statusCode}'};
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Erreur lors du téléchargement: ${e.toString()}',
      };
    }
  }

  /// Enregistrer un scan localement (mode offline)
  /// Utilisé quand le backend est indisponible
  Future<Map<String, dynamic>> recordScanLocally({
    required int inventaireId,
    required String codeBarres,
    required int ligneInventaireId,
    String? articleName,
    int quantiteComptee = 1,
    int? idEntrepot,
  }) async {
    try {
      final db = DatabaseService();

      // Vérifier que l'article existe localement
      final article = await db.getArticleByBarcode(codeBarres, idEntrepot: idEntrepot);
      if (article == null) {
        return {'success': false, 'message': 'Article non trouvé localement'};
      }

      // Enregistrer le scan
      await db.insertLocalScan({
        'inventaire_id': inventaireId,
        'ligne_inventaire_id': ligneInventaireId,
        'code_barres': codeBarres,
        'article_nom': articleName ?? article['nom'],
        'quantite_comptee': quantiteComptee,
      });

      return {
        'success': true,
        'message': 'Scan enregistré localement',
        'article': {
          'nom': article['nom'],
          'code_barres': article['code_barres'],
        },
      };
    } catch (e) {
      return {'success': false, 'message': 'Erreur: ${e.toString()}'};
    }
  }

  /// Vérifier si les articles sont téléchargés localement
  Future<bool> areArticlesDownloaded(int inventaireId) async {
    final db = DatabaseService();
    return db.isInventaireDownloaded(inventaireId);
  }

  /// Récupérer les articles locaux
  Future<List<Map<String, dynamic>>> getLocalArticles(int inventaireId) async {
    final db = DatabaseService();
    return db.getArticlesByInventaire(inventaireId);
  }

  /// Obtenir un article par code-barres (localement)
  Future<Map<String, dynamic>?> getLocalArticleByBarcode(String barcode) async {
    final db = DatabaseService();
    return db.getArticleByBarcode(barcode);
  }

  /// Obtenir les statistiques de synchronisation
  Future<Map<String, dynamic>> getSyncStats(int inventaireId) async {
    final db = DatabaseService();
    final unsyncedCount = await db.countUnsyncedScans(inventaireId);
    final stats = await db.getDownloadStats(inventaireId);

    return {
      'unsyncedCount': unsyncedCount,
      'totalArticles': stats?['articles_count'] ?? 0,
      'syncedCount': stats?['synced_count'] ?? 0,
    };
  }

  /// GET /stock/entrepots
  Future<Map<String, dynamic>> getEntrepots() async {
    try {
      final token = await _getToken();
      final response = await http.get(
        Uri.parse('$baseUrl/stock/entrepots'),
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return {'success': true, 'data': data['data'] ?? []};
      } else {
        return {'success': false, 'message': 'Erreur ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Erreur réseau: $e'};
    }
  }

  /// Proposer un article inconnu
  Future<Map<String, dynamic>> proposeArticle({
    required int inventaireId,
    required String codeBarres,
    required String nom,
    int quantite = 1,
    int? idEntrepot,
  }) async {
    try {
      final token = await _getToken();
      final response = await http.post(
        Uri.parse('$baseUrl/inventaires/$inventaireId/propose-article'),
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: json.encode({
          'code_barres': codeBarres,
          'nom': nom,
          'quantite': quantite,
          if (idEntrepot != null) 'id_entrepot': idEntrepot,
        }),
      );
      final data = json.decode(response.body);
      
      if (response.statusCode == 201) {
        final articleData = data['data']['article'];
        final idLigne = data['data']['id_ligne'];
        
        // Save to local database
        final db = DatabaseService();
        await db.insertArticle({
          'code_barres': articleData['code_barres'],
          'nom': articleData['nom'],
          'ligne_inventaire_id': idLigne,
          'inventaire_id': inventaireId,
          'id_entrepot': idEntrepot,
        });

        return {
          'success': true,
          'message': data['message'] ?? 'Article proposé',
          'data': articleData,
        };
      } else {
        return {
          'success': false,
          'message': data['message'] ?? 'Erreur ${response.statusCode}',
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Erreur réseau: $e'};
    }
  }
}
