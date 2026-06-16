<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Inventaire extends Model
{
    use HasFactory;

    protected $table = 'inventaires';
    protected $primaryKey = 'id_inventaire';
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'titre',
        'date_debut',
        'date_fin',
        'statut',
        'site',
        'type_source',
        'id_entrepot',
        'remarque',
        'fichier_path',
    ];
public function affectations()
{
    return $this->hasMany(Affectation::class, 'id_inventaire');
}

public function lignes()
{
    return $this->hasMany(LigneInventaire::class, 'id_inventaire', 'id_inventaire');
}

public function entrepot()
{
    return $this->belongsTo(Entrepot::class, 'id_entrepot', 'id_entrepot');
}

    public function scans()
    {
        return $this->hasManyThrough(
            Scan::class,
            LigneInventaire::class,
            'id_inventaire', // FK on ligne_inventaires pointing to inventaires
            'id_ligne',      // FK on scans pointing to ligne_inventaires
            'id_inventaire', // local key on inventaires
            'id_ligne'       // local key on ligne_inventaires
        );
    }

    public function notes()
    {
        return $this->hasMany(Note::class, 'id_inventaire', 'id_inventaire');
    }
}
