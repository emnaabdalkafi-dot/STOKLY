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
      Schema::create('affectations', function (Blueprint $table) {
    $table->id('id_affectation');

    $table->unsignedBigInteger('id_agent');
    $table->unsignedBigInteger('id_inventaire');

    $table->enum('statut_participation', ['actif', 'inactif'])->default('actif');

    $table->timestamps();

    $table->foreign('id_agent')
        ->references('id')
        ->on('utilisateurs')
        ->onDelete('cascade');

    $table->foreign('id_inventaire')
        ->references('id_inventaire')
        ->on('inventaires')
        ->onDelete('cascade');
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('affectations');
    }
};
