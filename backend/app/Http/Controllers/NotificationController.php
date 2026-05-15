<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\NotificationService;

class NotificationController extends Controller
{
    protected $service;

    public function __construct(NotificationService $service)
    {
        $this->service = $service;
    }

    public function index(Request $request)
    {
        $notifications = $this->service->getUserNotifications($request->user());
        return response()->json(['success' => true, 'data' => $notifications]);
    }

    public function markAsRead(Request $request, $id)
    {
        try {
            $this->service->markAsRead($id, $request->user());
            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 400);
        }
    }

    public function markAllRead(Request $request)
    {
        try {
            $this->service->markAllRead($request->user());
            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    public function unreadCount(Request $request)
    {
        $count = $this->service->getUnreadCount($request->user());
        return response()->json(['success' => true, 'count' => $count]);
    }
}
