<?php

namespace App\Services;

use App\Repositories\ArticleRepository;
use Illuminate\Support\Facades\DB;
use App\Models\Article;

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
                if ($ligne->inventaire && $ligne->inventaire->statut !== 'En Cours' ) {
                    $articlesInventories = true;
                }

                // Pour les écarts, on continue de les cumuler globalement pour les stats
                if ($ligne->quantite_comptee !== null) {
                    if ($ligne->quantite_comptee == 0 || $ligne->quantite_comptee == $ligne->quantite_theorique) {
                        $ecart = 0;
                    } else {
                        $ecart = $ligne->quantite_comptee - $ligne->quantite_theorique;
                    }

                    if ($ecart > 0) {
                        $ecartPositif += $ecart;
                    } elseif ($ecart < 0) {
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
                'nom' => $data['nom'] ?? null,
                'prix' => isset($data['prix']) && $data['prix'] !== '' ? $data['prix'] : null,
                'etat' => 'connu',
            ];

            $article = $this->repository->create($articleData);

            if (isset($data['categories'])) {
                $this->repository->syncCategories($article, $data['categories']);
            }

            if (!empty($data['entrepots'])) {
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

            if (
                isset($data['code_barres']) &&
                $data['code_barres'] !== $article->code_barres
            ) {

                $existingArticle = Article::where(
                    'code_barres',
                    $data['code_barres']
                )
                    ->where('id_article', '!=', $id)
                    ->where('etat', 'connu')
                    ->first();

                if ($existingArticle) {
                    throw new \Exception(
                        'Un article connu avec ce code-barres existe déjà.',
                        409
                    );
                }
            }

            $articleData = array_intersect_key(
                $data,
                array_flip(['code_barres', 'nom', 'prix'])
            );

            $this->repository->update($article, $articleData);

            if (isset($data['categories'])) {
                $this->repository->syncCategories($article, $data['categories']);
            }

            if (!empty($data['entrepots'])) {

                $syncData = [];
                $total = 0;

                foreach ($data['entrepots'] as $ent) {

                    if (isset($ent['id_entrepot'])) {

                        $qte = $ent['quantite']
                            ?? ($ent['quantite_theorique'] ?? 0);

                        $syncData[$ent['id_entrepot']] = [
                            'quantite' => $qte
                        ];

                        $total += $qte;
                    }
                }

                $article->quantite_total = $total;
                $article->save();

                $this->repository->syncEntrepots(
                    $article,
                    $syncData
                );

            } else {

                if (isset($data['quantite_total'])) {

                    $article->quantite_total =
                        $data['quantite_total'];

                    $article->save();
                }

                $this->repository->syncEntrepots(
                    $article,
                    []
                );
            }

            return $article->load([
                'categories',
                'entrepots'
            ]);
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

            // Step 1: Group by barcode
            $grouped = [];

            foreach ($articlesData as $data) {
                $barcode = $data['code_barres'];

                if (!isset($grouped[$barcode])) {
                    $grouped[$barcode] = [
                        'code_barres' => $barcode,
                        'nom' => $data['nom'] ?? null,
                        'prix' => $data['prix'] ?? null,
                        'categories' => $data['categories'] ?? null,
                        'entrepots' => [],
                        'quantite_total' => 0,
                    ];
                }

                if (!empty($data['entrepots'])) {
                    $entName = trim($data['entrepots']);
                    $qty = (int) ($data['quantite_total'] ?? 0);

                    $grouped[$barcode]['entrepots'][$entName] =
                        ($grouped[$barcode]['entrepots'][$entName] ?? 0) + $qty;

                } else {
                    $grouped[$barcode]['quantite_total'] += (int) ($data['quantite_total'] ?? 0);
                }
            }

            $importedCount = 0;

            foreach ($grouped as $data) {

               
                $article = $this->repository->findConnuByCodeBarres($data['code_barres']);

                if (!$article) {
                    $article = $this->repository->createConnu($data);
                } else {
                    $this->repository->updateBasicInfo($article, $data);
                }

                // Categories
                if (!empty($data['categories'])) {
                    $categoryIds = $this->repository->resolveCategories($data['categories']);

                    $this->repository->syncCategories($article, $categoryIds);
                }

                // Entrepots
                $syncData = [];
                $total = 0;

                foreach ($data['entrepots'] as $name => $qty) {
                    $entrepot = $this->repository->findOrCreateEntrepot($name);

                    $syncData[$entrepot->id_entrepot] = [
                        'quantite' => $qty
                    ];

                    $total += $qty;
                }

                $this->repository->syncEntrepots($article, $syncData);

                if (!empty($data['entrepots'])) {
                    $article->quantite_total = $total;
                } else {
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
?>
