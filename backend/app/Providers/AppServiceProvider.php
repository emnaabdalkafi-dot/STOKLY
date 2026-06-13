<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        \Illuminate\Support\Carbon::setLocale('fr');

        \Illuminate\Auth\Notifications\ResetPassword::createUrlUsing(function ($user, string $token) {
            $frontendUrl = env('FRONTEND_URL', 'https://ns3043834.ip-5-135-191.eu');
            return rtrim($frontendUrl, '/') . '/reset-password?token='.$token.'&email='.$user->getEmailForPasswordReset();
        });

        \Illuminate\Auth\Notifications\ResetPassword::toMailUsing(function ($notifiable, string $token) {
            $frontendUrl = env('FRONTEND_URL', 'https://ns3043834.ip-5-135-191.eu');
            $url = rtrim($frontendUrl, '/') . '/reset-password?token='.$token.'&email='.$notifiable->getEmailForPasswordReset();

            return (new \Illuminate\Notifications\Messages\MailMessage)
                ->subject('Réinitialisation de votre mot de passe')
                ->greeting('Bonjour !')
                ->line('Vous recevez cet e-mail car nous avons reçu une demande de réinitialisation de mot de passe pour votre compte.')
                ->action('Réinitialiser le mot de passe', $url)
                ->line('⏳ **Attention :** Ce lien de réinitialisation est hautement sécurisé et expirera dans précisément **2 minutes**.')
                ->line("Si vous n'avez pas demandé de réinitialisation de mot de passe, aucune autre action n'est requise.")
                ->salutation("Cordialement,\nL'équipe " . config('app.name', 'Stockly'));
        });
    }
}
