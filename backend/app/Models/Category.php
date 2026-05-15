<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use HasFactory;

    protected $table = 'categories';
    protected $primaryKey = 'id_category';

    protected $fillable = [
        'nom',
        'description',
    ];

    public function articles()
    {
        return $this->belongsToMany(Article::class, 'ligne_categories', 'id_category', 'id_article');
    }
}
