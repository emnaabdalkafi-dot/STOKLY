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

            // Assign agents
            if (!empty($data['agents'])) {
                foreach ($data['agents'] as $agentId) {
                    $this->repository->createAffectation([
                        'id_inventaire' => $inventaire->id_inventaire,
                        'id_agent' => $agentId,
                        'statut_participation' => 'inactif'
                    ]);

                    \App\Models\Notification::create([
                        'type' => 'nouvel inventaire',
                        'id_inventaire' => $inventaire->id_inventaire,
                        'id_user' => $agentId,
                        'contenu' => "Nouvel inventaire assigné : {$inventaire->titre}",
                        'statut' => 'non lu'
                    ]);
                }
            }

            // Create Lignes
            $this->createLignes($inventaire, $data);

            $inventaire->load(['affectations.agent', 'lignes.article']);
            return $inventaire;
        });

        // Fire assigned events outside transaction
        if (!empty($data['agents'])) {
            foreach ($data['agents'] as $agentId) {
                broadcast(new InventaireAssigned($inventaire, (int)$agentId));
            }
        }

        return $inventaire;
    }

    protected function createLignes($inventaire, $data)
    {
        if ($data['type_source'] === 'tous') {
            $articles = Article::with('entrepots')->get();
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
        } elseif ($data['type_source'] === 'entrepot' && !empty($data['id_entrepot'])) {
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
        } elseif ($data['type_source'] === 'article' && !empty($data['articles'])) {
            $articles = Article::with('entrepots')->whereIn('id_article', $data['articles'])->get();
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
                        \App\Models\Notification::create([
                            'type' => 'nouvel inventaire',
                            'id_inventaire' => $inventaire->id_inventaire,
                            'id_user' => $agentId,
                            'contenu' => "Nouvel inventaire assigné : {$inventaire->titre}",
                            'statut' => 'non lu'
                        ]);
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
        if (!$ligne) return ['success' => false, 'found' => true, 'message' => 'Article hors inventaire pour cet entrepôt.', 'article' => $article];

        $this->repository->createScan([
            'id_ligne' => $ligne->id_ligne,
            'id_agent' => $userId,
            'quantite' => $quantite,
        ]);

        // Update agent activity timestamp
        \App\Models\Affectation::where('id_inventaire', $inventaireId)
            ->where('id_agent', $userId)
            ->update(['statut_participation' => 'actif']);

        // Update the ligne_inventaire based on sum of scans for this ligne
        $totalComptee = \App\Models\Scan::where('id_ligne', $ligne->id_ligne)
            ->sum('quantite');

        $ligne->update([
            'quantite_comptee' => $totalComptee,
            'ecart' => $totalComptee - ($ligne->quantite_theorique ?? 0)
        ]);

        broadcast(new ScanEnregistre($inventaireId, $article, $userId, $ligne->quantite_comptee, $ligne->ecart, $idEntrepot ?? $ligne->id_entrepot))->toOthers();

        return ['success' => true, 'found' => true, 'article' => $article, 'ligne' => $ligne];
    }

    public function terminateInventaire($id, array $data)
    {
        $inventaire = Inventaire::with(['lignes.article', 'affectations.agent'])->findOrFail($id);
        if ($inventaire->statut === 'termine') throw new \Exception('Inventaire déjà terminé.');

        return DB::transaction(function () use ($inventaire, $id, $data) {
            // 1. Sauvegarde (Backup) si demandé ou par défaut pour la sécurité
            if (!empty($data['update_stock'])) {
                $this->createStockBackup($inventaire);
            }

            // 2. Mettre à jour les lignes avec les données finales envoyées (si présentes)
            if (!empty($data['lignes'])) {
                foreach ($data['lignes'] as $ligneData) {
                    $ligne = $this->repository->findLigne($ligneData['id_ligne']);
                    if ($ligne && $ligne->id_inventaire == $id) {
                        $count = $ligneData['quantite_comptee'];
                        $ligne->update([
                            'quantite_comptee' => $count,
                            'ecart' => (float)$count - (float)($ligne->quantite_theorique ?? 0)
                        ]);
                    }
                }
                $inventaire->load(['lignes.article', 'affectations.agent']);
            }

            // 3. Mise à jour des stocks réels si demandé
            if (!empty($data['update_stock'])) {
                $this->applyStockUpdates($inventaire);
            }

            // 4. Génération du Rapport PDF
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

            // 5. Enregistrement du rapport en base
            $this->repository->createRapport([
                'id_inventaire' => $inventaire->id_inventaire,
                'titre' => $inventaire->titre,
                'site' => $inventaire->site,
                'type_source' => $inventaire->type_source,
                'date_debut' => $inventaire->date_debut,
                'date_fin' => $inventaire->date_fin,
                'fichier_path' => '/storage/' . $filePath,
                'total_articles' => $summary['total_articles'],
                'articles_comptes' => $inventaire->lignes->whereNotNull('quantite_comptee')->count(),
                'ecarts_positifs' => $summary['ecart_positif_count'],
                'ecarts_negatifs' => $summary['ecart_negatif_count'],
                'sans_ecart_count' => $summary['sans_ecart_count'],
                'ecart_positif_price' => $summary['ecart_positif_price'],
                'ecart_negatif_price' => $summary['ecart_negatif_price'],
                'correction_details' => $summaryData['corrections'],
                'lignes_details' => $lignesDetails,
                'agents_details' => $agentNames
            ]);

            // 6. Nettoyage et clôture
            $inventaire->update(['statut' => 'termine']);
            $this->repository->deleteScans($id);
            $this->repository->deleteLignes($id);
            $this->repository->deleteAffectations($id);

            return '/storage/' . $filePath;
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

        Storage::disk('public')->put('backups/' . $csvFileName, "\xEF\xBB\xBF" . $csvContent); // UTF-8 BOM for Excel
    }

    protected function applyStockUpdates($inventaire)
    {
        foreach ($inventaire->lignes as $ligne) {
            if ($ligne->quantite_comptee === null) continue;

            $article = $ligne->article;
            $newQty = (float)$ligne->quantite_comptee;

            if ($ligne->id_entrepot) {
                // Update specific warehouse
                DB::table('ligne_entrepots')
                    ->where('id_article', $article->id_article)
                    ->where('id_entrepot', $ligne->id_entrepot)
                    ->update(['quantite' => $newQty]);
                
                // Recalculate total for article
                $totalArticle = DB::table('ligne_entrepots')
                    ->where('id_article', $article->id_article)
                    ->sum('quantite');
                
                $article->update(['quantite_total' => $totalArticle]);
            } else {
                // Update global total directly
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

        $lignesDetails = $inventaire->lignes->groupBy('id_article')->map(function($group) use ($scansByArticle) {
            $first = $group->first();
            $idArticle = $first->id_article;
            $articleScans = $scansByArticle->get($idArticle) ?? collect();
            $agentsContrib = $articleScans->map(fn($s) => ($s->agent->nom ?? 'Agent') . ' (' . $s->total_scanee . ')')->unique()->implode(', ');

            $totalTheorique = $group->sum('quantite_theorique');
            $totalComptee = $group->sum('quantite_comptee');

            return [
                'nom' => $first->article->nom ?? '...',
                'code_barres' => $first->article->code_barres ?? '...',
                'prix' => $first->article->prix ?? 0,
                'theorique' => $totalTheorique,
                'comptee' => $totalComptee,
                'ecart' => $totalComptee - $totalTheorique,
                'agents_contrib' => $agentsContrib
            ];
        })->values();

        // Corrections
        $corrections = \App\Models\Correction::whereIn('id_ligne_inventaire', $inventaire->lignes->pluck('id_ligne'))
            ->with(['agent', 'ligne.article'])
            ->get()
            ->map(fn($c) => [
                'article' => $c->ligne->article->nom ?? 'Inconnu',
                'agent' => ($c->agent->nom ?? '') . ' ' . ($c->agent->prenom ?? ''),
                'ancienne_qte' => $c->ligne->quantite_comptee,
                'nouvelle_qte' => $c->qte,
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
        if ($inventaire->statut !== 'termine') {
            $inventaire->update(['statut' => 'en cours']);
        }

        $inventaire->refresh()->load(['affectations.agent', 'lignes.article', 'entrepot']);
        
        // Activity Notifications
        $this->createNotification('agent actif', $id, null, $user->id, "L'agent {$user->nom} est actif maintenant sur {$inventaire->titre}");
        
        if ($oldStatus === 'en attente') {
            $this->createNotification('inventaire en cours', $id, null, $user->id, "L'inventaire {$inventaire->titre} est passé en cours maintenant");
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
        
        $this->createNotification('agent inactif', $id, null, $user->id, "L'agent {$user->nom} est maintenant inactif");

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

        if (Article::where('code_barres', $data['code_barres'])->exists()) {
            throw new \Exception('Ce code-barres existe déjà.', 409);
        }

        return DB::transaction(function () use ($id, $user, $data, $inventaire) {
            $article = Article::create([
                'code_barres' => $data['code_barres'],
                'nom' => $data['nom'],
                'quantite_total' => 0, // Always 0 for unknown articles
                'etat' => 'inconnu',
                'statut' => 'inconnu',
                'propose_par' => $user->id,
            ]);

            $quantite = $data['quantite'] ?? 1;
            $targetEntrepotId = $data['id_entrepot'] ?? $inventaire->id_entrepot;

            $ligne = $this->repository->createLigne([
                'id_inventaire' => $id,
                'id_article' => $article->id_article,
                'id_entrepot' => $targetEntrepotId,
                'quantite_theorique' => 0, // Theoretical is 0 for unknown
                'quantite_comptee' => $quantite,
                'ecart' => $quantite, // Gap is the entire scanned quantity
            ]);

            if ($targetEntrepotId) {
                $article->entrepots()->attach($targetEntrepotId, ['quantite' => 0, 'propose_par' => $user->id]);
            }

            $this->repository->createScan([
                'id_ligne' => $ligne->id_ligne,
                'id_agent' => $user->id,
                'quantite' => $quantite,
            ]);

            broadcast(new \App\Events\ArticleProposeEvent($article, $inventaire, $user, $quantite));
            $this->createNotification('article inconnu', $id, $article->id_article, $user->id, "Article inconnu proposé par {$user->nom} {$user->prenom} : {$article->nom}");

            return [
                'article' => $article,
                'id_ligne' => $ligne->id_ligne,
            ];
        });
    }

    public function acceptArticle($id)
    {
        $article = Article::findOrFail($id);
        $article->update(['statut' => 'connu', 'etat' => 'connu']);
        broadcast(new \App\Events\ArticleAccepteEvent($article));
        return true;
    }

    public function addNote($id, $user, $contenu)
    {
        $inventaire = Inventaire::with('affectations')->findOrFail($id);
        if ($inventaire->statut === 'termine') {
            throw new \Exception("Impossible d'ajouter une note à un inventaire terminé.", 403);
        }

        $note = $this->repository->createNote([
            'id_inventaire' => $id,
            'id_user' => $user->id,
            'contenu' => $contenu,
            'lu' => false,
        ]);

        $note->load('user');

        $message = "Nouvelle note de {$user->nom}: " . substr($contenu, 0, 50);

        // One notification for the inventory event (Sender is user->id)
        $this->createNotification('nouvelle note', $id, null, $user->id, $message);

        broadcast(new \App\Events\NoteAdded($note))->toOthers();
        return $note;
    }

    public function updateNote($id, $user, $contenu)
    {
        $note = $this->repository->findNoteById($id);
        // Allow the owner OR an admin to update the note (though usually owners edit their own)
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

    protected function createNotification($type, $inventaireId, $articleId, $userId, $contenu)
    {
        $notif = \App\Models\Notification::create([
            'type' => $type,
            'id_inventaire' => $inventaireId,
            'id_article' => $articleId,
            'id_user' => $userId,
            'contenu' => $contenu,
            'statut' => 'non lu'
        ]);

        broadcast(new \App\Events\NotificationCreated($notif));

        return $notif;
    }
}
