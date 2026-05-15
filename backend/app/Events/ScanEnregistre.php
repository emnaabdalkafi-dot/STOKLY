<?php

namespace App\Events;

use App\Models\Scan;
use App\Models\Article;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ScanEnregistre implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int     $inventaireId,
        public Article $article,
        public int     $agentId,
        public int     $quantiteComptee,
        public int     $ecart,
        public ?int    $idEntrepot = null
    ) {}

    /**
     * Broadcast on a public channel so the manager dashboard can listen too.
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("inventaire.{$this->inventaireId}"),
            new PrivateChannel('admin')
        ];
    }

    public function broadcastAs(): string
    {
        return 'scan.enregistre';
    }

    public function broadcastWith(): array
    {
        return [
            'inventaire_id'    => $this->inventaireId,
            'agent_id'         => $this->agentId,
            'article'          => [
                'id'          => $this->article->id_article,
                'nom'         => $this->article->nom,
                'code_barres' => $this->article->code_barres,
            ],
            'quantite_comptee' => $this->quantiteComptee,
            'ecart'            => $this->ecart,
            'id_entrepot'      => $this->idEntrepot,
        ];
    }
}
