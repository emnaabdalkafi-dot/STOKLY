<?php
namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NoteDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public int $noteId, public int $inventoryId) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("inventaire.{$this->inventoryId}"),
            new PrivateChannel('admin')
        ];
    }

    public function broadcastAs(): string { return 'note.deleted'; }

    public function broadcastWith(): array
    {
        return [
            'id_note' => $this->noteId,
            'id_inventaire' => $this->inventoryId,
        ];
    }
}
