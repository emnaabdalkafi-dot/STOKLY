<?php

namespace App\Http\Controllers;

use App\Services\StockService;
use Illuminate\Http\Request;

class StockController extends Controller
{
    protected $service;

    public function __construct(StockService $service)
    {
        $this->service = $service;
    }

    // ====== ENTREPOTS ======
    public function getEntrepots()
    {
        $entrepots = $this->service->listEntrepots();
        return response()->json(['success' => true, 'data' => $entrepots]);
    }

    public function createEntrepot(Request $request)
    {
        $request->validate([
            'nom' => 'required|string|max:255',
            'location' => 'nullable|string|max:255',
        ]);

        $entrepot = $this->service->createEntrepot($request->all());
        return response()->json(['success' => true, 'data' => $entrepot], 201);
    }

    public function updateEntrepot(Request $request, $id)
    {
        $request->validate([
            'nom' => 'sometimes|required|string|max:255',
            'location' => 'nullable|string|max:255',
        ]);

        $entrepot = $this->service->updateEntrepot($id, $request->all());
        return response()->json(['success' => true, 'data' => $entrepot]);
    }

    public function checkEntrepot($id)
    {
        $articleCount = $this->service->checkEntrepotUsage($id);
        return response()->json(['success' => true, 'article_count' => $articleCount]);
    }

    public function deleteEntrepot($id)
    {
        $this->service->deleteEntrepot($id);
        return response()->json(['success' => true, 'message' => 'Entrepôt supprimé avec succès']);
    }

    // ====== CATEGORIES ======
    public function getCategories()
    {
        $categories = $this->service->listCategories();
        return response()->json(['success' => true, 'data' => $categories]);
    }

    public function createCategory(Request $request)
    {
        $request->validate([
            'nom' => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        $category = $this->service->createCategory($request->all());
        return response()->json(['success' => true, 'data' => $category], 201);
    }

    public function updateCategory(Request $request, $id)
    {
        $request->validate([
            'nom' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
        ]);

        $category = $this->service->updateCategory($id, $request->all());
        return response()->json(['success' => true, 'data' => $category]);
    }

    public function deleteCategory($id)
    {
        $this->service->deleteCategory($id);
        return response()->json(['success' => true, 'message' => 'Catégorie supprimée avec succès']);
    }
}
