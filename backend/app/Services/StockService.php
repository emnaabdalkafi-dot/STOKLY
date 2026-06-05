<?php

namespace App\Services;

use App\Repositories\StockRepository;

class StockService
{
    protected $repository;

    public function __construct(StockRepository $repository)
    {
        $this->repository = $repository;
    }

    public function listEntrepots()
    {
        return $this->repository->getAllEntrepots();
    }

    public function createEntrepot(array $data)
    {
        return $this->repository->createEntrepot($data);
    }

    public function updateEntrepot($id, array $data)
    {
        $entrepot = $this->repository->findEntrepotById($id);
        return $this->repository->updateEntrepot($entrepot, $data);
    }

    public function checkEntrepotUsage($id)
    {
        $entrepot = $this->repository->findEntrepotById($id);
        return $this->repository->getEntrepotArticleCount($entrepot);
    }

    public function deleteEntrepot($id)
    {
        $entrepot = $this->repository->findEntrepotById($id);
        return $this->repository->deleteEntrepot($entrepot);
    }

    public function listCategories()
    {
        return $this->repository->getAllCategories();
    }

    public function createCategory(array $data)
    {
        return $this->repository->createCategory($data);
    }

    public function updateCategory($id, array $data)
    {
        $category = $this->repository->findCategoryById($id);
        return $this->repository->updateCategory($category, $data);
    }

    public function deleteCategory($id)
    {
        $category = $this->repository->findCategoryById($id);
        return $this->repository->deleteCategory($category);
    }

    public function deleteAllEntrepots()
    {
        return $this->repository->deleteAllEntrepots();
    }

    public function deleteAllCategories()
    {
        return $this->repository->deleteAllCategories();
    }
}
