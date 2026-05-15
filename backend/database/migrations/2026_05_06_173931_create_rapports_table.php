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
        Schema::create('rapports', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('id_inventaire');
            $table->string('titre');
            $table->string('fichier_path');
            $table->integer('total_articles')->default(0);
            $table->float('taux_avancement')->default(0);
            $table->integer('ecarts_positifs')->default(0);
            $table->integer('ecarts_negatifs')->default(0);
            $table->json('donnees_json')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rapports');
    }
};
