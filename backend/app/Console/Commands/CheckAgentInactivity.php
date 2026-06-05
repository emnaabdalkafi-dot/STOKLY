<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Affectation;
use App\Models\Inventaire;
use App\Models\User;
use App\Models\Scan;
use App\Models\Notification;
use App\Events\AgentStatusUpdated;

class CheckAgentInactivity extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:check-agent-inactivity';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Mark agents as inactive after 10 minutes of no scan';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $tenMinutesAgo = now()->subMinutes(10);

        // Get all active affectations
        $activeAffectations = Affectation::where(
            'statut_participation',
            'actif'
        )->get();

        $inactiveCount = 0;

        foreach ($activeAffectations as $aff) {

            // Get last scan of this agent in this inventory
            $lastScan = Scan::where('id_agent', $aff->id_agent)
                ->where('id_inventaire', $aff->id_inventaire)
                ->latest('created_at')
                ->first();

            // Check inactivity
            $isInactive = !$lastScan ||
                $lastScan->created_at < $tenMinutesAgo;

            if ($isInactive) {

                // Update status
                $aff->update([
                    'statut_participation' => 'inactif'
                ]);

                // Get inventory
                $inventaire = Inventaire::find($aff->id_inventaire);

                // Get agent
                $agent = User::find($aff->id_agent);

                $agentName = $agent
                    ? "{$agent->nom} {$agent->prenom}"
                    : "Agent #{$aff->id_agent}";

                // Create notification
                $notif = Notification::create([
                    'type' => 'agent inactif',
                    'id_inventaire' => $aff->id_inventaire,
                    'contenu' => "L'agent {$agentName} est devenu inactif sur l'inventaire : {$inventaire->titre}",
                    'statut' => 'non lu',
                ]);

                broadcast(new \App\Events\NotificationCreated($notif));

                // Broadcast realtime event
                broadcast(new AgentStatusUpdated(
                    (int)$aff->id_inventaire,
                    (int)$aff->id_agent,
                    'inactif',
                    $inventaire->titre
                ));

                $inactiveCount++;
            }
        }

        $this->info("{$inactiveCount} agents marked as inactive.");
    }
}