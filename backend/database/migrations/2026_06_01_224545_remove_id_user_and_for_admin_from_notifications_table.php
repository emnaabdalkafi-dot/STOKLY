<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {

           
            if (Schema::hasColumn('notifications', 'id_user')) {
                $table->dropForeign(['id_user']);
                $table->dropColumn('id_user');
            }

            if (Schema::hasColumn('notifications', 'for_admin')) {
                $table->dropColumn('for_admin');
            }
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {

            $table->unsignedBigInteger('id_user')->nullable();
            $table->foreign('id_user')
                  ->references('id')
                  ->on('utilisateurs')
                  ->onDelete('cascade');

            $table->boolean('for_admin')->default(false);
        });
    }
};