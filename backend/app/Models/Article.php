<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Article extends Model
{
    use HasFactory;

    protected $table = 'articles';
    protected $primaryKey = 'id_article';

    protected $fillable = [
        'code_barres',
        'nom',
        'prix',
        'etat',
        'quantite_total',
        'propose_par',
    ];

    public function proposePar()
    {
        return $this->belongsTo(\App\Models\User::class, 'propose_par', 'id');
    }

    public function scopeInconnu($query)
    {
        return $query->where('etat', 'inconnu');
    }

    public function scopeConnu($query)
    {
        return $query->where('etat', 'connu');
    }

    protected $appends = ['ecart_global', 'ecart_dernier'];

    public function getEcartGlobalAttribute()
    {
        return $this->lignesInventaire->whereNotNull('quantite_comptee')->sum('ecart');
    }

    public function getEcartDernierAttribute()
    {
        $derniereLigne = $this->lignesInventaire->sortByDesc('created_at')->first();
        if (!$derniereLigne || $derniereLigne->quantite_comptee === null) {
            return null;
        }
        return $derniereLigne->ecart;
    }

    public function categories()
    {
        return $this->belongsToMany(Category::class, 'ligne_categories', 'id_article', 'id_category');
    }

    public function entrepots()
    {
        return $this->belongsToMany(Entrepot::class, 'ligne_entrepots', 'id_article', 'id_entrepot')
                    ->withPivot('quantite', 'propose_par');
    }

    public function lignesInventaire()
    {
        return $this->hasMany(LigneInventaire::class, 'id_article', 'id_article');
    }
}
