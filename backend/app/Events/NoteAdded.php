<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NoteAdded implements \Illuminate\Contracts\Broadcasting\ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public \App\Models\Note $note
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("inventaire.{$this->note->id_inventaire}"),
            new PrivateChannel('admin')
        ];
    }

    public function broadcastAs(): string
    {
        return 'note.added';
    }

    public function broadcastWith(): array
    {
        return [
            'id_note' => $this->note->id_note,
            'id_inventaire' => $this->note->id_inventaire,
            'contenu' => $this->note->contenu,
            'user' => [
                'id' => $this->note->user->id,
                'nom' => $this->note->user->nom,
                'prenom' => $this->note->user->prenom,
            ],
            'created_at' => $this->note->created_at->toIso8601String(),
        ];
    }
}
