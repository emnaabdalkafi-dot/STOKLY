<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->enum('statut', ['connu', 'inconnu'])->default('connu')->after('etat');
            $table->unsignedBigInteger('propose_par')->nullable()->after('statut');
        });
    }

    public function down(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->dropColumn(['statut', 'propose_par']);
        });
    }
};
