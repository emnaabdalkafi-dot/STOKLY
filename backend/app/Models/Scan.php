<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Scan extends Model
{
    use HasFactory;

    protected $fillable = [
        'id_ligne',
        'id_agent',
        'quantite',
    ];

    public function ligne()
    {
        return $this->belongsTo(LigneInventaire::class, 'id_ligne', 'id_ligne');
    }

    public function agent()
    {
        return $this->belongsTo(User::class, 'id_agent');
    }
}
