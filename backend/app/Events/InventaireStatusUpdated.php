<?php

namespace App\Events;

use App\Models\Inventaire;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class InventaireStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Inventaire $inventaire)
    {}

    /**
     * Broadcast on the private channel of each assigned agent.
     */
    public function broadcastOn(): array
    {
        $agentIds = $this->inventaire->affectations()->pluck('id_agent');
        $channels = $agentIds->map(fn ($id) => new PrivateChannel("agent.{$id}"))->toArray();
        $channels[] = new PrivateChannel('admin'); // broadcast to admin dashboard
        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'inventaire.status.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'id_inventaire' => $this->inventaire->id_inventaire,
            'titre'         => $this->inventaire->titre,
            'statut'        => $this->inventaire->statut,
            'site'          => $this->inventaire->site,
            'type_source'   => $this->inventaire->type_source,
            'date_debut'    => $this->inventaire->date_debut,
            'date_fin'      => $this->inventaire->date_fin,
            'affectations'  => $this->inventaire->affectations->map(fn($aff) => [
                'id_agent' => $aff->id_agent,
                'statut_participation' => $aff->statut_participation,
                'agent' => [
                    'id' => $aff->agent->id,
                    'nom' => $aff->agent->nom,
                    'prenom' => $aff->agent->prenom,
                    'avatar' => $aff->agent->avatar,
                ]
            ]),
        ];
    }
}
