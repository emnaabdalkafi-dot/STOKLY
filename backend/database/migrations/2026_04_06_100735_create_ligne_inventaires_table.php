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
        Schema::create('ligne_inventaires', function (Blueprint $table) {
            $table->id('id_ligne');
            $table->unsignedBigInteger('id_inventaire');
            $table->unsignedBigInteger('id_article');
            $table->integer('ecart')->nullable();
            $table->integer('quantite_comptee')->nullable();
            $table->integer('quantite_theorique')->default(0);
            $table->timestamps();

    $table->foreign('id_inventaire')->references('id_inventaire')->on('inventaires')->onDelete('cascade');
    $table->foreign('id_article')->references('id_article')->on('articles')->onDelete('cascade');
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ligne_inventaires');
    }
};
