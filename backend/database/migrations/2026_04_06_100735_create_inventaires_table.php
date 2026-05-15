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
       Schema::create('inventaires', function (Blueprint $table) {
    $table->id('id_inventaire');
    $table->date('date_debut')->nullable();
    $table->date('date_fin')->nullable();
    $table->enum('statut', ['en cours', 'en attente', 'termine'])->default('en attente');
    $table->string('site')->nullable();
    $table->timestamps();
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventaires');
    }
};
