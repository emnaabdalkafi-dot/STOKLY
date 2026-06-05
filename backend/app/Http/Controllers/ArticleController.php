<?php

namespace App\Http\Controllers;

use App\Services\ArticleService;
use Illuminate\Http\Request;

class ArticleController extends Controller
{
    protected $service;

    public function __construct(ArticleService $service)
    {
        $this->service = $service;
    }

    public function index()
    {
        $articles = $this->service->getAllArticles();
        return response()->json(['success' => true, 'data' => $articles]);
    }

    public function stats()
    {
        $stats = $this->service->getArticleStats();
        return response()->json(['success' => true, 'data' => $stats]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'code_barres' => 'required|string',
            'nom' => 'nullable|string|max:255',
            'prix' => 'nullable|numeric',
            'etat' => 'nullable|string',
            'quantite_total' => 'nullable|integer',
            'categories' => 'array',
            'entrepots' => 'array',
        ]);
        $exists = \App\Models\Article::where('code_barres', $data['code_barres'])->where('etat', 'connu')->exists();
        if ($exists) {
            return response()->json(['errors' => ['code_barres' => ['Un article avec ce code-barres existe déjà.']]], 422);
        }
        $article = $this->service->createArticle($data);
        return response()->json(['success' => true, 'data' => $article], 201);
    }

    public function update(Request $request, $id)
    {
        $data = $request->validate([
            'code_barres' => 'sometimes|required|string',
            'nom' => 'nullable|string|max:255',
            'prix' => 'nullable|numeric',
            'quantite_total' => 'nullable|integer',
            'categories' => 'array',
            'entrepots' => 'array',
        ]);

        try {
            $article = $this->service->updateArticle($id, $data);
            return response()->json(['success' => true, 'data' => $article]);
        } catch (\Exception $e) {
            $statusCode = $e->getCode();
            if ($statusCode < 400 || $statusCode > 599) {
                $statusCode = 400;
            }
            return response()->json(['message' => $e->getMessage()], $statusCode);
        }
    }

    public function destroy($id)
    {
        $this->service->deleteArticle($id);
        return response()->json(['success' => true, 'message' => 'Article supprimé avec succès']);
    }

    public function bulkDelete(Request $request)
    {
        $request->validate(['ids' => 'required|array']);
        $this->service->bulkDeleteArticles($request->ids);
        return response()->json(['success' => true, 'message' => count($request->ids) . ' articles supprimés avec succès']);
    }

    public function import(Request $request)
    {
        $request->validate(['articles' => 'required|array']);
        $count = $this->service->importArticles($request->articles);
        return response()->json(['success' => true, 'message' => "$count articles importés avec succès."]);
    }

    public function attachCategories(Request $request)
    {
        $request->validate(['ids' => 'required|array', 'categories' => 'required|array']);
        $this->service->attachCategoriesToArticles($request->ids, $request->categories);
        return response()->json(['success' => true, 'message' => 'Catégories ajoutées avec succès']);
    }

    public function attachEntrepots(Request $request)
    {
        $request->validate(['ids' => 'required|array', 'entrepots' => 'required|array']);
        $this->service->attachEntrepotsToArticles($request->ids, $request->entrepots);
        return response()->json(['success' => true, 'message' => 'Entrepôts ajoutés avec succès']);
    }
}
