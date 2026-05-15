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
        Schema::create('corrections', function (Blueprint $table) {
    $table->id('id_corr');
    $table->unsignedBigInteger('id_ligne_inventaire');
    $table->unsignedBigInteger('id_agent');
    $table->unsignedBigInteger('id_admin')->nullable();
    $table->integer('qte');
    $table->text('description');
    $table->enum('statut_validation', ['en attente', 'valide', 'refuse'])->default('en attente');
    $table->text('motif_rejet')->nullable();
    $table->timestamps();

    $table->foreign('id_ligne_inventaire')->references('id_ligne')->on('ligne_inventaires')->onDelete('cascade');
    $table->foreign('id_agent')->references('id')->on('utilisateurs')->onDelete('cascade');
    $table->foreign('id_admin')->references('id')->on('utilisateurs')->onDelete('set null');
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('corrections');
    }
};
