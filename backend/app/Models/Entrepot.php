<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Entrepot extends Model
{
    use HasFactory;

    protected $table = 'entrepots';
    protected $primaryKey = 'id_entrepot';

    protected $fillable = [
        'nom',
        'location',
    ];

    public function articles()
    {
        return $this->belongsToMany(Article::class, 'ligne_entrepots', 'id_entrepot', 'id_article')
                    ->withPivot('quantite', 'propose_par');
    }
}
