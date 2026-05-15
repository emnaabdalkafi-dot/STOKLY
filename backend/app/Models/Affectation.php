<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Affectation extends Model
{
    protected $table = 'affectations';

    protected $primaryKey = 'id_affectation';

    protected $fillable = [
        'id_agent',
        'id_inventaire',
        'statut_participation'
    ];

    public function inventaire()
    {
        return $this->belongsTo(Inventaire::class, 'id_inventaire');
    }

    public function agent()
    {
        return $this->belongsTo(User::class, 'id_agent');
    }
}