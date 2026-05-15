## Système de Synchronisation Offline-First pour STOKLY Agent

### Vue d'ensemble

Ce système permet à l'application mobile Flutter d'être entièrement fonctionnelle sans connexion Internet. Tous les scans et les quantités sont enregistrés localement dans SQLite et synchronisés automatiquement quand la connexion est rétablie.

---

## Architecture

### 1. **DatabaseService** (`database_service.dart`)
Service responsable de la gestion de la base de données SQLite locale.

**Tables:**
- `articles` - Stocke les données essentielles des articles (code_barres, nom, ligne_inventaire_id)
- `local_scans` - Stocke les scans/quantités avec un flag `synced` (0 = non synchronisé, 1 = synchronisé)
- `inventaire_downloads` - Suit les téléchargements d'inventaires et les statistiques

**Méthodes principales:**
- `insertArticles()` - Insérer plusieurs articles en transaction
- `insertLocalScan()` - Enregistrer un scan local
- `getUnsyncedScans()` - Récupérer tous les scans non synchronisés
- `markScanAsSynced()` - Marquer un scan comme synchronisé
- `cleanupInventaireData()` - Nettoyer les données après la fin de l'inventaire

---

### 2. **SyncService** (`sync_service.dart`)
Service responsable de la synchronisation des données avec le serveur.

**Fonctionnalités:**
- Synchronisation périodique automatique (par défaut: 30 secondes)
- Synchronisation manuelle à la demande
- Gestion des erreurs de synchronisation
- System de listeners pour notifier l'UI du statut de sync

**Méthodes principales:**
- `startAutoSync()` - Démarrer la synchronisation automatique
- `stopAutoSync()` - Arrêter la synchronisation automatique
- `syncAllPending()` - Synchroniser tous les scans non synchronisés
- `syncInventaireScans()` - Synchroniser les scans d'un inventaire spécifique
- `cleanupCompletedInventaire()` - Nettoyer les données d'un inventaire terminé

---

### 3. **InventoryService** (mise à jour)
Extensions pour supporter le mode offline-first.

**Nouvelles méthodes:**
- `downloadArticles()` - Télécharger les articles essentiels et les stocker localement
- `recordScanLocally()` - Enregistrer un scan localement quand offline
- `areArticlesDownloaded()` - Vérifier si les articles sont téléchargés
- `getLocalArticles()` - Récupérer les articles locaux
- `getLocalArticleByBarcode()` - Chercher un article par code-barres localement
- `getSyncStats()` - Obtenir les statistiques de synchronisation

---

## Flux d'utilisation

### 1. **Démarrage de l'inventaire** (InventoryDetailsPage)

```
Clic sur "Démarrer"
↓
1. POST /inventaires/{id}/start (serveur)
2. Télécharger articles via downloadArticles()
   → Requête GET /inventaires/{id}
   → Extraire barcode, nom, ligne_inventaire_id
   → Enregistrer dans SQLite (table: articles)
3. Démarrer syncService.startAutoSync()
4. Naviguer vers ScanPage
```

### 2. **Scan de code-barres** (ScanPage)

**Cas Online:**
```
Scan barcode
↓
POST /inventaires/{id}/scan
↓
Succès? OUI → Afficher "Scanné avec succès" (UI: cloud_done)
```

**Cas Offline:**
```
Scan barcode
↓
Essayer POST /inventaires/{id}/scan
↓
Échec/Timeout
↓
recordScanLocally()
  ├─ Vérifier article dans SQLite
  ├─ Insérer dans local_scans (synced=0)
  └─ Afficher "📱 Enregistré localement"
↓
Afficher badge "5 non sync." en UI
```

### 3. **Synchronisation automatique** (SyncService)

```
Toutes les 30 secondes (configurable):
↓
Récupérer tous les scans avec synced=0
↓
Pour chaque scan:
  ├─ POST /inventaires/{id}/scan
  ├─ Si succès: UPDATE local_scans SET synced=1
  └─ Si échec: UPDATE sync_error
↓
Notifier listeners du résultat
```

### 4. **Synchronisation manuelle** (ScanPage)

Bouton "Synchroniser (5)" apparaît si `unsyncedCount > 0`
↓
_handleSync() → syncService.syncInventaireScans()
↓
Afficher résultat (succès/erreur)

### 5. **Fin de l'inventaire et nettoyage** (PauseMenuPage)

Après que l'inventaire est marqué comme "terminé":
```
POST /inventaires/{id}/stop
↓
Une fois synchronisation complète confirmée par backend
↓
cleanupInventaireData(inventaireId)
  ├─ DELETE FROM local_scans WHERE synced=1
  ├─ DELETE FROM articles
  └─ DELETE FROM inventaire_downloads
```

---

## Intégration Backend (Laravel)

### Endpoint: `POST /inventaires/{id}/scan`

L'endpoint existant reste inchangé. Cependant, à chaque requête, il doit:

1. **Insérer/Mettre à jour dans `scans` table:**
```sql
INSERT INTO scans (
  inventaire_id,
  ligne_inventaire_id,
  code_barres,
  quantite_comptee,
  agent_id,
  created_at
) VALUES (...)
ON DUPLICATE KEY UPDATE quantite_comptee = quantite_comptee + 1
```

2. **Mettre à jour `ligne_inventaire`:**
```sql
UPDATE ligne_inventaire
SET quantite_comptee = (
  SELECT SUM(quantite_comptee) FROM scans 
  WHERE ligne_inventaire_id = ?
)
WHERE id = ?
```

3. **Retourner une réponse confirmant l'enregistrement:**
```json
{
  "success": true,
  "message": "Scan enregistré",
  "data": {
    "article": {"id": 1, "nom": "..."},
    "quantite_comptee": 5
  }
}
```

### Nouveau Endpoint (Optionnel): `GET /inventaires/{id}/articles`

Permet d'obtenir les articles essentiels pour le mode offline:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code_barres": "123456",
      "nom": "Article A",
      "ligne_inventaire_id": 10
    }
  ]
}
```

---

## Indicateurs UI

### En ligne (Online)
- Badge vert "En ligne" avec icône `cloud_done`
- Bouton "Synchroniser" masqué si `unsyncedCount == 0`
- Scans synchronisés immédiatement

### Hors ligne (Offline)
- Badge orange "Hors ligne" avec icône `cloud_off`
- Bouton "Synchroniser (5)" visible
- Scans enregistrés localement
- Badge rouge "5 non sync." dans le header

### En cours de synchronisation
- Icône spinner sur le bouton "Synchroniser..."
- Message "Synchronisation en cours..."
- Désactiver les actions pendant la sync

---

## Configuration

### Intervalle de synchronisation automatique
```dart
_syncService.startAutoSync(interval: const Duration(seconds: 30));
```

### Nettoyage des anciennes données (optionnel)
```dart
// Nettoyer les données synchronisées de plus de 30 jours
await _db.cleanupOldData(daysOld: 30);
```

---

## Gestion des erreurs

### Erreurs de réseau
- Enregistrement local automatique
- Retry automatique lors de la reconnexion
- Affichage du badge "Hors ligne"

### Erreurs de synchronisation
- Stocker message d'erreur dans `sync_error`
- Afficher dans un rapport pour déboguer
- Retry automatique toutes les 30s

### Données corrompues
- Validation des articles avant insertion locale
- Verification de ligne_inventaire_id avant POST

---

## Statut de Synchronisation (PauseMenuPage)

Affiche un dialogue avec:
- Articles téléchargés: 50
- Scans enregistrés: 45
- En attente de sync: 5

Message: "Les données en attente seront automatiquement synchronisées quand la connexion sera disponible."

---

## Points importants

1. **Pas d'action utilisateur requise** - La synchronisation se fait automatiquement
2. **Robuste aux interruptions** - Les scans sont stockés localement, même en cas de crash
3. **Transparent** - L'utilisateur voit clairement l'état (online/offline)
4. **Évolutif** - Supporte les 1000+ articles sans ralentissement
5. **Conforme GDPR** - Données supprimées après completion

---

## Dépendances

- `sqflite: ^2.4.2` - Base de données SQLite
- `path: ^1.9.1` - Gestion des chemins
- `shared_preferences: ^2.2.0` - Stockage des préférences (token)
- `http: ^1.1.0` - Requêtes HTTP
