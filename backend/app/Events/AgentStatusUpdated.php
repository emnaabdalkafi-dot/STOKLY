<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AgentStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $inventaireId,
        public int $agentId,
        public string $status,
        public ?string $titre = null
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("inventaire.{$this->inventaireId}"),
            new PrivateChannel('admin')
        ];
    }

    public function broadcastAs(): string
    {
        return 'agent.status.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'inventaire_id' => $this->inventaireId,
            'agent_id'      => $this->agentId,
            'status'        => $this->status,
            'titre'         => $this->titre,
        ];
    }
}
