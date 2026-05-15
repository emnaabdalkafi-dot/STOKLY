## Backend Integration Guide - Offline-First Synchronization

Cette guide explique les modifications nécessaires dans le backend Laravel pour supporter le système offline-first du client mobile.

---

## 1. Endpoint existant: `POST /inventaires/{id}/scan`

### Modifications requises

L'endpoint doit pouvoir traiter les scans tant du client online que offline. Voici le flux :

```php
// app/Http/Controllers/InventaireController.php

public function scan(Request $request, $id)
{
    $request->validate([
        'code_barres' => 'required|string',
        'quantite_comptee' => 'integer|default:1', // NOUVEAU
        'ligne_inventaire_id' => 'integer|nullable', // NOUVEAU - aide à identifier l'article
    ]);

    $inventaire = Inventaire::findOrFail($id);
    $codeBarres = $request->input('code_barres');
    $quantiteComptee = $request->input('quantite_comptee', 1);
    $ligneInventaireId = $request->input('ligne_inventaire_id');

    // 1. Trouver l'article par code-barres
    $article = Article::where('code_barres', $codeBarres)->firstOrFail();

    // 2. Trouver ou créer un enregistrement dans `scans`
    $scan = Scan::updateOrCreate(
        [
            'inventaire_id' => $id,
            'ligne_inventaire_id' => $ligneInventaireId ?? $article->ligne_inventaire_id,
            'code_barres' => $codeBarres,
        ],
        [
            'quantite_comptee' => $quantiteComptee,
            'agent_id' => auth()->id(),
            'created_at' => now(),
        ]
    );

    // 3. Mettre à jour la quantité comptée dans `ligne_inventaire`
    $ligneInventaire = LigneInventaire::findOrFail($scan->ligne_inventaire_id);
    $totalQuantite = Scan::where('ligne_inventaire_id', $ligneInventaire->id)
        ->sum('quantite_comptee');
    
    $ligneInventaire->update([
        'quantite_comptee' => $totalQuantite,
    ]);

    // 4. Retourner une réponse conforme aux attentes du client
    return response()->json([
        'success' => true,
        'message' => 'Scan enregistré avec succès',
        'data' => [
            'scan_id' => $scan->id,
            'quantite_comptee' => $scan->quantite_comptee,
            'article' => [
                'id' => $article->id,
                'nom' => $article->nom,
                'code_barres' => $article->code_barres,
            ],
            'ligne_inventaire' => [
                'id' => $ligneInventaire->id,
                'quantite_comptee' => $ligneInventaire->quantite_comptee,
            ],
        ],
    ]);
}
```

---

## 2. Nouveau Endpoint: `GET /inventaires/{id}/articles`

Cet endpoint est utilisé par le client pour télécharger les articles essentiels au moment du démarrage.

```php
// app/Http/Controllers/InventaireController.php

/**
 * Retourner les articles essentiels pour le mode offline
 * Utilisé par le client au démarrage de l'inventaire
 */
public function articles($id)
{
    $inventaire = Inventaire::with(['lignes.article'])->findOrFail($id);

    $articles = [];
    foreach ($inventaire->lignes as $ligne) {
        if ($ligne->article) {
            $articles[] = [
                'id' => $ligne->article->id,
                'code_barres' => $ligne->article->code_barres,
                'nom' => $ligne->article->nom,
                'ligne_inventaire_id' => $ligne->id,
            ];
        }
    }

    return response()->json([
        'success' => true,
        'message' => 'Articles téléchargés',
        'data' => $articles,
    ]);
}
```

**Routes:**
```php
// routes/api.php
Route::post('/inventaires/{id}/scan', [InventaireController::class, 'scan']);
Route::get('/inventaires/{id}/articles', [InventaireController::class, 'articles']);
```

---

## 3. Migration de la table `scans`

Si la table n'existe pas, la créer avec les champs nécessaires:

```php
// database/migrations/YYYY_MM_DD_HHMMSS_create_scans_table.php

Schema::create('scans', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('inventaire_id');
    $table->unsignedBigInteger('ligne_inventaire_id');
    $table->string('code_barres');
    $table->integer('quantite_comptee')->default(1);
    $table->unsignedBigInteger('agent_id')->nullable();
    $table->text('remarque')->nullable();
    $table->timestamps();
    $table->softDeletes();

    $table->foreign('inventaire_id')->references('id')->on('inventaires');
    $table->foreign('ligne_inventaire_id')->references('id')->on('ligne_inventaire');
    $table->foreign('agent_id')->references('id')->on('users');

    // Index pour les requêtes rapides
    $table->index(['inventaire_id', 'created_at']);
    $table->unique(['inventaire_id', 'ligne_inventaire_id', 'code_barres'], 'scans_unique');
});
```

---

## 4. Model `Scan`

```php
// app/Models/Scan.php

class Scan extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'inventaire_id',
        'ligne_inventaire_id',
        'code_barres',
        'quantite_comptee',
        'agent_id',
        'remarque',
    ];

    public function inventaire()
    {
        return $this->belongsTo(Inventaire::class);
    }

    public function ligneInventaire()
    {
        return $this->belongsTo(LigneInventaire::class);
    }

    public function agent()
    {
        return $this->belongsTo(User::class, 'agent_id');
    }
}
```

---

## 5. Modifications du Model `Inventaire`

```php
// app/Models/Inventaire.php

class Inventaire extends Model
{
    // ... propriétés existantes ...

    public function scans()
    {
        return $this->hasMany(Scan::class);
    }

    /**
     * Récupérer le nombre de scans pour cet inventaire
     */
    public function getScanCountAttribute()
    {
        return $this->scans()->count();
    }

    /**
     * Vérifier si tous les articles ont été comptabilisés
     */
    public function isComplete()
    {
        return $this->lignes()
            ->where('quantite_comptee', '<=', 0)
            ->count() === 0;
    }
}
```

---

## 6. Endpoint d'arrêt: `POST /inventaires/{id}/stop`

Mettre à jour le statut et nettoyer si nécessaire:

```php
public function stop($id)
{
    $inventaire = Inventaire::findOrFail($id);

    // 1. Marquer comme terminé
    $inventaire->update([
        'statut' => 'termine',
        'date_fin_reel' => now(),
    ]);

    // 2. Broadcaster le changement aux autres agents (optionnel)
    broadcast(new InventaireTerminated($inventaire));

    return response()->json([
        'success' => true,
        'message' => 'Inventaire arrêté et marqué comme terminé',
        'data' => $inventaire,
    ]);
}
```

---

## 7. Gestion des doublons et de la synchronisation

### Problème: Doublons lors de la synchronisation

Si le même scan est envoyé plusieurs fois (retry du client), utiliser `updateOrCreate`:

```php
Scan::updateOrCreate(
    [
        'inventaire_id' => $id,
        'ligne_inventaire_id' => $ligneInventaireId,
        'code_barres' => $codeBarres,
    ], // Clés uniques
    [
        'quantite_comptee' => $quantiteComptee,
        'agent_id' => auth()->id(),
        'created_at' => now(),
    ] // Valeurs à mettre à jour
);
```

### Utiliser les transactions

```php
DB::transaction(function () use ($inventaire, $codeBarres) {
    $scan = Scan::updateOrCreate([...], [...]);
    
    $ligneInventaire = LigneInventaire::lockForUpdate()
        ->find($scan->ligne_inventaire_id);
    
    $ligneInventaire->update([...]);
});
```

---

## 8. Rapport de synchronisation (optionnel)

Pour tracker les scans synchronisés:

```php
// Ajouter à la migration de `scans`
$table->boolean('synced_from_offline')->default(false); // Vrai si venant du client offline
```

---

## 9. Performance et Indexation

Ajouter des index pour optimiser les requêtes:

```php
// dans la migration
$table->index('code_barres');
$table->index('inventaire_id');
$table->index(['inventaire_id', 'ligne_inventaire_id']);
```

---

## 10. Tests

### Test du scan online
```bash
POST /api/inventaires/1/scan
{
  "code_barres": "123456",
  "quantite_comptee": 1,
  "ligne_inventaire_id": 10
}

Response:
{
  "success": true,
  "message": "Scan enregistré avec succès",
  "data": {
    "scan_id": 1,
    "quantite_comptee": 1,
    "article": {
      "id": 5,
      "nom": "Article A",
      "code_barres": "123456"
    }
  }
}
```

### Test du téléchargement d'articles
```bash
GET /api/inventaires/1/articles

Response:
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

## Résumé des changements

| Component | Action | Impact |
|-----------|--------|--------|
| Table `scans` | Créer si n'existe pas | Stocker les scans |
| Model `Scan` | Créer | ORM pour scans |
| Endpoint `POST /scan` | Modifier | Accepter `quantite_comptee` |
| Endpoint `GET /articles` | Créer | Pour téléchargement offline |
| Endpoint `POST /stop` | Modifier | Marquer comme terminé |
| Index `scans` | Ajouter | Performance |

---

## Notes de sécurité

1. **Authentification**: Les endpoints doivent valider le token Bearer
2. **Autorisation**: Vérifier que l'agent peut scanner pour cet inventaire
3. **Validation**: Valider `code_barres` et `quantite_comptee`
4. **Rate Limiting**: Limiter les requêtes POST à 100/minute par agent

```php
// Middleware Rate Limit
Route::middleware('throttle:100,1')->post('/inventaires/{id}/scan', [...]);
```

---

## Déploiement

1. Exécuter les migrations
2. Créer les models si nécessaire
3. Mettre à jour les routes
4. Tester avec le client mobile
5. Monitorer les logs pour les erreurs
