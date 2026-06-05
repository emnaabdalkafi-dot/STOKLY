<?php

namespace App\Events;

use App\Models\Notification;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NotificationCreated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $notification;

    public function __construct(Notification $notification)
    {
        $this->notification = $notification;
    }

    public function broadcastOn()
    {
        $channels = [];
        $channels[] = new Channel('notifications'); // Global channel for fallback/backward compatibility

        $type = $this->notification->type;

        // Admin gets these alerts
        if (in_array($type, ['article inconnu', 'demande de correction', 'nouvelle note', 'inventaire en cours', 'inventaire depasse le date fin', 'agent actif', 'agent inactif'])) {
            $channels[] = new PrivateChannel('admin');
        }

        // Agents get these alerts on their personal channels
        if (in_array($type, ['nouvelle note'])) {
            $inventaireId = $this->notification->id_inventaire;
            if ($inventaireId) {
                $agentIds = \App\Models\Affectation::where('id_inventaire', $inventaireId)->pluck('id_agent');
                
                // Ensure note is loaded
                if ($this->notification->id_note && !$this->notification->relationLoaded('note')) {
                    $this->notification->load('note');
                }

                foreach ($agentIds as $agentId) {
                    // Exclude the author of the note
                    if ($type === 'nouvelle note') {
                        $note = $this->notification->note;
                        if ($note && $note->id_user == $agentId) {
                            continue; // Skip the author
                        }
                    }
                    $channels[] = new PrivateChannel("agent.{$agentId}");
                }
            }
        }

        return $channels;
    }

    public function broadcastAs()
    {
        return 'notification.created';
    }
}
