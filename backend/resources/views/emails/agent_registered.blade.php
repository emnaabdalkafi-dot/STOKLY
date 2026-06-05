<x-mail::message>
# Bienvenue chez Stokly !

Bonjour **{{ $agent->nom }} {{ $agent->prenom }}**,

Votre compte agent a été créé avec succès.

Vous pouvez maintenant accéder à l’application mobile Stockly avec les informations suivantes :
    
**Email :** {{ $agent->email }}  
**Mot de passe :** `{{ $password }}`

<x-mail::button :url="url('/storage/stokly.apk')">
Télécharger l'application
</x-mail::button>

⚠️ *Pour des raisons de sécurité, nous vous conseillons de changer votre mot de passe dès votre première connexion.*

Merci,<br>
L'équipe Stockly
</x-mail::message>
