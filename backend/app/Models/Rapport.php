<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Rapport extends Model
{
    protected $table = 'rapports';

    protected $fillable = [
        'id_inventaire',
        'titre',
        'site',
        'type_source',
        'date_debut',
        'date_fin',
        'fichier_path',
        'total_articles',
        'articles_comptes',
        'ecarts_positifs',
        'ecarts_negatifs',
        'sans_ecart_count',
        'ecart_positif_price',
        'ecart_negatif_price',
        'correction_details',
        'lignes_details',
        'agents_details'
    ];

    protected $casts = [
        'correction_details' => 'array',
        'lignes_details' => 'array',
        'agents_details' => 'array',
        'date_debut' => 'date',
        'date_fin' => 'date'
    ];
}
