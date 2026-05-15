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
        Schema::dropIfExists('scans');
        Schema::create('scans', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('id_inventaire');
            $table->unsignedBigInteger('id_article');
            $table->unsignedBigInteger('id_agent');
            $table->string('code_barres');
            $table->timestamps();

            $table->foreign('id_inventaire')->references('id_inventaire')->on('inventaires')->onDelete('cascade');
            $table->foreign('id_article')->references('id_article')->on('articles')->onDelete('cascade');
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
