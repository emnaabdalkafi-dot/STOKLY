<?php

namespace App\Repositories;

use App\Models\Article;
use App\Models\Inventaire;
use App\Models\LigneInventaire;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class DashboardRepository
{
    public function getActiveInventoriesCount($invId = 'all')
    {
        // This count should stay global to show total active projects
        return Inventaire::where('statut', 'en cours')->count();
    }

    public function getActiveAgentsCount($invId = 'all')
    {
        $query = DB::table('affectations')->where('statut_participation', 'actif');
        if ($invId !== 'all') {
            $query->where('id_inventaire', $invId);
        }
        return $query->distinct()->count('id_agent');
    }

    public function getGlobalProgress($invId = 'all')
    {
        $query = Inventaire::where('statut', 'en cours');
        if ($invId !== 'all') {
            $query->where('id_inventaire', $invId);
        }
        $activeInventaireIds = $query->pluck('id_inventaire');

        $lignes = LigneInventaire::whereIn('id_inventaire', $activeInventaireIds)->get();

        $totalTheorique = $lignes->sum('quantite_theorique');
        $totalComptee = $lignes->sum('quantite_comptee');

        if ($totalTheorique == 0) return 0;

        $progress = ($totalComptee / $totalTheorique) * 100;

        return round($progress, 1);
    }

    public function getAnomaliesCount($invId = 'all')
    {
        $query = LigneInventaire::query();
        if ($invId !== 'all') {
            $query->where('id_inventaire', $invId);
        }
        $positif = (clone $query)
            ->whereNotNull('quantite_comptee')
            ->where('quantite_comptee', '>', 0)
            ->whereRaw('quantite_comptee > quantite_theorique')
            ->count();
            
        $negatif = (clone $query)
            ->whereNotNull('quantite_comptee')
            ->where('quantite_comptee', '>', 0)
            ->whereRaw('quantite_comptee < quantite_theorique')
            ->count();
        
        return [
            'positif' => $positif,
            'negatif' => $negatif
        ];
    }

    public function getGapAnalysis($invId = 'all')
    {
        $query = LigneInventaire::whereNotNull('quantite_comptee')->where('quantite_theorique', '>=', 0);
        if ($invId !== 'all') {
            $query->where('id_inventaire', $invId);
        }

        $sansEcart = (clone $query)
            ->where(function ($q) {
                $q->whereRaw('quantite_theorique = quantite_comptee')
                  ->orWhere('quantite_comptee', 0);
            })
            ->count();

        $ecartPositif = (clone $query)
            ->where('quantite_comptee', '>', 0)
            ->whereRaw('quantite_comptee > quantite_theorique')
            ->count();

        $ecartNegatif = (clone $query)
            ->where('quantite_comptee', '>', 0)
            ->whereRaw('quantite_comptee < quantite_theorique')
            ->count();

        $total = $sansEcart + $ecartPositif + $ecartNegatif;

        return [
            'sans_ecart' => $sansEcart,
            'ecartPositif' => $ecartPositif, 
            'ecartNegatif' => $ecartNegatif,
            'total' => $total,
            'bars' => [
                ['name' => 'Sans écart', 'value' => $sansEcart, 'percent' => $total > 0 ? round(($sansEcart / $total) * 100) : 0, 'color' => '#22c55e'],
                ['name' => 'Écart Positif', 'value' => $ecartPositif, 'percent' => $total > 0 ? round(($ecartPositif / $total) * 100) : 0, 'color' => '#eab308'],
                ['name' => 'Écart Négatif', 'value' => $ecartNegatif, 'percent' => $total > 0 ? round(($ecartNegatif / $total) * 100) : 0, 'color' => '#ef4444'],
            ]
        ];
    }

    public function getQuickSummary($invId = 'all')
    {
        $query = Inventaire::where('statut', '!=', 'cloture');
        if ($invId !== 'all') {
            $query->where('id_inventaire', $invId);
        }
        $activeInventaireIds = $query->pluck('id_inventaire');

        $lignesQuery = LigneInventaire::whereIn('id_inventaire', $activeInventaireIds);
        
      


        $counted = clone $lignesQuery;
        $counted = clone $lignesQuery;
        $countedSum = (clone $lignesQuery)->whereNotNull('quantite_comptee')->sum('quantite_comptee');

        $totalLignesTheorique = (clone $lignesQuery)->sum('quantite_theorique');
        
        $restant = max(0, $totalLignesTheorique - $countedSum);
        $totalCounted = (clone $lignesQuery)->whereNotNull('quantite_comptee')->sum('quantite_comptee');
$totalPositiveEcart = (clone $lignesQuery)->where('ecart', '>', 0)->sum('ecart');

$countedSansEcart = $totalCounted - $totalPositiveEcart;
        $taux = $totalLignesTheorique > 0 ? round(($countedSansEcart / $totalLignesTheorique) * 100) : 0;


        return [
            'taux' => $taux,
            'comptes' => $countedSum,
            'restants' => $restant,
            'total' => $totalLignesTheorique
        ];
    }

    public function getInventoryTracking()
    {
        $inventories = Inventaire::with(['lignes'])->latest()->take(5)->get();

        return $inventories->map(function($inv) {
            $totalLines = $inv->lignes->count();
            $total = $inv->lignes->sum('quantite_theorique');
            
            $countedProgress = $inv->lignes->sum(function($line) {
                return min($line->quantite_comptee ?? 0, $line->quantite_theorique);
            });
            
            $actualCounted = $inv->lignes->where('quantite_comptee', '>', 0)->count();

            $prog = $total > 0 ? round(($countedProgress / $total) * 100) : 0;
            
            return [
                'inventaire' => $inv->titre ?: $inv->site,
                'progression' => $prog . '%',
                'comptes' => $actualCounted,
                'restants' => max(0, $totalLines - $actualCounted),
                'status' => $inv->statut
            ];
        });
    }

    public function getAgentPerformance($invId = 'all')
    {
        $agents = User::where('role', 'agent')
            ->with(['affectations' => function($q) use ($invId) {
                $q->with('inventaire');
                if ($invId !== 'all') {
                    $q->where('id_inventaire', $invId);
                }
            }])
            ->get();

        return $agents->filter(function($agent) use ($invId) {
            if ($invId !== 'all') {
                return $agent->affectations->count() > 0;
            }
            return true;
        })->map(function($agent) use ($invId) {
            $inventories = $agent->affectations->map(function($aff) {
                return $aff->inventaire ? ($aff->inventaire->titre ?: $aff->inventaire->site) : null;
            })->filter()->values();

            $inventaireName = 'Aucun';
            if ($inventories->count() > 0) {
                $first = $inventories->first();
                $others = $inventories->count() - 1;
                $inventaireName = $others > 0 ? "{$first} + {$others} autres" : $first;
            }

            $scanQuery = DB::table('scans')
                ->join('ligne_inventaires', 'scans.id_ligne', '=', 'ligne_inventaires.id_ligne')
                ->where('scans.id_agent', $agent->id);
            if ($invId !== 'all') {
                $scanQuery->where('ligne_inventaires.id_inventaire', $invId);
            }
            $scanCount = $scanQuery->count();
            
            $lastScan = (clone $scanQuery)->latest('scans.created_at')->first();
            $lastScanTime = $lastScan ? \Illuminate\Support\Carbon::parse($lastScan->created_at)->diffForHumans() : 'Jamais';

            $status = $agent->affectations->contains('statut_participation', 'actif') ? 'Actif' : 'Inactif';

            // If active but last scan > 10 mins ago, consider inactive for dashboard view
            if ($status === 'Actif' && $lastScan) {
                $lastScanTimeCarbon = \Illuminate\Support\Carbon::parse($lastScan->created_at);
                if ($lastScanTimeCarbon->diffInMinutes() > 10) {
                    $status = 'Inactif (Inactif)';
                }
            }

            return [
                'nom' => $agent->nom . ' ' . $agent->prenom,
                'avatar' => $agent->avatar,
                'inventaire' => $inventaireName,
                'inventaires_count' => $inventories->count(),
                'inventaires_list' => $inventories,
                'last_scan' => $lastScanTime,
                'scans' => $scanCount,
                'status' => $status
            ];
        })->sortByDesc('scans')->take(5)->values();
    }

    public function getEcartsList($invId = 'all')
    {
        $query = LigneInventaire::with(['article', 'inventaire'])->whereNotNull('quantite_comptee');
        if ($invId !== 'all') {
            $query->where('id_inventaire', $invId);
        }

        $query->where('quantite_comptee', '>', 0)
              ->whereRaw('quantite_comptee != quantite_theorique');

        $lignes = $query->take(10)->get();

        return $lignes->map(function($ligne) {
            $ecart = $ligne->quantite_comptee - $ligne->quantite_theorique;
            return [
                'article' => $ligne->article->nom,
                'code_barres' => $ligne->article->code_barres,
                'inventaire' => $ligne->inventaire->titre,
                'ecart_positif' => $ecart > 0 ? $ecart : null,
                'ecart_negatif' => $ecart < 0 ? $ecart : null,
            ];
        });
    }

    public function getRecentActivities($invId = 'all')
    {
        $activities = collect();

        // 1. Recent Scans (Agent is active)
        $scans = DB::table('scans')
            ->join('utilisateurs', 'scans.id_agent', '=', 'utilisateurs.id')
            ->join('ligne_inventaires', 'scans.id_ligne', '=', 'ligne_inventaires.id_ligne')
            ->select('utilisateurs.nom', 'utilisateurs.prenom', 'scans.created_at', 'ligne_inventaires.id_inventaire')
            ->when($invId !== 'all', fn($q) => $q->where('ligne_inventaires.id_inventaire', $invId))
            ->latest('scans.created_at')
            ->take(5)
            ->get();

        foreach ($scans as $scan) {
            $activities->push([
                'user' => $scan->nom . ' ' . $scan->prenom,
                'action' => 'est actif maintenant (scan récent)',
                'time' => $scan->created_at,
                'type' => 'agent'
            ]);
        }

        // 2. Inventory Status Changes (based on updated_at)
        $invs = Inventaire::whereIn('statut', ['en cours', 'cloture'])
            ->when($invId !== 'all', fn($q) => $q->where('id_inventaire', $invId))
            ->latest('updated_at')
            ->take(5)
            ->get();

        foreach ($invs as $inv) {
            $activities->push([
                'user' => $inv->titre ?: $inv->site,
                'action' => 'est passé en ' . $inv->statut . ' maintenant',
                'time' => $inv->updated_at->toDateTimeString(),
                'type' => 'inventaire'
            ]);
        }

        // 3. Overdue Inventories
        $overdue = Inventaire::where('statut', 'en cours')
            ->where('date_fin', '<', now())
            ->when($invId !== 'all', fn($q) => $q->where('id_inventaire', $invId))
            ->get();

        foreach ($overdue as $ov) {
            $activities->push([
                'user' => $ov->titre ?: $ov->site,
                'action' => 'a dépassé la date de fin !',
                'time' => $ov->date_fin,
                'type' => 'alerte'
            ]);
        }

        return $activities->sortByDesc('time')->take(10)->values()->map(function($act) {
            return [
                'user' => $act['user'],
                'action' => $act['action'],
                'time' => \Illuminate\Support\Carbon::parse($act['time'])->diffForHumans(),
                'type' => $act['type']
            ];
        });
    }

    public function getCriticalAlerts()
    {
        // Mocked or from a real alerts table
        return [];
    }

    public function getInventories()
    {
        return Inventaire::where('statut', 'en cours')
            ->select('id_inventaire', 'titre', 'site')
            ->get()
            ->map(function($inv) {
                return [
                    'id' => $inv->id_inventaire,
                    'name' => $inv->titre ?: $inv->site
                ];
            });
    }
}
