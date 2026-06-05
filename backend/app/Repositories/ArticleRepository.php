<?php

namespace App\Repositories;

use App\Models\Article;
use App\Models\Category;
use App\Models\Entrepot;

class ArticleRepository
{
    public function getAll()
    {
        return Article::with(['categories', 'entrepots', 'lignesInventaire.inventaire'])->get();
    }

    public function findById($id)
    {
        return Article::with(['categories', 'entrepots', 'lignesInventaire.inventaire'])->findOrFail($id);
    }

public function findConnuByCodeBarres($code)
{
    return Article::where('code_barres', $code)
        ->where('etat', 'connu')
        ->first();
}

public function createConnu(array $data)
{
    return Article::create([
        'code_barres' => $data['code_barres'],
        'nom' => $data['nom'] ?? null,
        'prix' => $data['prix'] ?? null,
        'etat' => 'connu',
        'quantite_total' => 0
    ]);
}
public function updateBasicInfo($article, $data)
{
    if (!empty($data['nom'])) {
        $article->nom = $data['nom'];
    }

    if (!empty($data['prix'])) {
        $article->prix = $data['prix'];
    }

    $article->save();

    return $article;
}
public function resolveCategories($categories)
{
    $names = is_array($categories)
        ? $categories
        : explode(',', $categories);

    $ids = [];

    foreach ($names as $name) {
        $cat = $this->findOrCreateCategory(trim($name));
        $ids[] = $cat->id_category;
    }

    return $ids;
}


    public function create(array $data)
    {
        return Article::create($data);
    }

    public function update(Article $article, array $data)
    {
        $article->update($data);
        return $article;
    }

    public function delete(Article $article)
    {
        return $article->delete();
    }

    public function deleteByIds(array $ids)
    {
        return Article::whereIn('id_article', $ids)->delete();
    }

    public function syncCategories(Article $article, array $categoryIds)
    {
        $article->categories()->sync($categoryIds);
    }

    public function syncEntrepots(Article $article, array $syncData)
    {
        $article->entrepots()->sync($syncData);
    }

    public function attachCategories(Article $article, array $categoryIds)
    {
        $article->categories()->syncWithoutDetaching($categoryIds);
    }

    public function attachEntrepots(Article $article, array $syncData)
    {
        $article->entrepots()->syncWithoutDetaching($syncData);
    }

    public function findOrCreateCategory($name)
    {
        return Category::firstOrCreate(['nom' => trim($name)]);
    }

    public function findOrCreateEntrepot($name)
    {
        return Entrepot::firstOrCreate(['nom' => trim($name)]);
    }

    public function firstOrNew(array $attributes)
    {
        return Article::firstOrNew($attributes);
    }

    public function getFirstEntrepot()
    {
        return Entrepot::first();
    }
}
