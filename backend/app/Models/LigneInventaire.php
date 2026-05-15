<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LigneInventaire extends Model
{
    use HasFactory;

    protected $table = 'ligne_inventaires';
    protected $primaryKey = 'id_ligne';

    protected $fillable = [
        'id_inventaire',
        'id_article',
        'id_entrepot',
        'ecart',
        'quantite_comptee',
        'quantite_theorique',
    ];

    public function entrepot()
    {
        return $this->belongsTo(Entrepot::class, 'id_entrepot', 'id_entrepot');
    }

    public function inventaire()
    {
        return $this->belongsTo(Inventaire::class, 'id_inventaire', 'id_inventaire');
    }

    public function article()
    {
        return $this->belongsTo(Article::class, 'id_article', 'id_article');
    }
}
