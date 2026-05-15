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
            $table->integer('sans_ecart_count')->default(0)->after('articles_comptes');
            $table->decimal('ecart_positif_price', 15, 2)->default(0)->after('ecarts_positifs');
            $table->decimal('ecart_negatif_price', 15, 2)->default(0)->after('ecarts_negatifs');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('rapports', function (Blueprint $table) {
            $table->dropColumn(['sans_ecart_count', 'ecart_positif_price', 'ecart_negatif_price']);
        });
    }
};
