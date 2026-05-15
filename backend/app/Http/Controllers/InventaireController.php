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
                'termines' => Inventaire::where('statut', 'termine')->count(),
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
            'statut' => 'required|in:en cours,en attente,termine',
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

    public function destroy($id)
    {
        $this->repository->delete($id);
        return response()->json(['success' => true, 'message' => 'Inventaire supprimé']);
    }

    public function startInventaire(Request $request, $id)
    {
        $inventaire = $this->service->startInventaire($id, $request->user());
        return response()->json(['success' => true, 'message' => 'Inventaire démarré', 'data' => $inventaire]);
    }

    public function scanBarcode(Request $request, $id)
    {
        $request->validate([
            'code_barres' => 'required|string',
            'quantite' => 'nullable|integer|min:1',
            'id_entrepot' => 'nullable|integer|exists:entrepots,id_entrepot'
        ]);
        
        $quantite = $request->input('quantite', 1);
        $idEntrepot = $request->input('id_entrepot');
        $result = $this->service->scanArticle($id, $request->code_barres, $request->user()->id, $quantite, $idEntrepot);
        
        return response()->json($result, $result['success'] ? 200 : 404);
    }

    public function stopInventaire(Request $request, $id)
    {
        $this->service->stopInventaire($id, $request->user());
        return response()->json(['success' => true, 'message' => 'Inventaire arrêté']);
    }

    public function getSummary($id)
    {
        // For simplicity and to avoid over-engineering the summary DTO, 
        // we can keep some mapping logic in the service but this one is already quite clean in terms of dependencies.
        // I'll keep the response structure here.
        
        $inventaire = Inventaire::findOrFail($id);

        if ($inventaire->statut === 'termine') {
            $rapport = $this->repository->findRapportByInventaire($id);
            if ($rapport) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'id_inventaire' => $rapport->id_inventaire,
                        'titre' => $rapport->titre,
                        'site' => $rapport->site,
                        'type_source' => $rapport->type_source,
                        'date_debut' => $rapport->date_debut,
                        'date_fin' => $rapport->date_fin,
                        'total_articles' => $rapport->total_articles,
                        'articles_comptes' => $rapport->articles_comptes,
                        'sans_ecart_count' => $rapport->sans_ecart_count,
                        'ecart_positif_count' => $rapport->ecarts_positifs,
                        'ecart_negatif_count' => $rapport->ecarts_negatifs,
                        'ecart_positif_price' => $rapport->ecart_positif_price,
                        'ecart_negatif_price' => $rapport->ecart_negatif_price,
                        'agent_names' => $rapport->agents_details,
                        'total_qty_theorique' => $rapport->donnees_json['total_qty_theorique'] ?? 0,
                        'total_qty_comptee' => $rapport->donnees_json['total_qty_comptee'] ?? 0,
                        'taux_avancement' => $rapport->taux_avancement,
                        'statut' => 'termine',
                        'fichier_path' => $rapport->fichier_path,
                        'correction_details' => $rapport->correction_details,
                        'lignes' => collect($rapport->lignes_details)->map(fn($l) => [
                            'nom' => $l['nom'],
                            'code_barres' => $l['code_barres'],
                            'quantite_theorique' => $l['theorique'],
                            'quantite_comptee' => $l['comptee'],
                            'ecart' => $l['ecart'],
                            'agents_contrib' => $l['agents_contrib'] ?? ''
                        ]),
                    ]
                ]);
            }
        }

        $inventaire->load(['lignes.article', 'affectations.agent']);
        $scansByArticle = $this->repository->getScansByArticle($id)->groupBy('id_article');

        $ecartsPositifs = $inventaire->lignes->where('ecart', '>', 0);
        $ecartsNegatifs = $inventaire->lignes->where('ecart', '<', 0);

        return response()->json([
            'success' => true,
            'data' => [
                'id_inventaire' => $inventaire->id_inventaire,
                'titre' => $inventaire->titre,
                'site' => $inventaire->site,
                'statut' => $inventaire->statut,
                'total_articles' => $inventaire->lignes->count(),
                'sans_ecart_count' => $inventaire->lignes->where('ecart', 0)->count(),
                'ecart_positif_count' => $ecartsPositifs->count(),
                'ecart_positif_price' => $ecartsPositifs->reduce(fn($carry, $item) => $carry + ($item->ecart * ($item->article->prix ?? 0)), 0),
                'ecart_negatif_count' => $ecartsNegatifs->count(),
                'ecart_negatif_price' => $ecartsNegatifs->reduce(fn($carry, $item) => $carry + (abs($item->ecart) * ($item->article->prix ?? 0)), 0),
                'agent_names' => $inventaire->affectations->map(fn($a) => ($a->agent->nom ?? '') . ' ' . ($a->agent->prenom ?? ''))->filter()->values(),
                'lignes' => $inventaire->lignes->map(function($l) use ($scansByArticle) {
                    $articleScans = $scansByArticle->get($l->id_article) ?? collect();
                    return [
                        'id_ligne' => $l->id_ligne,
                        'id_article' => $l->id_article,
                        'nom' => $l->article->nom,
                        'code_barres' => $l->article->code_barres,
                        'quantite_theorique' => $l->quantite_theorique,
                        'quantite_comptee' => $l->quantite_comptee,
                        'ecart' => $l->ecart,
                        'agents_contrib' => $articleScans->map(fn($s) => ($s->agent->nom ?? 'Agent') . ' (' . $s->total_scanee . ')')->implode(', ')
                    ];
                })
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
            return response()->json(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 400);
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

    public function getRapports()
    {
        return response()->json(['success' => true, 'data' => $this->repository->getAllRapports()]);
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
