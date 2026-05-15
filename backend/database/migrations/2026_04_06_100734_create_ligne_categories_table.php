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
        Schema::create('ligne_categories', function (Blueprint $table) {
    $table->unsignedBigInteger('id_article');
    $table->unsignedBigInteger('id_category');

    $table->primary(['id_article', 'id_category']);

    $table->foreign('id_article')->references('id_article')->on('articles')->onDelete('cascade');
    $table->foreign('id_category')->references('id_category')->on('categories')->onDelete('cascade');
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ligne_categories');
    }
};
