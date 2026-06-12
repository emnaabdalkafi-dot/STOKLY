<?php

namespace App\Http\Controllers;

use App\Models\Inventaire;

use App\Services\InventaireService;
use App\Repositories\InventaireRepository;
use Illuminate\Http\Request;

class InventaireController extends Controller
{
    protected $service;
    protected $repository;

    public function __construct(InventaireService $service, InventaireRepository $repository)
    {
        $this->service = $service;
        $this->repository = $repository;
    }

    public function index(Request $request)
    {
        $inventaires = $this->repository->getAll($request->all());
        return response()->json(['success' => true, 'data' => $inventaires]);
    }

    public function statistics()
    {
        return response()->json([
            'success' => true,
            'data' => [
                'total' => Inventaire::count(),
                'en_attente' => Inventaire::where('statut', 'en attente')->count(),
                'en_cours' => Inventaire::where('statut', 'en cours')->count(),
                'clotures' => Inventaire::where('statut', 'cloture')->count(),
            ]
        ]);
    }

    public function show($id)
    {
        $inventaire = $this->repository->findById($id);
        return response()->json(['success' => true, 'data' => $inventaire]);
    }

    public function agentInventories(Request $request)
    {
        $inventaires = $this->repository->getAgentInventories($request->user()->id, $request->all());
        return response()->json(['success' => true, 'data' => $inventaires]);
    }

    public function store(Request $request)
    {
        $this->validateInventaire($request);
        $inventaire = $this->service->createInventaire($request->all());
        return response()->json(['success' => true, 'data' => $inventaire], 201);
    }

    public function update(Request $request, $id)
    {
        $this->validateInventaire($request, true);
        $inventaire = $this->service->updateInventaire($id, $request->all());
        return response()->json(['success' => true, 'data' => $inventaire]);
    }

    protected function validateInventaire(Request $request, $isUpdate = false)
    {
        $rules = [
            'titre' => 'required|string|max:255',
            'date_debut' => 'required|date',
            'date_fin' => 'required|date|after:date_debut',
            'site' => 'required|string|max:255',
            'statut' => 'required|in:en cours,en attente,cloture',
            'remarque' => 'nullable|string',
            'agents' => 'required|array|min:1',
            'agents.*' => 'exists:utilisateurs,id',
        ];

        if (!$isUpdate) {
            $rules['type_source'] = 'required|in:tous,entrepot,article';
            $rules['id_entrepot'] = 'required_if:type_source,entrepot|nullable|exists:entrepots,id_entrepot';
        }

        if ($request->type_source === 'article') {
            $rules['articles'] = 'required|array|min:1';
            $rules['articles.*'] = 'exists:articles,id_article';
        }

        $request->validate($rules, [
            'titre.required' => 'Le titre est obligatoire.',
            'date_fin.after' => 'La date de fin doit être supérieure à la date de début.',
            'agents.required' => 'Veuillez sélectionner au moins un agent.',
        ]);
    }

    public function startInventaire(Request $request, $id)
    {
        $inventaire = $this->service->startInventaire($id, $request->user());
        return response()->json(['success' => true, 'message' => 'Inventaire démarré', 'data' => $inventaire]);
    }

    public function scanBarcode(Request $request, $id)
    {
        $inventaire = Inventaire::findOrFail($id);

        if (in_array($inventaire->type_source, ['tous', 'article'])) {
            $hasEntrepots = \App\Models\Entrepot::count() > 0;
            $request->validate([
                'code_barres' => 'required|string',
                'quantite' => 'nullable|integer|min:1',
                'id_entrepot' => $hasEntrepots ? 'required|integer|exists:entrepots,id_entrepot' : 'nullable'
            ], [
                'id_entrepot.required' => 'Le choix de l\'entrepôt est obligatoire pour ce type d\'inventaire.'
            ]);
        } else {
            $request->validate([
                'code_barres' => 'required|string',
                'quantite' => 'nullable|integer|min:1',
                'id_entrepot' => 'nullable|integer|exists:entrepots,id_entrepot'
            ]);
        }
        
        $quantite = $request->input('quantite', 1);
        $idEntrepot = $request->input('id_entrepot');

        if ($inventaire->type_source === 'entrepot' && empty($idEntrepot)) {
            $idEntrepot = $inventaire->id_entrepot;
        }

        $result = $this->service->scanArticle($id, $request->code_barres, $request->user()->id, $quantite, $idEntrepot);
        
        return response()->json($result, $result['success'] ? 200 : 404);
    }

    public function addKnownArticleToInventory(Request $request, $id)
    {
        $request->validate([
            'code_barres' => 'required|string',
            'quantite' => 'nullable|integer|min:1',
            'id_entrepot' => 'nullable|integer|exists:entrepots,id_entrepot'
        ]);

        $quantite = $request->input('quantite', 1);
        $idEntrepot = $request->input('id_entrepot');

        try {
            $result = $this->service->addKnownArticleToInventory($id, $request->code_barres, $request->user(), $quantite, $idEntrepot);
            return response()->json(['success' => true, 'data' => $result, 'message' => 'Article ajouté à l\'inventaire avec succès.'], 201);
        } catch (\Exception $e) {
            $code = $e->getCode();
            if (!is_numeric($code) || $code < 100 || $code >= 600) {
                $code = 400;
            }
            return response()->json(['success' => false, 'message' => $e->getMessage()], $code);
        }
    }

    public function stopInventaire(Request $request, $id)
    {
        $this->service->stopInventaire($id, $request->user());
        return response()->json(['success' => true, 'message' => 'Inventaire arrêté']);
    }

    public function getSummary($id)
    {
         
        $inventaire = Inventaire::findOrFail($id);



        $inventaire->load(['lignes.article', 'lignes.entrepot', 'affectations.agent']);
        $scansByArticle = $this->repository->getScansByArticle($id)->groupBy('id_article');

        // Map lines directly without grouping by id_article
        $groupedLignes = $inventaire->lignes->map(function($ligne) use ($scansByArticle) {
            $article = $ligne->article;
            $idArticle = $ligne->id_article;
            
            $articleScans = $scansByArticle->get($idArticle) ?? collect();
            // Filter scans if they belong to this entrepot if possible, but currently we just show all agents for this article
            $agentsContrib = $articleScans
                ->map(fn($s) => trim((($s->agent->nom ?? '') . ' ' . ($s->agent->prenom ?? '')) . ($s->agent->email ? ' <' . $s->agent->email . '>' : '')))
                ->unique()
                ->filter()
                ->implode(', ');

            $totalTheorique = $ligne->quantite_theorique ?? 0;
            $totalComptee = $ligne->quantite_comptee ?? 0;

            return [
                'id_ligne' => $ligne->id_ligne,
                'id_article' => $idArticle,
                'nom' => $article->nom ?? '...',
                'code_barres' => $article->code_barres ?? '...',
                'prix' => $article->prix ?? 0,
                'quantite_theorique' => $totalTheorique,
                'quantite_comptee' => $totalComptee,
                'ecart' => $ligne->ecart ?? ($totalComptee - $totalTheorique),
                'agents_contrib' => $agentsContrib,
                'entrepot' => ['nom' => $ligne->entrepot->nom ?? 'Tous']
            ];
        });

        // Sort by code_barres ascending
        $sortedLignes = $groupedLignes->sortBy('code_barres')->values();

        // Calculate summary counters using the grouped/unique list
        $totalArticles = $sortedLignes->count();
        $sansEcartCount = $sortedLignes->where('ecart', 0)->count();
        
        $ecartsPositifs = $sortedLignes->where('ecart', '>', 0);
        $ecartPositifPrice = $ecartsPositifs->reduce(fn($carry, $item) => $carry + ($item['ecart'] * $item['prix']), 0);

        $ecartsNegatifs = $sortedLignes->where('ecart', '<', 0);
        $ecartNegatifPrice = $ecartsNegatifs->reduce(fn($carry, $item) => $carry + (abs($item['ecart']) * $item['prix']), 0);

        return response()->json([
            'success' => true,
            'data' => [
                'id_inventaire' => $inventaire->id_inventaire,
                'titre' => $inventaire->titre,
                'site' => $inventaire->site,
                'statut' => $inventaire->statut,
                'fichier_path' => $inventaire->fichier_path,
                'total_articles' => $totalArticles,
                'sans_ecart_count' => $sansEcartCount,
                'ecart_positif_count' => $ecartsPositifs->count(),
                'ecart_positif_price' => $ecartPositifPrice,
                'ecart_negatif_count' => $ecartsNegatifs->count(),
                'ecart_negatif_price' => $ecartNegatifPrice,
                'agent_names' => $inventaire->affectations->map(fn($a) => ($a->agent->nom ?? '') . ' ' . ($a->agent->prenom ?? ''))->filter()->values(),
                'lignes' => $sortedLignes,
                // Include pending correction requests for this inventory
                'corrections' => \App\Models\Correction::whereIn('id_ligne_inventaire', $inventaire->lignes->pluck('id_ligne'))
                    ->where('statut_validation', 'valide')
                    ->with(['agent', 'ligne.article', 'ligne.entrepot'])
                    ->get()
                    ->map(fn($c) => [
                        'id_corr' => $c->id_corr,
                        'id_ligne' => $c->id_ligne_inventaire,
                        'id_agent' => $c->id_agent,
                        'agent' => $c->agent ? ['nom' => $c->agent->nom ?? null, 'prenom' => $c->agent->prenom ?? null] : null,
                        'qte' => $c->qte,
                        'description' => $c->description,
                        'ligne' => $c->ligne ? [
                            'id_ligne' => $c->ligne->id_ligne,
                            'id_article' => $c->ligne->id_article,
                            'article' => $c->ligne->article ? ['nom' => $c->ligne->article->nom ?? null, 'code_barres' => $c->ligne->article->code_barres ?? null] : null,
                            'entrepot' => $c->ligne->entrepot ? ['nom' => $c->ligne->entrepot->nom ?? null] : null,
                        ] : null,
                    ])
            ]
        ]);
    }

    public function terminate(Request $request, $id)
    {
        try {
            $reportUrl = $this->service->terminateInventaire($id, $request->all());
            return response()->json([
                'success' => true,
                'message' => 'Inventaire terminé.',
                'report_url' => $reportUrl
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    public function proposeArticle(Request $request, $id)
    {
        $request->validate([
            'code_barres' => 'required|string',
            'nom' => 'required|string|max:255',
            'quantite' => 'nullable|integer|min:1',
            'id_entrepot' => 'nullable|exists:entrepots,id_entrepot',
        ]);

        try {
            $article = $this->service->proposeArticle($id, $request->user(), $request->all());
            return response()->json(['success' => true, 'data' => $article, 'message' => 'Article proposé avec succès.'], 201);
        } catch (\Exception $e) {
            $code = $e->getCode();
            if (!is_numeric($code) || $code < 100 || $code >= 600) {
                $code = 400;
            }
            return response()->json(['success' => false, 'message' => $e->getMessage()], $code);
        }
    }

    public function acceptArticle(Request $request, $id)
    {
        $this->service->acceptArticle($id);
        return response()->json(['success' => true, 'message' => 'Article accepté.']);
    }

    public function getProposedArticles()
    {
        return response()->json(['success' => true, 'data' => $this->repository->getProposedArticles()]);
    }

    public function getNotes(Request $request, $id)
    {
        $notes = $this->repository->getNotes($id, [
            'search' => $request->search,
            'filter' => $request->filter,
            'user_id' => $request->user()->id
        ]);

        return response()->json(['success' => true, 'data' => $notes]);
    }

    public function addNote(Request $request, $id)
    {
        $request->validate(['contenu' => 'required|string']);
        $note = $this->service->addNote($id, $request->user(), $request->contenu);
        return response()->json(['success' => true, 'data' => $note], 201);
    }

    public function updateNote(Request $request, $id)
    {
        $request->validate(['contenu' => 'required|string']);
        try {
            $note = $this->service->updateNote($id, $request->user(), $request->contenu);
            return response()->json(['success' => true, 'data' => $note]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 400);
        }
    }

    public function deleteNote(Request $request, $id)
    {
        try {
            $this->service->deleteNote($id, $request->user());
            return response()->json(['success' => true, 'message' => 'Note supprimée']);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 400);
        }
    }

    public function markNoteAsRead($id)
    {
        $this->repository->markNoteAsRead($id);
        return response()->json(['success' => true, 'message' => 'Note marquée comme lue.']);
    }
}
