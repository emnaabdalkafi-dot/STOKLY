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
        // Supprimer la table rapports
        Schema::dropIfExists('rapports');

        // Ajouter fichier_path à inventaires
        Schema::table('inventaires', function (Blueprint $table) {
            $table->string('fichier_path')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventaires', function (Blueprint $table) {
            $table->dropColumn('fichier_path');
        });

        Schema::create('rapports', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('id_inventaire');
            $table->string('titre');
            $table->string('site')->nullable();
            $table->string('type_source')->nullable();
            $table->date('date_debut')->nullable();
            $table->date('date_fin')->nullable();
            $table->string('fichier_path')->nullable();
            $table->integer('total_articles')->default(0);
            $table->integer('articles_comptes')->default(0);
            $table->integer('sans_ecart_count')->default(0);
            $table->integer('ecarts_positifs')->default(0);
            $table->integer('ecarts_negatifs')->default(0);
            $table->decimal('ecart_positif_price', 15, 2)->default(0);
            $table->decimal('ecart_negatif_price', 15, 2)->default(0);
            $table->decimal('taux_avancement', 5, 2)->default(0);
            $table->json('lignes_details')->nullable();
            $table->json('agents_details')->nullable();
            $table->json('correction_details')->nullable();
            $table->timestamps();
        });
    }
};
