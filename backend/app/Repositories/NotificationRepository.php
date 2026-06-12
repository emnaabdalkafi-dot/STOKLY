<?php

namespace App\Repositories;

use App\Models\Notification;
use App\Models\Note;

class NotificationRepository
{
    public function getForUser($user)
    {
        if ($user->role === 'agent') {
            return $this->getAgentNotifications($user);
        }
        
        return $this->getAdminNotifications($user);
    }

    protected function getAgentNotifications($user)
    {
        // Inventaires this agent is assigned to
        $assignedInvIds = \App\Models\Affectation::where('id_agent', $user->id)
            ->pluck('id_inventaire');

        return Notification::where(function ($q) use ($user, $assignedInvIds) {
            // 'nouvel inventaire' - only for assigned inventaires
            $q->where(function ($q2) use ($assignedInvIds) {
                $q2->where('type', 'nouvel inventaire')
                   ->whereIn('id_inventaire', $assignedInvIds);
            })
            // 'nouvelle note' - only for assigned inventaires, excluding notes written by this agent
            ->orWhere(function ($q2) use ($user, $assignedInvIds) {
                $q2->where('type', 'nouvelle note')
                   ->whereIn('id_inventaire', $assignedInvIds)
                   ->where(function ($q3) use ($user) {
                       // Exclude notifications for notes written by this agent
                       $q3->whereNull('id_note')
                          ->orWhereHas('note', function ($q4) use ($user) {
                              $q4->where('id_user', '!=', $user->id);
                          });
                   });
            });
        })
        ->orderBy('created_at', 'desc')
        ->get();
    }

    protected function getAdminNotifications($user)
    {
        return Notification::where(function ($q) use ($user) {
            // Admin sees everything except agent-only notifications (nouvel inventaire)
            // and notes that the admin themselves wrote
            $q->where('type', '!=', 'nouvel inventaire')
              ->where(function ($q2) use ($user) {
                  // For 'nouvelle note', exclude notes written by this admin
                  $q2->where('type', '!=', 'nouvelle note')
                     ->orWhere(function ($q3) use ($user) {
                         $q3->where('type', 'nouvelle note')
                            ->where(function ($q4) use ($user) {
                                $q4->whereNull('id_note')
                                   ->orWhereHas('note', function ($q5) use ($user) {
                                       $q5->where('id_user', '!=', $user->id);
                                   });
                            });
                     });
              });
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
        if ($user->role === 'agent') {
            $assignedInvIds = \App\Models\Affectation::where('id_agent', $user->id)
                ->pluck('id_inventaire');

            return Notification::where('statut', 'non lu')
                ->where(function ($q) use ($user, $assignedInvIds) {
                    $q->where(function ($q2) use ($assignedInvIds) {
                        $q2->where('type', 'nouvel inventaire')
                           ->whereIn('id_inventaire', $assignedInvIds);
                    })
                    ->orWhere(function ($q2) use ($user, $assignedInvIds) {
                        $q2->where('type', 'nouvelle note')
                           ->whereIn('id_inventaire', $assignedInvIds)
                           ->where(function ($q3) use ($user) {
                               $q3->whereNull('id_note')
                                  ->orWhereHas('note', function ($q4) use ($user) {
                                      $q4->where('id_user', '!=', $user->id);
                                  });
                           });
                    });
                })
                ->count();
        }

        // Admin unread count
        return Notification::where('statut', 'non lu')
            ->where(function ($q) use ($user) {
                $q->where('type', '!=', 'nouvel inventaire')
                  ->where(function ($q2) use ($user) {
                      $q2->where('type', '!=', 'nouvelle note')
                         ->orWhere(function ($q3) use ($user) {
                             $q3->where('type', 'nouvelle note')
                                ->where(function ($q4) use ($user) {
                                    $q4->whereNull('id_note')
                                       ->orWhereHas('note', function ($q5) use ($user) {
                                           $q5->where('id_user', '!=', $user->id);
                                       });
                                });
                         });
                  });
            })
            ->count();
    }

    public function markAllAsRead($user)
    {
        if ($user->role === 'agent') {
            $assignedInvIds = \App\Models\Affectation::where('id_agent', $user->id)
                ->pluck('id_inventaire');

            return Notification::where('statut', 'non lu')
                ->where(function ($q) use ($user, $assignedInvIds) {
                    $q->where(function ($q2) use ($assignedInvIds) {
                        $q2->where('type', 'nouvel inventaire')
                           ->whereIn('id_inventaire', $assignedInvIds);
                    })
                    ->orWhere(function ($q2) use ($user, $assignedInvIds) {
                        $q2->where('type', 'nouvelle note')
                           ->whereIn('id_inventaire', $assignedInvIds)
                           ->where(function ($q3) use ($user) {
                               $q3->whereNull('id_note')
                                  ->orWhereHas('note', function ($q4) use ($user) {
                                      $q4->where('id_user', '!=', $user->id);
                                  });
                           });
                    });
                })
                ->update(['statut' => 'lu']);
        }

        // Admin marks all readable notifications as read
        return Notification::where('statut', 'non lu')
            ->where(function ($q) use ($user) {
                $q->where('type', '!=', 'nouvel inventaire')
                  ->where(function ($q2) use ($user) {
                      $q2->where('type', '!=', 'nouvelle note')
                         ->orWhere(function ($q3) use ($user) {
                             $q3->where('type', 'nouvelle note')
                                ->where(function ($q4) use ($user) {
                                    $q4->whereNull('id_note')
                                       ->orWhereHas('note', function ($q5) use ($user) {
                                           $q5->where('id_user', '!=', $user->id);
                                       });
                                });
                         });
                  });
            })
            ->update(['statut' => 'lu']);
    }
}
