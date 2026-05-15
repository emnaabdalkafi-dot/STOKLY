<?php

use Illuminate\Support\Facades\Broadcast;

// Default user channel
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Private channel for each agent — only accessible by that agent
Broadcast::channel('agent.{agentId}', function ($user, $agentId) {
    return (int) $user->id === (int) $agentId;
});

// Public channel for inventory scans — accessible by all participants
Broadcast::channel('inventaire.{inventaireId}', function ($user, $inventaireId) {
    return true; // Simplified for now
});

// Admin channel
Broadcast::channel('admin', function ($user) {
    return true; // You can add actual admin role checks here
});

