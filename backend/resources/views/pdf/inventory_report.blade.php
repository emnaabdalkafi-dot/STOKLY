<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Rapport d'Inventaire - {{ $inventaire->titre }}</title>
    <style>
        body { font-family: sans-serif; font-size: 12px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { margin: 0; color: #102a43; }
        .section { margin-bottom: 20px; }
        .section h2 { border-bottom: 1px solid #ddd; padding-bottom: 5px; color: #102a43; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f8fafc; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Rapport Final d'Inventaire</h1>
        <p>Généré le {{ now()->format('d/m/Y H:i') }}</p>
    </div>

    <div class="section">
        <h2>Détails de l'Inventaire</h2>
        <p><strong>Titre :</strong> {{ $inventaire->titre }}</p>
        <p><strong>Site :</strong> {{ $inventaire->site }}</p>
        <p><strong>Type de Source :</strong> 
            @if(($summary['type_source'] ?? '') == 'tous') Tous les articles
            @elseif(($summary['type_source'] ?? '') == 'entrepot') Par Entrepôt
            @elseif(($summary['type_source'] ?? '') == 'article') Sélection d'articles
            @else — @endif
        </p>
        <p><strong>Date début :</strong> {{ \Carbon\Carbon::parse($inventaire->date_debut)->format('d/m/Y') }}</p>
        <p><strong>Date fin :</strong> {{ \Carbon\Carbon::parse($inventaire->date_fin)->format('d/m/Y') }}</p>
    </div>

    <div class="section">
        <h2>Statistiques Globales</h2>
        <table>
            <tr>
                <th>Articles sans écart</th>
                <td>{{ $summary['sans_ecart_count'] }}</td>
            </tr>
            <tr>
                <th>Articles avec écart positif (+)</th>
                <td>{{ $summary['ecart_positif_count'] }} ({{ number_format($summary['ecart_positif_price'], 2) }} DT)</td>
            </tr>
            <tr>
                <th>Articles avec écart négatif (-)</th>
                <td>{{ $summary['ecart_negatif_count'] }} ({{ number_format($summary['ecart_negatif_price'], 2) }} DT)</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <h2>Agents participants</h2>
        <p>
            @foreach($agent_names as $name)
                <span style="background: #eee; padding: 2px 8px; border-radius: 4px; margin-right: 5px;">{{ $name }}</span>
            @endforeach
        </p>
    </div>

    <div class="section">
        <h2>Détails des Articles</h2>
        <table>
            <thead>
                <tr>
                    <th>Article</th>
                    <th>Prix</th>
                    <th>Théorique</th>
                    <th>Compté</th>
                    <th>Écart</th>
                </tr>
            </thead>
            <tbody>
                @foreach($lignes_details as $ligne)
                <tr>
                    <td>
                        <strong>{{ $ligne['nom'] }}</strong><br>
                        <small>{{ $ligne['code_barres'] }}</small>
                    </td>
                    <td>{{ number_format($ligne['prix'], 2) }}</td>
                    <td>{{ $ligne['theorique'] }}</td>
                    <td>{{ $ligne['comptee'] }}</td>
                    <td style="color: {{ $ligne['ecart'] > 0 ? 'green' : ($ligne['ecart'] < 0 ? 'red' : 'black') }};">
                        {{ $ligne['ecart'] > 0 ? '+' : '' }}{{ $ligne['ecart'] }}
                    </td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Détails des Contributions (Articles & Agents)</h2>
        <table>
            <thead>
                <tr>
                    <th>Article</th>
                    <th>Agents & Quantités scannées</th>
                </tr>
            </thead>
            <tbody>
                @foreach($lignes_details as $ligne)
                @if($ligne['agents_contrib'])
                <tr>
                    <td>{{ $ligne['nom'] }}</td>
                    <td>{{ $ligne['agents_contrib'] }}</td>
                </tr>
                @endif
                @endforeach
            </tbody>
        </table>
    </div>

    @if(count($corrections) > 0)
    <div class="section">
        <h2>Demandes de Correction</h2>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Article</th>
                    <th>Agent</th>
                    <th>Ancienne Qte</th>
                    <th>Nouvelle Qte</th>
                    <th>Statut</th>
                </tr>
            </thead>
            <tbody>
                @foreach($corrections as $corr)
                <tr>
                    <td>{{ $corr['date'] }}</td>
                    <td>{{ $corr['article'] }}</td>
                    <td>{{ $corr['agent'] }}</td>
                    <td>{{ $corr['ancienne_qte'] }}</td>
                    <td>{{ $corr['nouvelle_qte'] }}</td>
                    <td style="color: {{ $corr['statut'] == 'valide' ? 'green' : ($corr['statut'] == 'refuse' ? 'red' : 'orange') }}">
                        {{ ucfirst($corr['statut']) }}
                    </td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    @endif

    @if(count($articles_inconnus) > 0)
    <div class="section">
        <h2>Articles Inconnus (Découverts)</h2>
        <table>
            <thead>
                <tr>
                    <th>Code Barres</th>
                    <th>Nom Article</th>
                    <th>Quantité</th>
                    <th>Entrepôt</th>
                </tr>
            </thead>
            <tbody>
                @foreach($articles_inconnus as $art)
                <tr>
                    <td>{{ $art['code_barres'] }}</td>
                    <td>{{ $art['nom'] }}</td>
                    <td>{{ $art['quantite'] }}</td>
                    <td>{{ $art['entrepot'] }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    @endif

    <div style="margin-top: 50px; text-align: center; color: #888; font-size: 10px;">
        Document généré automatiquement par STOKLY.
    </div>
</body>
</html>
