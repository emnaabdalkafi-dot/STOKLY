<?php

namespace App\Repositories;

use App\Models\Correction;

class CorrectionRepository
{
    public function getAll($statut = null)
    {
        $query = Correction::with(['ligne.article', 'ligne.inventaire', 'ligne.entrepot', 'agent']);

        // Par défaut, uniquement les corrections en attente
        $query->where('statut_validation', $statut ?? 'en attente');

        return $query->orderByDesc('created_at')->get();
    }

    public function delete($id)
    {
        $correction = $this->findById($id);
        $correction->delete();
        return true;
    }

    public function findById($id)
    {
        return Correction::findOrFail($id);
    }

    public function create(array $data)
    {
        return Correction::create($data);
    }

    public function update($id, array $data)
    {
        $correction = $this->findById($id);
        $correction->update($data);
        return $correction;
    }
}
