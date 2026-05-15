<?php

namespace App\Repositories;

use App\Models\Affectation;
use App\Models\Inventaire;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AgentRepository
{
    // ─────────────────────────────────────────
    //  LIST + FILTERS
    // ─────────────────────────────────────────
    public function searchAgents($filters = [])
    {
        $query = User::where('role', 'agent')
            ->with(['affectations.inventaire']);

        if (!empty($filters['search'])) {
            $s = $filters['search'];
            $query->where(function ($q) use ($s) {
                $q->where('nom',    'like', "%{$s}%")
                  ->orWhere('prenom', 'like', "%{$s}%")
                  ->orWhere('email',  'like', "%{$s}%");
            });
        }

        if (!empty($filters['status'])) {

    if ($filters['status'] === 'actif') {
        $query->whereHas('affectations', function ($q) {
            $q->where('statut_participation', 'actif');
        });
    }

    if ($filters['status'] === 'inactif') {
        $query->whereDoesntHave('affectations', function ($q) {
            $q->where('statut_participation', 'actif');
        });
    }
}

        if (!empty($filters['inventaire_id'])) {
            $query->whereHas('affectations', fn($q) =>
                $q->where('id_inventaire', $filters['inventaire_id'])
            );
        }

        $agents = $query->get();

        foreach ($agents as $agent) {
            $this->appendStats($agent);
        }

        return $agents;
    }

    // ─────────────────────────────────────────
    //  FIND BY ID
    // ─────────────────────────────────────────
    public function findAgentById($id)
    {
        $agent = User::with(['affectations.inventaire'])
            ->where('role', 'agent')
            ->find($id);

        if ($agent) {
            $this->appendStats($agent);
        }

        return $agent;
    }

    // ─────────────────────────────────────────
    //  COMPUTED STATS PER AGENT
    // ─────────────────────────────────────────
    private function appendStats($agent)
    {
        // Status: actif si au moins une affectation active
        $agent->statut = $agent->affectations
            ->contains('statut_participation', 'actif') ? 'actif' : 'inactif';

        // Nombre d'inventaires distincts assignés
        $agent->inventaires_count = $agent->affectations
            ->pluck('id_inventaire')
            ->unique()
            ->count();

        // Liste détaillée des inventaires avec scans
        $agent->inventaires_details = $agent->affectations->map(function($aff) use ($agent) {
            if (!$aff->inventaire) return null;
            $ligneIds = DB::table('ligne_inventaires')
                ->where('id_inventaire', $aff->id_inventaire)
                ->pluck('id_ligne');
            $scansCount = DB::table('scans')
                ->where('id_agent', $agent->id)
                ->whereIn('id_ligne', $ligneIds)
                ->count();
            return [
                'id'            => $aff->id_inventaire,
                'titre'         => $aff->inventaire->titre,
                'statut'        => $aff->inventaire->statut,
                'scans_count'   => $scansCount,
                'participation' => $aff->statut_participation
            ];
        })->filter()->values();

        // Liste des titres d'inventaires assignés (keep for backward compat)
        $agent->inventaires_list = $agent->inventaires_details->pluck('titre')->toArray();

        // Articles complétées :
        // Nombre de scans effectués par l'agent pour les inventaires actifs
        $activeInventaireIds = $agent->affectations
            ->where('statut_participation', 'actif')
            ->pluck('id_inventaire');

        $activeLigneIds = DB::table('ligne_inventaires')
            ->whereIn('id_inventaire', $activeInventaireIds)
            ->pluck('id_ligne');

        $agent->articles_completees = DB::table('scans')
            ->where('id_agent', $agent->id)
            ->whereIn('id_ligne', $activeLigneIds)
            ->count();

        // Total scans pour l'inventaire actif seulement
        $agent->total_scans_count = DB::table('scans')
            ->where('id_agent', $agent->id)
            ->whereIn('id_ligne', $activeLigneIds)
            ->count();

        // Titre de l'inventaire en cours (si actif)
        $activeAffectation = $agent->affectations
            ->where('statut_participation', 'actif')
            ->first();
        
        $agent->inventaire_actif_titre = $activeAffectation && $activeAffectation->inventaire 
            ? $activeAffectation->inventaire->titre 
            : null;

        // Dernière fois qu'il a scanné
        $lastScan = DB::table('scans')
            ->where('id_agent', $agent->id)
            ->orderBy('created_at', 'desc')
            ->first();
        
        $agent->last_scan_at = $lastScan ? $lastScan->created_at : null;

        // Nombre de corrections demandées
        $agent->corrections_count = DB::table('corrections')
            ->where('id_agent', $agent->id)
            ->count();
    }

    // ─────────────────────────────────────────
    //  GLOBAL STATS (cards)
    // ─────────────────────────────────────────
    public function getStats()
    {
        $totalAgents = User::where('role', 'agent')->count();

        // Agents assignés : ceux qui ont au moins une affectation (n'importe quel statut)
        $assignedCount = DB::table('affectations')
            ->distinct()
            ->count('id_agent');

        // Agents actifs : ceux qui ont au moins une affectation 'actif'
        $activeCount = DB::table('affectations')
            ->where('statut_participation', 'actif')
            ->distinct()
            ->count('id_agent');

        $assignesPct = $totalAgents > 0
            ? round(($assignedCount / $totalAgents) * 100)
            : 0;

        // Meilleur agent : celui avec le plus de scans effectués
        $meilleurRaw = DB::table('scans')
            ->select('id_agent', DB::raw('COUNT(*) as total_quantite'))
            ->groupBy('id_agent')
            ->orderByDesc('total_quantite')
            ->first();

        $meilleurAgent = null;
        if ($meilleurRaw) {
            $u = User::find($meilleurRaw->id_agent);
            if ($u) {
                $meilleurAgent = [
                    'id'             => $u->id,
                    'nom'            => $u->nom,
                    'prenom'         => $u->prenom,
                    'avatar'         => $u->avatar,
                    'total_quantite' => (int) $meilleurRaw->total_quantite,
                ];
            }
        }

        return [
            'total_agents'        => $totalAgents,
            'agents_assignes'     => $assignedCount,
            'agents_actifs'       => $activeCount,
            'agents_assignes_pct' => $assignesPct,
            'meilleur_agent'      => $meilleurAgent,
        ];
    }

    // ─────────────────────────────────────────
    //  CREATE
    // ─────────────────────────────────────────
    public function createAgent($data)
    {
        return User::create([
            'nom'      => $data['nom'],
            'prenom'   => $data['prenom'],
            'email'    => $data['email'],
            'tel'      => $data['tel'] ?? null,
            'password' => Hash::make($data['password']),
            'role'     => 'agent',
        ]);
    }

    // ─────────────────────────────────────────
    //  UPDATE
    // ─────────────────────────────────────────
    public function updateAgent($id, $data)
    {
        $agent = User::where('role', 'agent')->find($id);

        if (!$agent) return null;

        foreach (['nom', 'prenom', 'email', 'tel', 'avatar'] as $field) {
            if (isset($data[$field])) {
                $agent->$field = $data[$field];
            }
        }

        if (!empty($data['password'])) {
            $agent->password = Hash::make($data['password']);
        }

        $agent->save();

        return $agent->fresh(['affectations.inventaire']);
    }

    // ─────────────────────────────────────────
    //  DELETE
    // ─────────────────────────────────────────
    public function deleteAgent($id)
    {
        $agent = User::where('role', 'agent')->find($id);

        if (!$agent) return false;

        $agent->affectations()->delete();
        $agent->delete();

        return true;
    }

    // ─────────────────────────────────────────
    //  ASSIGN / REMOVE INVENTORY
    // ─────────────────────────────────────────
    public function assignInventory($agentId, $inventaireId, $statut = 'actif')
    {
        return Affectation::updateOrCreate(
            ['id_agent' => $agentId, 'id_inventaire' => $inventaireId],
            ['statut_participation' => $statut]
        );
    }

    public function removeAssignment($agentId, $inventaireId)
    {
        return Affectation::where('id_agent', $agentId)
            ->where('id_inventaire', $inventaireId)
            ->delete();
    }
public function findByEmail($email)
    {
        return User::where('email', $email)->first();
    }
}
