<?php

namespace App\Services;

use App\Repositories\InventaireRepository;
use App\Models\Article;
use App\Models\Entrepot;
use App\Models\Inventaire;
use App\Models\LigneInventaire;
use App\Events\InventaireAssigned;
use App\Events\InventaireStatusUpdated;
use App\Events\ScanEnregistre;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Barryvdh\DomPDF\Facade\Pdf;

class InventaireService
{
    protected $repository;

    public function __construct(InventaireRepository $repository)
    {
        $this->repository = $repository;
    }

    public function createInventaire(array $data)
    {
        $inventaire = DB::transaction(function () use ($data) {
            $inventaire = $this->repository->create(array_intersect_key($data, array_flip(['titre', 'date_debut', 'date_fin', 'site', 'statut', 'type_source', 'id_entrepot', 'remarque'])));
            \App\Models\Notification::create([
                        'type' => 'nouvel inventaire',
                        'id_inventaire' => $inventaire->id_inventaire,
                        'contenu' => "Nouvel inventaire assigné : {$inventaire->titre}",
                        'statut' => 'non lu'
                    ]);
            // Assign agents
            if (!empty($data['agents'])) {
                foreach ($data['agents'] as $agentId) {
                    $this->repository->createAffectation([
                        'id_inventaire' => $inventaire->id_inventaire,
                        'id_agent' => $agentId,
                        'statut_participation' => 'inactif'
                    ]);

                    broadcast(new InventaireAssigned($inventaire, (int)$agentId));

                }
            }

            // Create Lignes
            $this->createLignes($inventaire, $data);

            $inventaire->load(['affectations.agent', 'lignes.article']);
            return $inventaire;
        });


        return $inventaire;
    }

    protected function createLignes($inventaire, $data)
    {
        if ($data['type_source'] === 'entrepot' && !empty($data['id_entrepot'])) {
            $entrepot = Entrepot::with('articles')->find($data['id_entrepot']);
            if ($entrepot) {
                foreach ($entrepot->articles as $article) {
                    $this->repository->createLigne([
                        'id_inventaire' => $inventaire->id_inventaire,
                        'id_article' => $article->id_article,
                        'id_entrepot' => $data['id_entrepot'],
                        'quantite_theorique' => $article->pivot->quantite ?? 0,
                    ]);
                }
            }
        } elseif (
            $data['type_source'] === 'tous' ||
            $data['type_source'] === 'article'
        ) {
            if ($data['type_source'] === 'tous') {
                $articles = Article::with('entrepots')->get();
            } else { 
                $articles = Article::with('entrepots')
                    ->whereIn('id_article', $data['articles'])
                    ->get();
            }
            foreach ($articles as $article) {
                if ($article->entrepots->isNotEmpty()) {
                    foreach ($article->entrepots as $entrepot) {
                        $this->repository->createLigne([
                            'id_inventaire' => $inventaire->id_inventaire,
                            'id_article' => $article->id_article,
                            'id_entrepot' => $entrepot->id_entrepot,
                            'quantite_theorique' => $entrepot->pivot->quantite ?? 0,
                        ]);
                    }
                } else {
                    $this->repository->createLigne([
                        'id_inventaire' => $inventaire->id_inventaire,
                        'id_article' => $article->id_article,
                        'quantite_theorique' => $article->quantite_total,
                    ]);
                }
            }
        }
    }

    public function updateInventaire($id, array $data)
    {
        $inventaire = DB::transaction(function () use ($id, $data) {
            $inventaire = $this->repository->update($id, array_intersect_key($data, array_flip(['titre', 'date_debut', 'date_fin', 'site', 'statut', 'remarque', 'id_entrepot'])));

            if (!empty($data['agents'])) {
                $existingAgents = \App\Models\Affectation::where('id_inventaire', $id)->pluck('id_agent')->toArray();
                $this->repository->deleteAffectations($id);
                $newAgentsToBroadcast = [];
                foreach ($data['agents'] as $agentId) {
                    $this->repository->createAffectation([
                        'id_inventaire' => $inventaire->id_inventaire,
                        'id_agent' => $agentId,
                        'statut_participation' => 'inactif'
                    ]);

                    if (!in_array($agentId, $existingAgents)) {
                        $newAgentsToBroadcast[] = $agentId;
                    }
                }
                // Store in object to broadcast later
                $inventaire->newAgentsToBroadcast = $newAgentsToBroadcast;
            }

            if ($inventaire->type_source === 'article' && !empty($data['articles'])) {
                $this->repository->deleteLignes($id, $data['articles']);
                $existingIds = LigneInventaire::where('id_inventaire', $id)->pluck('id_article')->toArray();
                $newIds = array_diff($data['articles'], $existingIds);
                if (!empty($newIds)) {
                    $articles = Article::with('entrepots')->whereIn('id_article', $newIds)->get();
                    foreach ($articles as $article) {
                        if ($article->entrepots->isNotEmpty()) {
                            foreach ($article->entrepots as $entrepot) {
                                $this->repository->createLigne([
                                    'id_inventaire' => $inventaire->id_inventaire,
                                    'id_article' => $article->id_article,
                                    'id_entrepot' => $entrepot->id_entrepot,
                                    'quantite_theorique' => $entrepot->pivot->quantite ?? 0,
                                ]);
                            }
                        } else {
                            $this->repository->createLigne([
                                'id_inventaire' => $inventaire->id_inventaire,
                                'id_article' => $article->id_article,
                                'quantite_theorique' => $article->quantite_total,
                            ]);
                        }
                    }
                }
            } elseif ($inventaire->type_source === 'entrepot' && !empty($data['id_entrepot'])) {
                $firstLigne = LigneInventaire::where('id_inventaire', $id)->first();
                if (!$firstLigne || $firstLigne->id_entrepot != $data['id_entrepot']) {
                    $this->repository->deleteLignes($id);
                    $entrepot = Entrepot::with('articles')->find($data['id_entrepot']);
                    if ($entrepot) {
                        foreach ($entrepot->articles as $article) {
                            $this->repository->createLigne([
                                'id_inventaire' => $inventaire->id_inventaire,
                                'id_article' => $article->id_article,
                                'id_entrepot' => $data['id_entrepot'],
                                'quantite_theorique' => $article->pivot->quantite ?? 0,
                            ]);
                        }
                    }
                }
            }

            $inventaire->refresh()->load(['affectations', 'lignes.article']);
            return $inventaire;
        });

        broadcast(new InventaireStatusUpdated($inventaire));

        if (!empty($inventaire->newAgentsToBroadcast)) {
            foreach ($inventaire->newAgentsToBroadcast as $agentId) {
                broadcast(new InventaireAssigned($inventaire, (int)$agentId));
            }
        }

        return $inventaire->load(['affectations.agent', 'lignes.article']);
    }

    public function scanArticle($inventaireId, $barcode, $userId, $quantite = 1, $idEntrepot = null)
    {
        $article = Article::where('code_barres', $barcode)->first();
        if (!$article) return ['success' => false, 'found' => false, 'message' => 'Article non trouvé.'];

        $ligne = $this->repository->getLigneByArticle($inventaireId, $article->id_article, $idEntrepot);
        if (!$ligne) {
            $inventaire = \App\Models\Inventaire::find($inventaireId);
            $canAdd = false;
            if ($inventaire->type_source === 'tous' || $inventaire->type_source === 'entrepot') {
                $canAdd = true;
            } elseif ($inventaire->type_source === 'article') {
                $canAdd = \App\Models\LigneInventaire::where('id_inventaire', $inventaireId)
                                       ->where('id_article', $article->id_article)
                                       ->exists();
            }
            return ['success' => false, 'found' => true, 'can_add' => $canAdd, 'message' => 'Article hors inventaire pour cet entrepôt.', 'article' => $article];
        }

        $this->repository->createScan([
            'id_ligne' => $ligne->id_ligne,
            'id_agent' => $userId,
            'quantite' => $quantite,
        ]);

        // Update the ligne_inventaire based on sum of scans for this ligne
        $totalComptee = \App\Models\Scan::where('id_ligne', $ligne->id_ligne)
            ->sum('quantite');

        $ecart = ($totalComptee == 0 || $totalComptee == ($ligne->quantite_theorique ?? 0))
            ? 0
            : $totalComptee - ($ligne->quantite_theorique ?? 0);

        $ligne->update([
            'quantite_comptee' => $totalComptee,
            'ecart' => $ecart
        ]);

        broadcast(new ScanEnregistre($inventaireId, $article, $userId, $ligne->quantite_comptee, $ligne->ecart, $idEntrepot ?? $ligne->id_entrepot))->toOthers();

        return ['success' => true, 'found' => true, 'article' => $article, 'ligne' => $ligne];
    }

    public function addKnownArticleToInventory($inventaireId, $barcode, $user, $quantite = 1, $idEntrepot = null)
    {
        return DB::transaction(function () use ($inventaireId, $barcode, $user, $quantite, $idEntrepot) {
            $inventaire = Inventaire::findOrFail($inventaireId);
            
            if ($inventaire->statut === 'cloture') {
                throw new \Exception('Inventaire déjà cloturé.', 403);
            }

            $article = Article::where('code_barres', $barcode)->first();
            if (!$article) {
                throw new \Exception('Article introuvable.', 404);
            }

            $targetEntrepotId = $idEntrepot ?? $inventaire->id_entrepot;

            $ligne = $this->repository->getLigneByArticle($inventaireId, $article->id_article, $targetEntrepotId);
            if ($ligne) {
                throw new \Exception('Cet article fait déjà partie de l\'inventaire pour cet entrepôt.', 409);
            }

            if ($targetEntrepotId) {
                $existsInEntrepot = $article->entrepots()->where('entrepots.id_entrepot', $targetEntrepotId)->exists();
                if (!$existsInEntrepot) {
                    $article->entrepots()->attach($targetEntrepotId, ['quantite' => 0, 'propose_par' => $user->id]);
                }
            }

            $ligne = $this->repository->createLigne([
                'id_inventaire' => $inventaireId,
                'id_article' => $article->id_article,
                'id_entrepot' => $targetEntrepotId,
                'quantite_theorique' => 0,
                'quantite_comptee' => $quantite,
                'ecart' => $quantite
            ]);

            $this->repository->createScan([
                'id_ligne' => $ligne->id_ligne,
                'id_agent' => $user->id,
                'quantite' => $quantite,
            ]);

            broadcast(new \App\Events\ScanEnregistre($inventaireId, $article, $user->id, $ligne->quantite_comptee, $ligne->ecart, $targetEntrepotId))->toOthers();

            return [
                'article' => $article,
                'id_ligne' => $ligne->id_ligne,
            ];
        });
    }

    public function terminateInventaire($id, array $data)
    {
        $inventaire = Inventaire::with(['lignes.article', 'affectations.agent'])->findOrFail($id);

        return DB::transaction(function () use ($inventaire, $id, $data) {
            $csvPath = null;
            if (!empty($data['update_stock'])) {
                $csvPath = $this->createStockBackup($inventaire);
                $this->applyStockUpdates($inventaire);
            }
            $summaryData = $this->prepareSummary($inventaire);
            $summary = $summaryData['summary'];
            $lignesDetails = $summaryData['lignes_details'];
            $agentNames = $summaryData['agent_names'];

            $pdf = Pdf::loadView('pdf.inventory_report', [
                'inventaire' => $inventaire,
                'summary' => $summary,
                'lignes_details' => $lignesDetails,
                'agent_names' => $agentNames,
                'corrections' => $summaryData['corrections'],
                'articles_inconnus' => $summaryData['articles_inconnus']
            ]);

            $fileName = 'rapport_' . $id . '_' . time() . '.pdf';
            $filePath = 'rapports/' . $fileName;
            Storage::disk('public')->put($filePath, $pdf->output());

            // 5. Clôture et enregistrement du rapport
            $inventaire->update([
                'statut' => 'cloture',
                'fichier_path' => '/storage/' . $filePath
            ]);

            return $csvPath;
        });
    }

    protected function createStockBackup($inventaire)
    {
        $backupData = [["Code Barres", "Nom Article", "Entrepot ID", "Ancienne Quantite", "Date Sauvegarde"]];
        
        foreach ($inventaire->lignes as $ligne) {
            $article = $ligne->article;
            $oldQty = 0;
            
            if ($ligne->id_entrepot) {
                $entrepotPivot = DB::table('ligne_entrepots')
                    ->where('id_article', $article->id_article)
                    ->where('id_entrepot', $ligne->id_entrepot)
                    ->first();
                $oldQty = $entrepotPivot->quantite ?? 0;
            } else {
                $oldQty = $article->quantite_total;
            }

            $backupData[] = [
                $article->code_barres,
                $article->nom,
                $ligne->id_entrepot ?? 'Global',
                $oldQty,
                now()->toDateTimeString()
            ];
        }

        $csvFileName = 'backup_stock_inv_' . $inventaire->id_inventaire . '_' . time() . '.csv';
        $csvContent = "";
        foreach ($backupData as $row) {
            $csvContent .= implode(',', array_map(fn($v) => '"' . str_replace('"', '""', $v) . '"', $row)) . "\n";
        }

        $filePath = 'backups/' . $csvFileName;
        Storage::disk('public')->put($filePath, "\xEF\xBB\xBF" . $csvContent); // UTF-8 BOM for Excel
        return '/storage/' . $filePath;
    }

    protected function applyStockUpdates($inventaire)
    {
        foreach ($inventaire->lignes as $ligne) {
            if ($ligne->quantite_comptee === null) continue;

            $article = $ligne->article;
            $newQty = (float)$ligne->quantite_comptee;

            if ($ligne->id_entrepot) {
                DB::table('ligne_entrepots')
                    ->where('id_article', $article->id_article)
                    ->where('id_entrepot', $ligne->id_entrepot)
                    ->update(['quantite' => $newQty]);
                
                $totalArticle = DB::table('ligne_entrepots')
                    ->where('id_article', $article->id_article)
                    ->sum('quantite');
                
                $article->update(['quantite_total' => $totalArticle]);
            } else {
                $article->update(['quantite_total' => $newQty]);
            }
        }
    }

    protected function prepareSummary($inventaire)
    {
        $totalQtyTheorique = $inventaire->lignes->sum('quantite_theorique');
        $totalQtyComptee = $inventaire->lignes->sum('quantite_comptee');
        $sansEcartCount = $inventaire->lignes->where('ecart', 0)->count();
        
        $ecartsPositifs = $inventaire->lignes->where('ecart', '>', 0);
        $ecartPositifPrice = $ecartsPositifs->reduce(fn($carry, $item) => $carry + ($item->ecart * ($item->article->prix ?? 0)), 0);

        $ecartsNegatifs = $inventaire->lignes->where('ecart', '<', 0);
        $ecartNegatifPrice = $ecartsNegatifs->reduce(fn($carry, $item) => $carry + (abs($item->ecart) * ($item->article->prix ?? 0)), 0);

        $agentNames = $inventaire->affectations->map(fn($a) => ($a->agent->nom ?? '') . ' ' . ($a->agent->prenom ?? ''))->filter()->values()->toArray();

        $scansByArticle = $this->repository->getScansByArticle($inventaire->id_inventaire)->groupBy('id_article');

        $lignesDetails = $inventaire->lignes->map(function($ligne) use ($scansByArticle) {
            $idArticle = $ligne->id_article;
            $articleScans = $scansByArticle->get($idArticle) ?? collect();
            $agentsContrib = $articleScans
                ->map(fn($s) => trim((($s->agent->nom ?? '') . ' ' . ($s->agent->prenom ?? '')) . ($s->agent->email ? ' <' . $s->agent->email . '>' : '')))
                ->unique()
                ->filter()
                ->implode(', ');

            $totalTheorique = $ligne->quantite_theorique ?? 0;
            $totalComptee = $ligne->quantite_comptee ?? 0;
            $entrepotName = $ligne->entrepot->nom ?? 'Tous';

            return [
                'nom' => $ligne->article->nom ?? '...',
                'code_barres' => $ligne->article->code_barres ?? '...',
                'prix' => $ligne->article->prix ?? 0,
                'theorique' => $totalTheorique,
                'comptee' => $totalComptee,
                'ecart' => $ligne->ecart ?? (($totalComptee == 0 || $totalComptee == $totalTheorique) ? 0 : $totalComptee - $totalTheorique),
                'entrepot' => $entrepotName,
                'agents_contrib' => $agentsContrib
            ];
        })->values();

        // Corrections
        $corrections = \App\Models\Correction::whereIn('id_ligne_inventaire', $inventaire->lignes->pluck('id_ligne'))
            ->where('statut_validation', 'valide')
            ->with(['agent', 'ligne.article'])
            ->get()
            ->map(fn($c) => [
                'article' => $c->ligne->article->nom ?? 'Inconnu',
                'agent' => trim((($c->agent->nom ?? '') . ' ' . ($c->agent->prenom ?? '')) . ($c->agent->email ? ' <' . $c->agent->email . '>' : '')),
                'ancienne_qte' => max(0, ($c->ligne->quantite_comptee ?? 0) + $c->qte),
                'nouvelle_qte' => $c->ligne->quantite_comptee ?? 0,
                'correction_qte' => $c->qte,
                'motif' => $c->description,
                'statut' => $c->statut_validation,
                'date' => $c->created_at->format('d/m/Y H:i')
            ]);

        $unknownArticles = $inventaire->lignes->filter(fn($l) => $l->article->statut === 'inconnu' || $l->article->etat === 'inconnu')
            ->map(fn($l) => [
                'nom' => $l->article->nom,
                'code_barres' => $l->article->code_barres,
                'quantite' => $l->quantite_comptee,
                'entrepot' => $l->entrepot->nom ?? 'Global'
            ]);

        return [
            'summary' => [
                'total_articles' => $inventaire->lignes->count(),
                'total_qty_theorique' => $totalQtyTheorique,
                'total_qty_comptee' => $totalQtyComptee,
                'sans_ecart_count' => $sansEcartCount,
                'ecart_positif_count' => $ecartsPositifs->count(),
                'ecart_positif_price' => $ecartPositifPrice,
                'ecart_negatif_count' => $ecartsNegatifs->count(),
                'ecart_negatif_price' => $ecartNegatifPrice,
                'agent_names' => $agentNames,
                'type_source' => $inventaire->type_source
            ],
            'lignes_details' => $lignesDetails,
            'agent_names' => $agentNames,
            'corrections' => $corrections,
            'articles_inconnus' => $unknownArticles
        ];
    }
    public function startInventaire($id, $user)
    {
        $inventaire = Inventaire::findOrFail($id);

        \App\Models\Affectation::where('id_inventaire', $id)
            ->where('id_agent', $user->id)
            ->update([
                'statut_participation' => 'actif'
            ]);

        $oldStatus = $inventaire->statut;
        if ($inventaire->statut == 'en attente' ) {
            $inventaire->update(['statut' => 'en cours']);
        }

        $inventaire->refresh()->load(['affectations.agent', 'lignes.article', 'entrepot']);
        
        $this->createNotification('agent actif', $id, null, "L'agent {$user->nom} est actif maintenant sur {$inventaire->titre}");
        
        if ($oldStatus === 'en attente') {
            $this->createNotification('inventaire en cours', $id, null, "L'inventaire {$inventaire->titre} est passé en cours maintenant");
        }

        broadcast(new InventaireStatusUpdated($inventaire));
        broadcast(new \App\Events\AgentStatusUpdated((int)$id, (int)$user->id, 'actif', $inventaire->titre));

        return $inventaire;
    }

    public function stopInventaire($id, $user)
    {
        \App\Models\Affectation::where('id_inventaire', $id)
            ->where('id_agent', $user->id)
            ->update(['statut_participation' => 'inactif']);

        $inventaire = Inventaire::findOrFail($id)->load(['affectations.agent', 'lignes.article']);
        
        $this->createNotification('agent inactif', $id, null, "L'agent {$user->nom} est maintenant inactif");

        broadcast(new InventaireStatusUpdated($inventaire));
        broadcast(new \App\Events\AgentStatusUpdated((int)$id, (int)$user->id, 'inactif', $inventaire->titre));

        return true;
    }

    public function proposeArticle($id, $user, array $data)
    {
        $inventaire = Inventaire::with(['affectations', 'entrepot'])->findOrFail($id);
        
        if ($inventaire->type_source === 'article') {
            throw new \Exception('Non autorisé pour ce type d\'inventaire.', 403);
        }

        $quantite = $data['quantite'] ?? 1;
        $targetEntrepotId = $data['id_entrepot'] ?? $inventaire->id_entrepot;

        return DB::transaction(function () use ($id, $user, $data, $inventaire, $quantite, $targetEntrepotId) {
            $isNewArticle = !Article::where(
    'code_barres',
    $data['code_barres']
)->exists();
            $articleQuery = Article::where('code_barres', $data['code_barres']);
            if ($targetEntrepotId) {
                $articleQuery->whereHas('entrepots', function ($q) use ($targetEntrepotId) {
                    $q->where('entrepots.id_entrepot', $targetEntrepotId);
                });
            } else {
                $articleQuery->whereDoesntHave('entrepots');
            }
            $article = $articleQuery->first();

            if (!$article) {
                $article = Article::create([
                    'code_barres' => $data['code_barres'],
                    'nom' => $data['nom'],
                    'quantite_total' => 0, 
                    'etat' => 'inconnu',
                    'propose_par' => $user->id,
                ]);
            }

            $ligne = $this->repository->getLigneByArticle($id, $article->id_article, $targetEntrepotId);

            if ($ligne) {
                throw new \Exception('Cet article fait déjà partie de l\'inventaire pour cet entrepôt.', 409);
            }

            $ligne = $this->repository->createLigne([
                'id_inventaire' => $id,
                'id_article' => $article->id_article,
                'id_entrepot' => $targetEntrepotId,
                'quantite_theorique' => 0, 
                'quantite_comptee' => $quantite,
                'ecart' => $quantite, 
            ]);

            if ($targetEntrepotId) {
                $existsInEntrepot = DB::table('ligne_entrepots')
                    ->where('id_article', $article->id_article)
                    ->where('id_entrepot', $targetEntrepotId)
                    ->exists();

                if (!$existsInEntrepot) {
                    $article->entrepots()->attach($targetEntrepotId, ['quantite' => 0, 'propose_par' => $user->id]);
                }
            }

            $this->repository->createScan([
                'id_ligne' => $ligne->id_ligne,
                'id_agent' => $user->id,
                'quantite' => $quantite,
            ]);


            if ($isNewArticle) {
                broadcast(new \App\Events\ArticleProposeEvent($article, $inventaire, $user, $quantite));
                $message = "Article inconnu proposé par {$user->nom} {$user->prenom} : {$article->nom}";
                $this->createNotification('article inconnu', $id, $article->id_article, $message);
            } else {
                $targetEntrepot = \App\Models\Entrepot::find($targetEntrepotId);
                $entrepotNom = $targetEntrepot ? $targetEntrepot->nom : 'global';
                $message = "Article connu '{$article->nom}' proposé par {$user->nom} {$user->prenom} pour l'entrepôt {$entrepotNom}";
                $this->createNotification('article inconnu', $id, $article->id_article, $message);
                broadcast(new \App\Events\ScanEnregistre($id, $article, $user->id, $ligne->quantite_comptee, $ligne->ecart, $targetEntrepotId))->toOthers();
            }

            return [
                'article' => $article,
                'id_ligne' => $ligne->id_ligne,
            ];
        });
    }

    public function acceptArticle($id)
{
    return DB::transaction(function () use ($id) {

        $article = Article::findOrFail($id);

        if ($article->etat !== 'inconnu') {
            return true;
        }

        $connuArticle = Article::where('code_barres', $article->code_barres)
            ->where('etat', 'connu')
            ->where('id_article', '!=', $id)
            ->first();

        if ($connuArticle) {

            foreach ($article->entrepots as $ent) {

                $existing = $connuArticle->entrepots()
                    ->where('entrepots.id_entrepot', $ent->id_entrepot)
                    ->first();

                if ($existing) {

                    $connuArticle->entrepots()->updateExistingPivot(
                        $ent->id_entrepot,
                        [
                            'quantite' =>
                                ($existing->pivot->quantite ?? 0)
                                + ($ent->pivot->quantite ?? 0)
                        ]
                    );

                } else {

                    $connuArticle->entrepots()->attach(
                        $ent->id_entrepot,
                        [
                            'quantite' => $ent->pivot->quantite ?? 0,
                            'propose_par' => $ent->pivot->propose_par
                        ]
                    );
                }
            }

            $total = DB::table('ligne_entrepots')
                ->where('id_article', $connuArticle->id_article)
                ->sum('quantite');

            $connuArticle->update([
                'quantite_total' => $total
            ]);

            foreach ($article->lignesInventaire as $ligne) {

                $collision = \App\Models\LigneInventaire::where(
                    'id_inventaire',
                    $ligne->id_inventaire
                )
                ->where('id_article', $connuArticle->id_article)
                ->where('id_entrepot', $ligne->id_entrepot)
                ->first();

                if ($collision) {

                    $collision->update([
                        'quantite_theorique' =>
                            $collision->quantite_theorique + $ligne->quantite_theorique,

                        'quantite_comptee' =>
                            $collision->quantite_comptee + $ligne->quantite_comptee,

                        'ecart' =>
                            $collision->ecart + $ligne->ecart
                    ]);

                    \App\Models\Scan::where(
                        'id_ligne',
                        $ligne->id_ligne
                    )->update([
                        'id_ligne' => $collision->id_ligne
                    ]);

                    $ligne->delete();

                } else {

                    $ligne->update([
                        'id_article' => $connuArticle->id_article
                    ]);
                }
            }

            $notifs = \App\Models\Notification::where(
                'statut',
                'non lu'
            )->get();

            foreach ($notifs as $n) {

                if (
                    $n->id_article == $id
                    || $n->id_article == $connuArticle->id_article
                ) {

                    $n->update([
                        'statut' => 'lu'
                    ]);

                } else {

                    $decoded = json_decode($n->contenu, true);

                    if (
                        $decoded
                        && isset($decoded['article_id'])
                        && (int)$decoded['article_id'] === (int)$id
                    ) {
                        $n->update([
                            'statut' => 'lu'
                        ]);
                    }
                }
            }

            $article->delete();

            broadcast(
                new \App\Events\ArticleAccepteEvent($connuArticle)
            );

            return $connuArticle->load([
                'categories',
                'entrepots'
            ]);
        }

        $article->update([
            'etat' => 'connu'
        ]);

        $notifs = \App\Models\Notification::where(
            'statut',
            'non lu'
        )->get();

        foreach ($notifs as $n) {

            if ($n->id_article == $id) {

                $n->update([
                    'statut' => 'lu'
                ]);

            } else {

                $decoded = json_decode($n->contenu, true);

                if (
                    $decoded
                    && isset($decoded['article_id'])
                    && (int)$decoded['article_id'] === (int)$id
                ) {
                    $n->update([
                        'statut' => 'lu'
                    ]);
                }
            }
        }

        broadcast(
            new \App\Events\ArticleAccepteEvent($article)
        );

        return $article->fresh()->load([
            'categories',
            'entrepots'
        ]);
    });
}

    public function addNote($id, $user, $contenu)
    {
        $inventaire = Inventaire::with('affectations')->findOrFail($id);
        if ($inventaire->statut === 'cloture') {
            throw new \Exception("Impossible d'ajouter une note à un inventaire cloturé.", 403);
        }

        $note = $this->repository->createNote([
            'id_inventaire' => $id,
            'id_user' => $user->id,
            'contenu' => $contenu,
            'lu' => false,
        ]);

        $note->load('user');

        $message = "Nouvelle note de {$user->nom}: " . substr($contenu, 0, 50);

        $this->createNotification('nouvelle note', $id, null, $message, $note->id_note);

        broadcast(new \App\Events\NoteAdded($note))->toOthers();
        return $note;
    }

    public function updateNote($id, $user, $contenu)
    {
        $note = $this->repository->findNoteById($id);
        if ($note->id_user !== $user->id && $user->role !== 'admin') throw new \Exception('Non autorisé', 403);

        $note->update(['contenu' => $contenu]);
        $note->load('user');

        broadcast(new \App\Events\NoteUpdated($note))->toOthers();
        return $note;
    }

    public function deleteNote($id, $user)
    {
        $note = $this->repository->findNoteById($id);
        if ($note->id_user !== $user->id) throw new \Exception('Non autorisé', 403);

        $noteId = $note->id_note;
        $invId = $note->id_inventaire;
        $note->delete();

        broadcast(new \App\Events\NoteDeleted($noteId, $invId))->toOthers();
        return true;
    }

    protected function createNotification($type, $inventaireId, $articleId, $contenu, $noteId = null)
    {
        $notif = \App\Models\Notification::create([
            'type' => $type,
            'id_inventaire' => $inventaireId,
            'id_article' => $articleId,
            'id_note' => $noteId,
            'contenu' => $contenu,
            'statut' => 'non lu'
        ]);

        broadcast(new \App\Events\NotificationCreated($notif));

        return $notif;
    }
}
