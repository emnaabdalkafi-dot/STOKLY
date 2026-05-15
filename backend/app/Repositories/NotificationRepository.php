<?php

namespace App\Repositories;

use App\Models\Notification;

class NotificationRepository
{
    public function getForUser($user)
    {
        return Notification::where(function($q) use ($user) {
                $q->whereNull('id_user')
                  ->orWhere('id_user', '!=', $user->id);
            })
            ->where(function($q) use ($user) {
                if ($user->role === 'agent') {
                    // Agent sees: 
                    // 1. Notifications targeted to him (rare in new logic but possible)
                    // 2. Notifications for inventories he is assigned to
                    $assignedInvIds = \App\Models\Affectation::where('id_agent', $user->id)->pluck('id_inventaire');
                    $q->whereIn('id_inventaire', $assignedInvIds)
                      ->whereIn('type', ['nouvelle note', 'inventaire affecte']);
                } else {
                    // Admin sees everything (except his own actions)
                    // No extra filter needed, already restricted by id_user != user->id
                }
            })
            ->orderBy('created_at', 'desc')
            ->get();
    }

    public function findById($id)
    {
        return Notification::findOrFail($id);
    }

    public function update($id, array $data)
    {
        $notification = $this->findById($id);
        $notification->update($data);
        return $notification;
    }

    public function getUnreadCount($user)
    {
        return Notification::where('statut', 'non lu')
            ->where(function($q) use ($user) {
                $q->whereNull('id_user')
                  ->orWhere('id_user', '!=', $user->id);
            })
            ->where(function($q) use ($user) {
                if ($user->role === 'agent') {
                    $assignedInvIds = \App\Models\Affectation::where('id_agent', $user->id)->pluck('id_inventaire');
                    $q->whereIn('id_inventaire', $assignedInvIds)
                      ->whereIn('type', ['nouvelle note', 'inventaire affecte']);
                }
            })
            ->count();
    }

    public function markAllAsRead($user)
    {
        return Notification::where('statut', 'non lu')
            ->where(function($q) use ($user) {
                $q->whereNull('id_user')
                  ->orWhere('id_user', '!=', $user->id);
            })
            ->where(function($q) use ($user) {
                if ($user->role === 'agent') {
                    $assignedInvIds = \App\Models\Affectation::where('id_agent', $user->id)->pluck('id_inventaire');
                    $q->whereIn('id_inventaire', $assignedInvIds)
                      ->whereIn('type', ['nouvelle note', 'inventaire affecte']);
                }
            })
            ->update(['statut' => 'lu']);
    }
}
