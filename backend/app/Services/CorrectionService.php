<?php

namespace App\Services;

use App\Repositories\CorrectionRepository;
use App\Models\LigneInventaire;
use App\Models\Notification;
use Illuminate\Support\Facades\DB;

class CorrectionService
{
    protected $repository;

    public function __construct(CorrectionRepository $repository)
    {
        $this->repository = $repository;
    }

    public function listCorrections($statut = null)
    {
        return $this->repository->getAll($statut);
    }

    public function requestCorrection($user, array $data)
    {
        return DB::transaction(function () use ($user, $data) {
            $correction = $this->repository->create([
                'id_ligne_inventaire' => $data['id_ligne_inventaire'],
                'id_agent' => $user->id,
                'qte' => $data['qte'],
                'description' => $data['description'],
                'statut_validation' => 'en attente',
            ]);

            $ligne = LigneInventaire::with(['article', 'inventaire'])->find($data['id_ligne_inventaire']);

            Notification::create([
                'type' => 'demande de correction',
                'id_inventaire' => $ligne->id_inventaire,
                'id_article' => $ligne->id_article,
                'id_user' => $user->id,
                'contenu' => "Demande de correction de l'agent {$user->nom} sur l'article {$ligne->article->nom} (Qte: {$data['qte']})",
                'statut' => 'non lu'
            ]);

            return $correction;
        });
    }

    public function validateCorrection($id, $user, array $data)
    {
        return DB::transaction(function () use ($id, $user, $data) {
            $correction = $this->repository->findById($id);
            $ligne = LigneInventaire::findOrFail($correction->id_ligne_inventaire);

            if ($data['statut'] === 'valide') {
                $ligne->update([
                    'quantite_comptee' => $correction->qte,
                    'ecart' => $correction->qte - ($ligne->quantite_theorique ?? 0)
                ]);

                $this->repository->update($id, [
                    'statut_validation' => 'valide',
                ]);

                Notification::create([
                    'type' => 'demande de correction',
                    'id_inventaire' => $ligne->id_inventaire,
                    'id_article' => $ligne->id_article,
                    'id_user' => $correction->id_agent,
                    'contenu' => "Votre demande de correction pour {$ligne->article->nom} a été acceptée.",
                    'statut' => 'non lu'
                ]);
                
                broadcast(new \App\Events\ScanEnregistre(
                    $ligne->id_inventaire, 
                    $ligne->article, 
                    $correction->id_agent, 
                    $ligne->quantite_comptee, 
                    $ligne->ecart
                ))->toOthers();

            } else {
                $this->repository->update($id, [
                    'statut_validation' => 'refuse',
                ]);

                Notification::create([
                    'type' => 'demande de correction',
                    'id_inventaire' => $ligne->id_inventaire,
                    'id_article' => $ligne->id_article,
                    'id_user' => $correction->id_agent,
                    'contenu' => "Votre demande de correction pour {$ligne->article->nom} a été refusée.",
                    'statut' => 'non lu'
                ]);
            }

            return $correction->refresh();
        });
    }
}
