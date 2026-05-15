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
       Schema::create('notes', function (Blueprint $table) {
    $table->id('id_note');
    $table->unsignedBigInteger('id_inventaire');
    $table->unsignedBigInteger('id_admin');
    $table->text('contenu');
    $table->timestamps();

    $table->foreign('id_inventaire')->references('id_inventaire')->on('inventaires')->onDelete('cascade');
    $table->foreign('id_admin')->references('id')->on('utilisateurs')->onDelete('cascade');
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notes');
    }
};
