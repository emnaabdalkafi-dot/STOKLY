<?php

namespace App\Repositories;

use App\Models\Entrepot;
use App\Models\Category;

class StockRepository
{
    public function getAllEntrepots()
    {
        return Entrepot::withCount('articles')->get();
    }

    public function findEntrepotById($id)
    {
        return Entrepot::findOrFail($id);
    }

    public function createEntrepot(array $data)
    {
        return Entrepot::create($data);
    }

    public function updateEntrepot(Entrepot $entrepot, array $data)
    {
        $entrepot->update($data);
        return $entrepot;
    }

    public function deleteEntrepot(Entrepot $entrepot)
    {
        $entrepot->articles()->detach();
        return $entrepot->delete();
    }

    public function getEntrepotArticleCount(Entrepot $entrepot)
    {
        return $entrepot->articles()->count();
    }

    public function getAllCategories()
    {
        return Category::all();
    }

    public function findCategoryById($id)
    {
        return Category::findOrFail($id);
    }

    public function createCategory(array $data)
    {
        return Category::create($data);
    }

    public function updateCategory(Category $category, array $data)
    {
        $category->update($data);
        return $category;
    }

    public function deleteCategory(Category $category)
    {
        return $category->delete();
    }

    public function deleteAllEntrepots()
    {
        \DB::table('ligne_entrepots')->delete();
        return Entrepot::query()->delete();
    }

    public function deleteAllCategories()
    {
        return Category::query()->delete();
    }
}
