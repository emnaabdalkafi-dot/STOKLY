<?php

namespace App\Services;

use App\Repositories\NotificationRepository;

class NotificationService
{
    protected $repository;

    public function __construct(NotificationRepository $repository)
    {
        $this->repository = $repository;
    }

    public function getUserNotifications($user)
    {
        $notifications = $this->repository->getForUser($user);

        // Map structured columns for frontend compatibility
        $notifications->transform(function ($notif) {
            $notif->contenu_decoded = [
                'message' => $notif->contenu,
                'inventaire_id' => $notif->id_inventaire,
                'article_id' => $notif->id_article,
            ];
            return $notif;
        });

        return $notifications;
    }

    public function markAsRead($id, $user)
    {
        $notification = $this->repository->findById($id);

        return $this->repository->update($id, ['statut' => 'lu']);
    }

    public function markAllRead($user)
    {
        return $this->repository->markAllAsRead($user);
    }

    public function getUnreadCount($user)
    {
        return $this->repository->getUnreadCount($user);
    }
}
