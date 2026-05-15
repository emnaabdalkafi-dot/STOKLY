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
        Schema::create('ligne_entrepots', function (Blueprint $table) {
    $table->unsignedBigInteger('id_entrepot');
    $table->unsignedBigInteger('id_article');

    $table->primary(['id_entrepot', 'id_article']);

    $table->foreign('id_entrepot')->references('id_entrepot')->on('entrepots')->onDelete('cascade');
    $table->foreign('id_article')->references('id_article')->on('articles')->onDelete('cascade');
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ligne_entrepots');
    }
};
