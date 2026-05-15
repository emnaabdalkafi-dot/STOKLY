<?php

namespace App\Events;

use App\Models\Inventaire;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class InventaireAssigned implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Inventaire $inventaire,
        public int        $agentId
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("agent.{$this->agentId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'inventaire.assigned';
    }

    public function broadcastWith(): array
    {
        return [
            'id'         => $this->inventaire->id_inventaire,
            'titre'      => $this->inventaire->titre,
            'statut'     => $this->inventaire->statut,
            'site'       => $this->inventaire->site,
            'date_debut' => $this->inventaire->date_debut,
            'date_fin'   => $this->inventaire->date_fin,
        ];
    }
}
