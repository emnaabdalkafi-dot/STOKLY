<?php

namespace App\Events;

use App\Models\Article;
use App\Models\Inventaire;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ArticleProposeEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Article $article,
        public Inventaire $inventaire,
        public User $agent,
        public int $quantite
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('admin')];
    }

    public function broadcastAs(): string
    {
        return 'article.propose';
    }

    public function broadcastWith(): array
    {
        return [
            'article_id'        => $this->article->id_article,
            'code_barres'       => $this->article->code_barres,
            'nom'               => $this->article->nom,
            'quantite'          => $this->quantite,
            'inventaire_id'     => $this->inventaire->id_inventaire,
            'inventaire_titre'  => $this->inventaire->titre,
            'agent_id'          => $this->agent->id,
            'agent_nom'         => $this->agent->nom . ' ' . $this->agent->prenom,
        ];
    }
}
