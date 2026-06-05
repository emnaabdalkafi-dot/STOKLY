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
            $ligne = LigneInventaire::with(['article', 'inventaire', 'entrepot'])->findOrFail($data['id_ligne_inventaire']);
            
            if ($data['qte'] > ($ligne->quantite_comptee ?? 0)) {
                throw new \Exception("La quantité à corriger ne peut pas être supérieure à la quantité comptée.", 400);
            }

            $correction = $this->repository->create([
                'id_ligne_inventaire' => $data['id_ligne_inventaire'],
                'id_agent' => $user->id,
                'qte' => $data['qte'],
                'description' => $data['description'],
                'statut_validation' => 'en attente',
            ]);

            $articleCode = $ligne->article->code_barres ?? 'N/A';
            $articleName = $ligne->article->nom ?? 'Article inconnu';
            $entrepotName = $ligne->entrepot?->nom ?? 'Entrepôt inconnu';

            $notif = Notification::create([
                'type' => 'demande de correction',
                'id_inventaire' => $ligne->id_inventaire,
                'id_article' => $ligne->id_article,
                'contenu' => "Demande de correction de l'agent {$user->nom} sur l'article {$articleName} ({$articleCode}) en entrepôt {$entrepotName} : réduction demandée {$data['qte']} - Motif : {$data['description']}",
                'statut' => 'non lu'
            ]);
            
            broadcast(new \App\Events\NotificationCreated($notif));

            return $correction;
        });
    }

    public function validateCorrection($id, $user, array $data)
    {
        return DB::transaction(function () use ($id, $user, $data) {
            $correction = $this->repository->findById($id);
            $ligne = LigneInventaire::findOrFail($correction->id_ligne_inventaire);

            if ($data['statut'] === 'valide') {
                $newCounted = max(0, ($ligne->quantite_comptee ?? 0) - $correction->qte);
                $newEcart = ($newCounted == 0 || $newCounted == ($ligne->quantite_theorique ?? 0)) ? 0 : $newCounted - ($ligne->quantite_theorique ?? 0);

                $ligne->update([
                    'quantite_comptee' => $newCounted,
                    'ecart' => $newEcart,
                ]);

                $this->repository->update($id, [
                    'statut_validation' => 'valide',
                ]);

                $articleName = $ligne->article->nom ?? 'Article inconnu';
                $articleCode = $ligne->article->code_barres ?? 'N/A';
                $entrepotName = $ligne->entrepot?->nom ?? 'Entrepôt inconnu';

                 
                broadcast(new \App\Events\ScanEnregistre(
                    $ligne->id_inventaire, 
                    $ligne->article, 
                    $correction->id_agent, 
                    $ligne->quantite_comptee, 
                    $ligne->ecart
                ))->toOthers();

            } else {
                // En cas de refus : envoyer notification puis supprimer la correction
                $articleName = $ligne->article->nom ?? 'Article inconnu';
                $articleCode = $ligne->article->code_barres ?? 'N/A';
                $entrepotName = $ligne->entrepot?->nom ?? 'Entrepôt inconnu';

                // Supprimer la correction
                $this->repository->delete($id);

                return null;
            }

            return $correction->refresh();
        });
    }
}
