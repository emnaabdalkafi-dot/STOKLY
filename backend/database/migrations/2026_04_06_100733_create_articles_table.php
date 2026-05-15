<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('articles', function (Blueprint $table) {
    $table->id('id_article');
    $table->string('code_barres')->unique();
    $table->string('nom');
    $table->integer('quantite_theorique')->default(0);
    $table->decimal('prix', 15, 3)->default(0);
    $table->enum('etat', ['connu', 'inconnu'])->default('connu');
    $table->timestamps();
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('articles');
    }
};
