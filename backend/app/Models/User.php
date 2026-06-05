<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use App\Models\Affectation;
use App\Models\Inventaire;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $table = 'utilisateurs';

    protected $primaryKey = 'id';

    public $incrementing = true;

    protected $keyType = 'int';

    protected $fillable = [
        'nom',
        'prenom',
        'tel',
        'email',
        'avatar',
        'password',
        'role'
    ];

    protected $hidden = [
        'password',
    ];
    public function getRememberTokenName()
    {
        return null;
    }

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
        ];
    }

   public function affectations()
{
    return $this->hasMany(Affectation::class, 'id_agent');
}


}
