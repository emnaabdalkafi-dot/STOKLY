<?php

namespace App\Services;

use App\Repositories\DashboardRepository;

class DashboardService
{
    protected $repository;

    public function __construct(DashboardRepository $repository)
    {
        $this->repository = $repository;
    }

    public function getDashboardData($invId = 'all')
    {
        $this->checkOverdueInventories();

        return [
            'overview' => [
                'inventaires_actifs' => $this->repository->getActiveInventoriesCount($invId),
                'personnel_actif' => $this->repository->getActiveAgentsCount($invId),
                'avancement_global' => $this->repository->getGlobalProgress($invId) . '%',
                'ecarts_detectes' => $this->repository->getAnomaliesCount($invId),
            ],
            'analyse_ecarts' => $this->repository->getGapAnalysis($invId),
            'resume_rapide' => $this->repository->getQuickSummary($invId),
            'performance_agents' => $this->repository->getAgentPerformance($invId),
            'inventories_list' => $this->repository->getInventories(), // Always global
            'recent_activities' => $this->repository->getRecentActivities($invId),
        ];
    }

    private function checkOverdueInventories()
    {
        $overdue = \App\Models\Inventaire::where('statut', 'en cours')
            ->where('date_fin', '<', now())
            ->get();

        foreach ($overdue as $inv) {
            $exists = \App\Models\Notification::where('type', 'inventaire depasse le date fin')
                ->where('id_inventaire', $inv->id_inventaire)
                ->where('created_at', '>=', now()->startOfDay())
                ->exists();

            if (!$exists) {
                \App\Models\Notification::create([
                    'type' => 'inventaire depasse le date fin',
                    'id_inventaire' => $inv->id_inventaire,
                    'contenu' => "L'inventaire {$inv->titre} a dépassé la date de fin !",
                    'statut' => 'non lu'
                ]);
            }
        }
    }
}
