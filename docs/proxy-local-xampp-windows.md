# Proxy local transparent avec XAMPP (Windows)

Ce guide explique comment faire en sorte qu’un domaine local (ex. `www.emna.com`) affiche le contenu de **https://tinnipax.azartech.io** **sans changer l’URL** dans le navigateur.

> **Principe** : reverse proxy Apache (XAMPP), pas une redirection visible (301/302).

---

## Vue d’ensemble

| Étape | Action |
|-------|--------|
| 1 | Fichier `hosts` → le domaine pointe vers `127.0.0.1` |
| 2 | Apache (XAMPP) → reverse proxy vers `https://tinnipax.azartech.io` |
| 3 | Header `Host: tinnipax.azartech.io` → le serveur prod répond correctement |

---

## Étape 1 — Modifier le fichier `hosts`

1. Ouvre le **Bloc-notes en tant qu’administrateur**
2. Ouvre le fichier :

   ```
   C:\Windows\System32\drivers\etc\hosts
   ```

3. Ajoute ces lignes (tu peux remplacer `emna.com` par n’importe quel domaine de test) :

   ```text
   127.0.0.1   www.emna.com
   127.0.0.1   emna.com
   ```

4. Enregistre le fichier

---

## Étape 2 — Activer les modules Apache dans XAMPP

1. Ouvre :

   ```
   C:\xampp\apache\conf\httpd.conf
   ```

2. Décommente (enlève le `#` au début) les lignes suivantes :

   ```apache
   LoadModule proxy_module modules/mod_proxy.so
   LoadModule proxy_http_module modules/mod_proxy_http.so
   LoadModule ssl_module modules/mod_ssl.so
   LoadModule headers_module modules/mod_headers.so
   ```

3. Vérifie que les virtual hosts sont inclus :

   ```apache
   Include conf/extra/httpd-vhosts.conf
   ```

4. Enregistre le fichier

---

## Étape 3 — Créer le VirtualHost proxy

1. Ouvre :

   ```
   C:\xampp\apache\conf\extra\httpd-vhosts.conf
   ```

2. Ajoute **à la fin** du fichier :

   ```apache
   <VirtualHost *:80>
       ServerName www.emna.com
       ServerAlias emna.com

       # Proxy vers le site prod
       SSLProxyEngine On
       SSLProxyVerify none
       SSLProxyCheckPeerCN off
       SSLProxyCheckPeerName off

       ProxyPreserveHost Off
       RequestHeader set Host "tinnipax.azartech.io"

       ProxyPass        / https://tinnipax.azartech.io/
       ProxyPassReverse / https://tinnipax.azartech.io/

       ErrorLog  "logs/emna-proxy-error.log"
       CustomLog "logs/emna-proxy-access.log" common
   </VirtualHost>
   ```

### Pourquoi ces options SSL ?

Apache doit se connecter en HTTPS au serveur distant. Sans `SSLProxyEngine On`, le proxy vers `https://...` ne fonctionne pas.

Sans `RequestHeader set Host`, le serveur prod ne reconnaît pas le bon vhost et peut renvoyer une erreur ou un mauvais site.

---

## Étape 4 — Redémarrer Apache

1. Ouvre le **XAMPP Control Panel**
2. Clique sur **Stop** puis **Start** pour Apache

### Vérifier la configuration (optionnel)

```cmd
C:\xampp\apache\bin\httpd.exe -t
```

Si Apache ne démarre pas, consulte :

```
C:\xampp\apache\logs\error.log
```

---

## Étape 5 — Tester

Ouvre dans le navigateur :

```
http://www.emna.com
```

Tu dois voir l’application Stockly (contenu prod), avec **`www.emna.com`** toujours affiché dans la barre d’adresse.

---

## HTTPS local (optionnel)

Par défaut, la configuration ci-dessus utilise **HTTP** en local (`http://www.emna.com`).

Pour `https://www.emna.com` :

1. Génère un certificat local (ex. avec [mkcert](https://github.com/FiloSottile/mkcert))
2. Configure un VirtualHost sur le port **443** dans XAMPP avec ce certificat
3. Conserve le même `ProxyPass` vers `https://tinnipax.azartech.io`

Pour un usage dev rapide, `http://www.emna.com` suffit.

---

## Comportement avec le projet Stockly

| Composant | Comportement |
|-----------|--------------|
| **Pages / assets** | Passent par le proxy → OK |
| **API** | Le frontend appelle directement `https://tinnipax.api.azartech.io` (variable `VITE_BACKEND_URL`) |
| **Login** | Fonctionne en général (CORS `*` sur l’API) |
| **WebSockets (Reverb)** | Connexion directe vers l’API, pas via `www.emna.com` |

L’API restera visible dans l’onglet **Network** du navigateur (requêtes vers `tinnipax.api.azartech.io`).

### Masquer aussi l’API (optionnel)

1. Ajoute dans `hosts` :

   ```text
   127.0.0.1   api.emna.com
   ```

2. Crée un second VirtualHost :

   ```apache
   <VirtualHost *:80>
       ServerName api.emna.com

       SSLProxyEngine On
       SSLProxyVerify none
       SSLProxyCheckPeerCN off
       SSLProxyCheckPeerName off

       ProxyPreserveHost Off
       RequestHeader set Host "tinnipax.api.azartech.io"

       ProxyPass        / https://tinnipax.api.azartech.io/
       ProxyPassReverse / https://tinnipax.api.azartech.io/
   </VirtualHost>
   ```

3. Configure le frontend avec :

   ```env
   VITE_BACKEND_URL=http://api.emna.com
   ```

   Puis relance `npm run dev` ou refais un `npm run build`.

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Apache ne démarre pas | Lire `C:\xampp\apache\logs\error.log` |
| `403 Forbidden` | Vérifier `RequestHeader set Host "tinnipax.azartech.io"` |
| Page blanche / erreur SSL | Activer `SSLProxyEngine On` et les options `SSLProxyVerify none` |
| `www.emna.com` ne répond pas | Vérifier `hosts`, port 80 libre, Apache démarré |
| Port 80 occupé (IIS, Skype…) | Arrêter l’autre service ou changer le port Apache |

---

## Variante : redirection visible (non transparente)

Si tu acceptes que l’URL change dans le navigateur :

```apache
<VirtualHost *:80>
    ServerName www.emna.com
    Redirect permanent / https://tinnipax.azartech.io/
</VirtualHost>
```

> Ce n’est **pas** transparent : l’utilisateur sera redirigé vers `tinnipax.azartech.io`.

---

## Résumé

```
hosts (127.0.0.1 → www.emna.com)
        ↓
Apache XAMPP (VirtualHost + ProxyPass)
        ↓
https://tinnipax.azartech.io (Host: tinnipax.azartech.io)
        ↓
Contenu prod affiché sous www.emna.com
```
