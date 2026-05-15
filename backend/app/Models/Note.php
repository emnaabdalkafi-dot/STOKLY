<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Note extends Model
{
    use HasFactory;

    protected $primaryKey = 'id_note';

    protected $fillable = [
        'id_inventaire',
        'id_user',
        'contenu',
    ];

    public function inventaire()
    {
        return $this->belongsTo(Inventaire::class, 'id_inventaire', 'id_inventaire');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'id_user');
    }
}
