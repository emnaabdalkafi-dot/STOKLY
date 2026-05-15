<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('corrections', function (Blueprint $table) {
            $table->dropForeign('corrections_id_admin_foreign');
            $table->dropColumn('id_admin');
        });
    }

    public function down(): void
    {
        Schema::table('corrections', function (Blueprint $table) {
            $table->unsignedBigInteger('id_admin')->nullable()->after('id_agent');
            $table->foreign('id_admin')->references('id')->on('utilisateurs')->onDelete('set null');
        });
    }
};
