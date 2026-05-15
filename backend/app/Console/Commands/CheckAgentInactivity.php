<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CheckAgentInactivity extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:check-agent-inactivity';

    protected $description = 'Mark agents as inactive after 10 minutes of no scan';

    public function handle()
    {
        $tenMinutesAgo = now()->subMinutes(10);

        $inactiveAffectations = \App\Models\Affectation::where('statut_participation', 'actif')
            ->where(function($q) use ($tenMinutesAgo) {
                $q->where('last_action_at', '<', $tenMinutesAgo)
                  ->orWhereNull('last_action_at');
            })
            ->get();

        foreach ($inactiveAffectations as $aff) {
            $aff->update(['statut_participation' => 'inactif']);
            
            // Broadcast the status update
            $inventaire = \App\Models\Inventaire::find($aff->id_inventaire);
            if ($inventaire) {
                $agent = \App\Models\User::find($aff->id_agent);
                $agentName = $agent ? "{$agent->nom} {$agent->prenom}" : "Agent #{$aff->id_agent}";

                // Create persistent notification for admin
                \App\Models\Notification::create([
                    'type' => null,
                    'id_user' => $aff->id_agent,
                    'id_inventaire' => $aff->id_inventaire,
                    'contenu' => "L'agent {$agentName} est devenu inactif sur l'inventaire: {$inventaire->titre}",
                    'statut' => 'non lu',
                ]);

                broadcast(new \App\Events\AgentStatusUpdated(
                    (int)$aff->id_inventaire, 
                    (int)$aff->id_agent, 
                    'inactif', 
                    $inventaire->titre
                ));
            }
        }

        $this->info(count($inactiveAffectations) . ' agents marked as inactive.');
    }
}
