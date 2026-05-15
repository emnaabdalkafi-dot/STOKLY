<x-mail::message>
# Bienvenue chez Stokly !

Bonjour **{{ $agent->nom }} {{ $agent->prenom }}**,

Votre compte agent a été créé avec succès. Vous pouvez maintenant vous connecter à l'application mobile en utilisant les identifiants suivants :

**Email :** {{ $agent->email }}  
**Mot de passe :** `{{ $password }}`

<x-mail::button :url="config('app.url')">
Se connecter à l'application
</x-mail::button>

*Pour des raisons de sécurité, nous vous conseillons de changer votre mot de passe dès votre première connexion.*

Merci,<br>
L'équipe {{ config('app.name') }}
</x-mail::message>
