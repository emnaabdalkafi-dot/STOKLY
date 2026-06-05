<?php

namespace App\Repositories;

use App\Models\Inventaire;
use App\Models\LigneInventaire;
use App\Models\Affectation;
use App\Models\Scan;
use Illuminate\Support\Facades\DB;

class InventaireRepository
{
    public function getAll($filters = [])
    {
        $query = Inventaire::with(['affectations.agent', 'lignes.article', 'lignes.entrepot', 'entrepot']);

        if (!empty($filters['site'])) {
            $query->where(function($q) use ($filters) {
                $q->where('site', 'like', '%' . $filters['site'] . '%')
                  ->orWhere('titre', 'like', '%' . $filters['site'] . '%');
            });
        }
        if (!empty($filters['month'])) {
            $query->whereMonth('date_debut', $filters['month']);
        }
        if (!empty($filters['year'])) {
            $query->whereYear('date_debut', $filters['year']);
        }
        if (!empty($filters['id_entrepot'])) {
            $query->where('id_entrepot', $filters['id_entrepot']);
        }
        if (!empty($filters['id_agent'])) {
            $query->whereHas('affectations', function($q) use ($filters) {
                $q->where('id_agent', $filters['id_agent']);
            });
        }
        if (!empty($filters['statut']) && $filters['statut'] !== 'tous') {
            $query->where('statut', $filters['statut']);
        }

        return $query->orderBy('created_at', 'desc')->get();
    }

    public function findById($id)
    {
        return Inventaire::with(['affectations.agent', 'lignes.article', 'lignes.entrepot', 'entrepot'])
            ->findOrFail($id);
    }

    public function getAgentInventories($userId, $filters = [])
    {
        $query = Inventaire::with(['affectations.agent', 'lignes.article', 'lignes.entrepot', 'entrepot'])
            ->whereHas('affectations', function ($q) use ($userId) {
                $q->where('id_agent', $userId);
            });

        if (!empty($filters['statut'])) {
            $query->where('statut', $filters['statut']);
        }
        if (!empty($filters['search'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('titre', 'like', '%' . $filters['search'] . '%')
                  ->orWhere('site', 'like', '%' . $filters['search'] . '%');
            });
        }

        return $query->orderBy('created_at', 'desc')->get();
    }

    public function create(array $data)
    {
        return Inventaire::create($data);
    }

    public function update($id, array $data)
    {
        $inventaire = Inventaire::findOrFail($id);
        $inventaire->update($data);
        return $inventaire;
    }



    public function createAffectation(array $data)
    {
        return Affectation::create($data);
    }

    public function deleteAffectations($inventaireId)
    {
        return Affectation::where('id_inventaire', $inventaireId)->delete();
    }

    public function createLigne(array $data)
    {
        return LigneInventaire::create($data);
    }

    public function deleteLignes($inventaireId, array $excludeArticleIds = [])
    {
        $query = LigneInventaire::where('id_inventaire', $inventaireId);
        if (!empty($excludeArticleIds)) {
            $query->whereNotIn('id_article', $excludeArticleIds);
        }
        return $query->delete();
    }

    public function getLigneByArticle($inventaireId, $articleId, $entrepotId = null)
    {
        $query = LigneInventaire::where('id_inventaire', $inventaireId)
            ->where('id_article', $articleId);
        
        if ($entrepotId) {
            $query->where('id_entrepot', $entrepotId);
        }
            
        return $query->first();
    }

    public function findLigne($id)
    {
        return LigneInventaire::find($id);
    }

    public function createScan(array $data)
    {
        return Scan::create($data);
    }

    public function deleteScans($inventaireId)
    {
        $ligneIds = \App\Models\LigneInventaire::where('id_inventaire', $inventaireId)
            ->pluck('id_ligne');
        return Scan::whereIn('id_ligne', $ligneIds)->delete();
    }



    public function getScansByArticle($inventaireId)
    {
        return Scan::join('ligne_inventaires', 'scans.id_ligne', '=', 'ligne_inventaires.id_ligne')
            ->where('ligne_inventaires.id_inventaire', $inventaireId)
            ->select(
                'ligne_inventaires.id_article',
                'ligne_inventaires.id_entrepot',
                'scans.id_agent',
                DB::raw('SUM(scans.quantite) as total_scanee')
            )
            ->groupBy('ligne_inventaires.id_article', 'ligne_inventaires.id_entrepot', 'scans.id_agent')
            ->with('agent')
            ->get();
    }

    public function getNotes($inventaireId, $filters = [])
    {
        $query = \App\Models\Note::where('id_inventaire', $inventaireId)->with('user');

        if (!empty($filters['search'])) {
            $query->where('contenu', 'like', '%' . $filters['search'] . '%');
        }

        if (!empty($filters['filter'])) {
            switch ($filters['filter']) {
                case 'admin':
                    $query->whereHas('user', function($q) { $q->where('role', 'admin'); });
                    break;
                case 'mine':
                    $query->where('id_user', $filters['user_id']);
                    break;
            }
        }

        return $query->orderByDesc('created_at')->get();
    }

    public function createNote(array $data)
    {
        return \App\Models\Note::create($data);
    }

    public function findNoteById($id)
    {
        return \App\Models\Note::findOrFail($id);
    }

    public function deleteNote($id)
    {
        $note = \App\Models\Note::findOrFail($id);
        return $note->delete();
    }

    public function markNoteAsRead($id)
    {
        $note = \App\Models\Note::findOrFail($id);
        $note->update(['lu' => true]);
        return $note;
    }



    public function getProposedArticles()
    {
        return \App\Models\Article::inconnu()
            ->with('proposePar')
            ->orderByDesc('created_at')
            ->get();
    }

    public function findArticleById($id)
    {
        return \App\Models\Article::findOrFail($id);
    }
}
