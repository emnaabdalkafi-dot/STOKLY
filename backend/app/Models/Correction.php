<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Correction extends Model
{
    use HasFactory;

    protected $primaryKey = 'id_corr';

    protected $fillable = [
        'id_ligne_inventaire',
        'id_agent',
        'qte',
        'description',
        'statut_validation',
    ];

    public function ligne()
    {
        return $this->belongsTo(LigneInventaire::class, 'id_ligne_inventaire', 'id_ligne');
    }

    public function agent()
    {
        return $this->belongsTo(User::class, 'id_agent');
    }


}
