<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    use HasFactory;

    protected $primaryKey = 'id_notification';

    protected $fillable = [
        'type',
        'id_inventaire',
        'id_article',
        'id_user',
        'contenu',
        'statut',
    ];

    public function user()
    {
        return $this->belongsTo(Utilisateur::class, 'id_user');
    }

    public function inventaire()
    {
        return $this->belongsTo(Inventaire::class, 'id_inventaire');
    }

    public function article()
    {
        return $this->belongsTo(Article::class, 'id_article');
    }
}
