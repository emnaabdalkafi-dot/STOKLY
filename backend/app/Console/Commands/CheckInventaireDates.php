<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Inventaire;
use App\Models\Notification;
use App\Events\NotificationCreated;

class CheckInventaireDates extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'inventaires:check-dates';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check if any in-progress inventaires have passed their end date and notify admin.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $today = now()->format('Y-m-d');

        // Find inventaires that are en cours and their end date is past
        $overdueInventaires = Inventaire::whereIn('statut', ['en cours', 'en attente'])
            ->whereDate('date_fin', '<', $today)
            ->get();

        $notifiedCount = 0;

        foreach ($overdueInventaires as $inventaire) {
            // Check if we already sent a notification for this recently
            // To prevent spamming if this command runs daily/hourly
            $existingNotif = Notification::where('type', 'inventaire depasse le date fin')
                ->where('id_inventaire', $inventaire->id_inventaire)
                ->whereDate('created_at', now()->toDateString())
                ->first();

            if (!$existingNotif) {
                $notif = Notification::create([
                    'type' => 'inventaire depasse le date fin',
                    'id_inventaire' => $inventaire->id_inventaire,
                    'contenu' => "Alerte : L'inventaire '{$inventaire->titre}' a dépassé sa date de fin prévue ({$inventaire->date_fin}).",
                    'statut' => 'non lu',
                ]);

                broadcast(new NotificationCreated($notif));
                $notifiedCount++;
            }
        }

        $this->info("{$notifiedCount} inventaires en retard notifiés.");
    }
}
