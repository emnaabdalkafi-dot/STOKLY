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
        Schema::table('rapports', function (Blueprint $table) {
            $table->string('site')->after('titre')->nullable();
            $table->date('date_debut')->after('site')->nullable();
            $table->date('date_fin')->after('date_debut')->nullable();
            $table->integer('articles_comptes')->default(0)->after('total_articles');
            $table->json('lignes_details')->nullable()->after('donnees_json');
            $table->json('agents_details')->nullable()->after('lignes_details');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('rapports', function (Blueprint $table) {
            //
        });
    }
};
