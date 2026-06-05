import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/user_provider.dart';
import '../../constants/app_colors.dart';
import 'notes_list_page.dart';
import 'correction_page.dart';
import 'sync_status_page.dart';
import '../../services/inventory_service.dart';
import '../../services/sync_service.dart';
import '../../services/database_service.dart';
import 'inventory_details_page.dart';
class PauseMenuPage extends StatelessWidget {
  final int inventoryId;
  final int? selectedEntrepotId;
  final InventoryService _inventoryService = InventoryService();
  final SyncService _syncService = SyncService();
  final DatabaseService _db = DatabaseService();
  
  PauseMenuPage({super.key, required this.inventoryId, this.selectedEntrepotId});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.backgroundStart, AppColors.backgroundEnd],
          ),
        ),
        child: SafeArea(
          child: FutureBuilder<Map<String, dynamic>>(
            future: _inventoryService.getInventories(),
            builder: (context, snapshot) {
              Map<String, dynamic>? currentInv;
              if (snapshot.hasData && snapshot.data?['success'] == true) {
                 final list = snapshot.data?['data'] as List?;
                 currentInv = list?.firstWhere((inv) => inv['id_inventaire'] == inventoryId, orElse: () => null);
              }
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header consistent with Home/Notifications
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            GestureDetector(
                              onTap: () => Navigator.pop(context),
                              child: const Icon(
                                Icons.arrow_back_ios_new_rounded,
                                color: AppColors.primary,
                                size: 18,
                              ),
                            ),
                            const SizedBox(width: 12),
                            const Text(
                              'Menu de Pause',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(7), // Increased from 5
                          child: Image.asset(
                            'assets/images/logo.png',
                            width: 30,
                            height: 30,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    
                    // Active Inventory Info Card
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(6), // Increased from 4
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'INVENTAIRE ACTIF',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.2,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            currentInv?['titre'] ?? '...',
                            style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Icon(Icons.location_on, color: Colors.white54, size: 12),
                              const SizedBox(width: 4),
                              Text(
                                currentInv?['site'] ?? '...',
                                style: const TextStyle(color: Colors.white54, fontSize: 12),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Navigation Items
                    Expanded(
                      child: ListView(
                        physics: const BouncingScrollPhysics(),
                        children: [
                          _buildMenuCard(
                            context,
                            'Informations',
                            'Détails complets du projet',
                            Icons.info_outline_rounded,
                            () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => InventoryDetailsPage(
                                  inventoryId: inventoryId,
                                  showActionButton: false,
                                ),
                              ),
                            ),
                          ),
                          _buildMenuCard(
                            context,
                            'Notes',
                            'Remarques de session',
                            Icons.note_alt_outlined,
                            () => Navigator.push(context, MaterialPageRoute(builder: (context) => NotesListPage(
                              inventoryId: inventoryId,
                              inventoryTitle: currentInv?['titre'] ?? 'Inventaire',
                            ))),
                          ),
                          _buildMenuCard(
                            context,
                            'Corrections',
                            'Rectifier une erreur',
                            Icons.edit_note_rounded,
                            () => Navigator.push(context, MaterialPageRoute(builder: (context) => CorrectionPage(
                              inventoryId: inventoryId,
                              selectedEntrepotId: selectedEntrepotId,
                            ))),
                          ),
                          _buildMenuCard(
                            context,
                            'Synchronisation',
                            'Statut des données',
                            Icons.sync_rounded,
                            () => Navigator.push(context, MaterialPageRoute(builder: (context) => SyncStatusPage(
                              inventoryId: inventoryId,
                              inventoryTitle: currentInv?['titre'] ?? 'Inventaire',
                            ))),
                          ),
                          
                          const SizedBox(height: 32),
                          
                          // Stop Action
                          GestureDetector(
                            onTap: () => _handleStopInventory(context),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(6), // Increased from 4
                                border: Border.all(color: Colors.red.shade100),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.power_settings_new_rounded, color: Colors.red.shade700, size: 20),
                                  const SizedBox(width: 10),
                                  Text(
                                    'ARRÊTER L\'INVENTAIRE',
                                    style: TextStyle(
                                      color: Colors.red.shade700,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 40),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }
          ),
        ),
      ),
    );
  }
  Widget _buildMenuCard(BuildContext context, String title, String subtitle, IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(6), // Increased from 4
          border: Border.all(color: Colors.blue.shade50),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.backgroundStart,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Icon(icon, color: AppColors.primary, size: 20),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.primary),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: Colors.grey.shade300, size: 18),
          ],
        ),
      ),
    );
  }
  Future<void> _handleStopInventory(BuildContext context) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
        title: const Text('Arrêter l\'inventaire ?', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: const Text('Voulez-vous vraiment terminer cette session ?', style: TextStyle(fontSize: 13)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('ANNULER', style: TextStyle(color: Colors.grey))),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('CONFIRMER', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold))),
        ],
      ),
    );
    if (confirm != true) return;
    if (!context.mounted) return;
    
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
    );
    try {
      await _syncService.syncInventaireScans(inventoryId);
      final stopResult = await _inventoryService.stopInventaire(inventoryId);
      
      if (stopResult['success'] == true) {
        if (context.mounted) {
          Provider.of<UserProvider>(context, listen: false).setActiveInventory(null);
        }
        final unsyncedCount = await _db.countUnsyncedScans(inventoryId);
        if (unsyncedCount == 0) {
          await _db.cleanupInventaireData(inventoryId);
        }
        if (context.mounted) {
          Navigator.of(context).pop(); // Close loading
          Navigator.of(context).popUntil((route) => route.isFirst);
        }
      } else {
        if (context.mounted) {
          Navigator.of(context).pop(); // Close loading
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(stopResult['message'] ?? 'Erreur lors de l\'arrêt')),
          );
        }
      }
    } catch (e) {
      if (context.mounted) {
        Navigator.of(context).pop(); // Close loading
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erreur: $e')));
      }
    }
  }
}
