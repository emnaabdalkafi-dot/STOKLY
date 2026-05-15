<?php

namespace App\Services;

use App\Repositories\ArticleRepository;
use Illuminate\Support\Facades\DB;

class ArticleService
{
    protected $repository;

    public function __construct(ArticleRepository $repository)
    {
        $this->repository = $repository;
    }

    public function getAllArticles()
    {
        return $this->repository->getAll();
    }

    public function getArticleStats()
    {
        $articles = $this->repository->getAll();
        $totalArticles = $articles->count();
        
        $valeurTotal = 0;
        $ecartPositif = 0;
        $ecartNegatif = 0;
        $articlesInventoriesCount = 0;
        $totalArticlesInconnus = 0;

        foreach ($articles as $article) {
            if ($article->etat === 'inconnu') {
                $totalArticlesInconnus++;
            }
            
            $qte = $article->quantite_total ?? 0;
            $valeurTotal += ($article->prix * $qte);
            
            // On vérifie si l'article est dans au moins un inventaire non terminé
            $articlesInventories = false;
            foreach ($article->lignesInventaire as $ligne) {
                // Vérifier si l'inventaire n'est pas terminé et si l'article a été compté
                if ($ligne->inventaire && $ligne->inventaire->statut !== 'termine' ) {
                    $articlesInventories = true;
                }

                // Pour les écarts, on continue de les cumuler globalement pour les stats
                if ($ligne->quantite_comptee !== null) {
                    $ecart = $ligne->ecart;
                    if ($ecart > 0) {
                        $ecartPositif += $ecart;
                    } else {
                        $ecartNegatif += $ecart;
                    }
                }
            }

            if ($articlesInventories) {
                $articlesInventoriesCount++;
            }
        }

        return [
            'total_articles' => $totalArticles,
            'valeur_totale_stock' => $valeurTotal,
            'ecart_positif' => $ecartPositif,
            'ecart_negatif' => $ecartNegatif,
            'pourcentage_inventories' => $totalArticles > 0 ? round(($articlesInventoriesCount / $totalArticles) * 100, 2) : 0,
            'total_articles_inconnus' => $totalArticlesInconnus,
        ];
    }

    public function createArticle(array $data)
    {
        return DB::transaction(function () use ($data) {
            $articleData = [
                'code_barres' => $data['code_barres'],
                'nom' => $data['nom'],
                'prix' => $data['prix'] ?? 0,
                'etat' => $data['etat'] ?? 'connu',
            ];
            
            $article = $this->repository->create($articleData);

            if (isset($data['categories'])) {
                $this->repository->syncCategories($article, $data['categories']);
            }

if (!empty($data['entrepots'])){
    $syncData = [];
    $total = 0;

    foreach ($data['entrepots'] as $ent) {
        $qte = $ent['quantite'] ?? ($ent['quantite_theorique'] ?? 0);
        $syncData[$ent['id_entrepot']] = ['quantite' => $qte];
        $total += $qte;
    }

    $article->quantite_total = $total;
    $article->save();

    $this->repository->syncEntrepots($article, $syncData);
} else {
    $article->quantite_total = $data['quantite_total'] ?? 0;
    $article->save();

    $this->repository->syncEntrepots($article, []);
}
           
            return $article->load(['categories', 'entrepots']);
        });
    }

    public function updateArticle($id, array $data)
    {
        return DB::transaction(function () use ($id, $data) {
            $article = $this->repository->findById($id);
            
            $oldEtat = $article->etat;
            $articleData = array_intersect_key($data, array_flip(['code_barres', 'nom', 'prix', 'etat']));
            $this->repository->update($article, $articleData);

            // Cleanup notifications if marked as connu
            if (isset($data['etat']) && $data['etat'] === 'connu' && $oldEtat === 'inconnu') {
                $notifs = \App\Models\Notification::where('statut', false)->get();
                foreach ($notifs as $n) {
                    $decoded = json_decode($n->contenu, true);
                    if ($decoded && isset($decoded['article_id']) && (int)$decoded['article_id'] === (int)$id) {
                        $n->statut = true;
                        $n->save();
                    }
                }
            }

            if (isset($data['categories'])) {
                $this->repository->syncCategories($article, $data['categories']);
            }

  if (!empty($data['entrepots'])){

    $syncData = [];
    $total = 0;

    foreach ($data['entrepots'] as $ent) {
        if (isset($ent['id_entrepot'])) {
            $qte = $ent['quantite'] ?? ($ent['quantite_theorique'] ?? 0);
            $syncData[$ent['id_entrepot']] = ['quantite' => $qte];
            $total += $qte;
        }
    }

    $article->quantite_total = $total;
    $article->save();

    $this->repository->syncEntrepots($article, $syncData);

} else {
    if (isset($data['quantite_total'])) {
        $article->quantite_total = $data['quantite_total'];
        $article->save();
    }

    $this->repository->syncEntrepots($article, []);
            }

            return $article->load(['categories', 'entrepots']);
        });
    }

    public function deleteArticle($id)
    {
        $article = $this->repository->findById($id);
        return $this->repository->delete($article);
    }

    public function bulkDeleteArticles(array $ids)
    {
        return $this->repository->deleteByIds($ids);
    }

    public function importArticles(array $articlesData)
    {
        return DB::transaction(function () use ($articlesData) {

            // --- Step 1: Group rows by barcode ---
            $grouped = [];
            foreach ($articlesData as $data) {
                $barcode = $data['code_barres'];
                if (!isset($grouped[$barcode])) {
                    $grouped[$barcode] = [
                        'code_barres' => $barcode,
                        'nom'         => $data['nom'] ?? '',
                        'prix'        => $data['prix'] ?? 0,
                        'categories'  => $data['categories'] ?? null,
                        'entrepots'   => [], // will accumulate [name => qty]
                        'quantite_total' => 0,
                    ];
                }

                // Accumulate per-warehouse quantity
                if (!empty($data['entrepots']) && !empty(trim((string)$data['entrepots']))) {
                    $entName = trim((string)$data['entrepots']);
                    $qty = isset($data['quantite_total']) ? (int)$data['quantite_total'] : 0;
                    if (isset($grouped[$barcode]['entrepots'][$entName])) {
                        $grouped[$barcode]['entrepots'][$entName] += $qty;
                    } else {
                        $grouped[$barcode]['entrepots'][$entName] = $qty;
                    }
                } else {
                    // No warehouse — add to global total
                    $grouped[$barcode]['quantite_total'] += isset($data['quantite_total']) ? (int)$data['quantite_total'] : 0;
                }
            }

            // --- Step 2: Upsert each article ---
            $importedCount = 0;
            foreach ($grouped as $data) {
                $article = $this->repository->firstOrNew(['code_barres' => $data['code_barres']]);
                $article->nom  = $data['nom'] ?: $article->nom;
                $article->prix = $data['prix'] ?: $article->prix;

                // Categories
                if (!empty($data['categories'])) {
                    $categoryNames = is_array($data['categories'])
                        ? $data['categories']
                        : explode(',', $data['categories']);
                    $categoryIds = [];
                    foreach ($categoryNames as $name) {
                        $cat = $this->repository->findOrCreateCategory(trim($name));
                        $categoryIds[] = $cat->id_category;
                    }
                    $article->save();
                    $this->repository->syncCategories($article, $categoryIds);
                } else {
                    $article->save();
                }

                // Entrepots
                if (!empty($data['entrepots'])) {
                    $syncData = [];
                    $total = 0;
                    foreach ($data['entrepots'] as $entName => $qty) {
                        $ent = $this->repository->findOrCreateEntrepot($entName);
                        $syncData[$ent->id_entrepot] = ['quantite' => $qty];
                        $total += $qty;
                    }
                    $this->repository->syncEntrepots($article, $syncData);
                    $article->quantite_total = $total;
                } else {
                    $this->repository->syncEntrepots($article, []);
                    $article->quantite_total = $data['quantite_total'];
                }

                $article->save();
                $importedCount++;
            }

            return $importedCount;
        });
    }


    public function attachCategoriesToArticles(array $ids, array $categoryIds)
    {
        return DB::transaction(function () use ($ids, $categoryIds) {
            foreach ($ids as $id) {
                $article = $this->repository->findById($id);
                $this->repository->attachCategories($article, $categoryIds);
            }
        });
    }

    public function attachEntrepotsToArticles(array $ids, array $entrepotsData)
    {
        return DB::transaction(function () use ($ids, $entrepotsData) {
            foreach ($ids as $id) {
                $article = $this->repository->findById($id);
                $syncData = [];
                foreach ($entrepotsData as $ent) {
                    $syncData[$ent['id_entrepot']] = [
                        'quantite' => $ent['quantite'] ?? ($ent['quantite_theorique'] ?? 0)
                    ];
                }
                $this->repository->attachEntrepots($article, $syncData);
            }
        });
    }
}
