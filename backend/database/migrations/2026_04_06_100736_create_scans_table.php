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
        Schema::create('scans', function (Blueprint $table) {
    $table->id('id_scan');
    $table->unsignedBigInteger('id_ligne_inventaire');
    $table->unsignedBigInteger('id_agent');
    $table->integer('quantite')->default(1);
    $table->dateTime('date_derniere_scan')->useCurrent();
    $table->timestamps();

    $table->foreign('id_ligne_inventaire')->references('id_ligne')->on('ligne_inventaires')->onDelete('cascade');
    $table->foreign('id_agent')->references('id')->on('utilisateurs')->onDelete('cascade');
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('scans');
    }
};
