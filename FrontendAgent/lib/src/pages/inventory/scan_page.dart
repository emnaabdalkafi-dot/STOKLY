import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../constants/app_colors.dart';
import '../../services/inventory_service.dart';
import '../../services/sync_service.dart';
import '../../services/database_service.dart';
import 'pause_menu_page.dart';

class ScanPage extends StatefulWidget {
  final int inventoryId;
  final Map<String, dynamic>? inventoryData;
  final int? selectedEntrepotId;
  
  const ScanPage({
    super.key, 
    required this.inventoryId, 
    this.inventoryData,
    this.selectedEntrepotId,
  });

  @override
  State<ScanPage> createState() => _ScanPageState();
}

class _ScanPageState extends State<ScanPage> with SingleTickerProviderStateMixin {
  final InventoryService _inventoryService = InventoryService();
  final SyncService _syncService = SyncService();
  final DatabaseService _db = DatabaseService();
  final MobileScannerController _scannerController = MobileScannerController();
  final TextEditingController _barcodeController = TextEditingController();
  final TextEditingController _quantityController = TextEditingController(text: '1');
  
  late AnimationController _animationController;
  bool _isFlashOn = false;
  bool _isScanning = false;
  bool _isQuantityMode = false;
  String? _snackMessage;
  String? _lastScannedArticleName;
  String? _lastBarcode;
  DateTime? _lastScanTime;
  bool _isManualOpen = false;
  bool _isOnline = true;
  int _unsyncedCount = 0;
  bool _isSyncing = false;

  Offset _manualOffset = const Offset(0, 450); 

  String get _inventoryTitle => widget.inventoryData?['titre'] ?? 'Inventaire';

  String _typeLabel() {
    final type = widget.inventoryData?['type_source'] ?? '';
    switch (type) {
      case 'entrepot':
        return 'Par entrepôt';
      case 'tous':
        return 'Tous les articles';
      case 'article':
        return 'Sélection d\'articles';
      default:
        return 'Inventaire standard';
    }
  }

  List<dynamic> _entrepots = [];

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    
    // Ajouter listener pour les changements de statut de synchronisation
    _syncService.addStatusListener(_onSyncStatusChanged);
    
    // Charger l'état de synchronisation initial
    _loadSyncStatus();
    _fetchEntrepots();
  }

  Future<void> _fetchEntrepots() async {
    final res = await _inventoryService.getEntrepots();
    if (mounted && res['success']) {
      setState(() => _entrepots = res['data']);
    }
  }

  Future<void> _loadSyncStatus() async {
    final unsyncedCount = await _db.countUnsyncedScans(widget.inventoryId);
    if (mounted) {
      setState(() {
        _unsyncedCount = unsyncedCount;
      });
    }
  }

  void _onSyncStatusChanged(SyncStatus status) {
    if (mounted) {
      setState(() {
        _isSyncing = status.issyncing;
      });
      if (!status.issyncing && status.syncedCount != null && status.syncedCount! > 0) {
        _loadSyncStatus();
      }
    }
  }

  Future<void> _handleSync() async {
    setState(() => _isSyncing = true);
    try {
      final result = await _syncService.syncInventaireScans(widget.inventoryId);
      if (mounted) {
        final message = result['message'] ?? 'Synchronisation terminée';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: result['success'] == true ? Colors.green : Colors.red,
            duration: const Duration(seconds: 2),
          ),
        );
        await _loadSyncStatus();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur: ${e.toString()}'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSyncing = false);
      }
    }
  }

 

  Future<void> _handleScan(String barcode, {int quantite = 1}) async {
    final trimmedBarcode = barcode.trim();
    if (trimmedBarcode.isEmpty || _isScanning) return;

    // Éviter les scans en double trop rapides pour le même article (2 secondes de cooldown)
    if (_lastBarcode == trimmedBarcode && _lastScanTime != null) {
      if (DateTime.now().difference(_lastScanTime!).inSeconds < 2) {
        return;
      }
    }
    
    setState(() {
      _isScanning = true;
      _barcodeController.text = trimmedBarcode;
    });
    
    try {
      int? selectedEntrepotId = widget.selectedEntrepotId ?? widget.inventoryData?['id_entrepot'];
      if (selectedEntrepotId == null && widget.inventoryData?['type_source'] == 'tous' && _entrepots.isNotEmpty) {
        selectedEntrepotId = _entrepots.first['id_entrepot'];
      }

      // Étape 1: Essayer de scanner en ligne
      final result = await _inventoryService.scanBarcode(
        widget.inventoryId, 
        barcode.trim(), 
        quantite: quantite,
        idEntrepot: selectedEntrepotId,
      );

      if (mounted) {
        if (result['success'] == true) {
          // Succès en ligne
          setState(() {
            _isScanning = false;
            _snackMessage = '$barcode + $quantite';
            _lastScannedArticleName = result['article']?['nom'];
            _lastBarcode = barcode;
            _lastScanTime = DateTime.now();
            _isOnline = true;
            _isQuantityMode = false;
            _quantityController.text = '1';
            Future.delayed(const Duration(seconds: 2), () {
              if (mounted) setState(() => _snackMessage = null);
            });
          });
        } else {
          if (result.containsKey('found')) {
            final typeSource = widget.inventoryData?['type_source'] ?? '';
            final isUnknown = result['found'] == false;
            final canAdd = result['can_add'] ?? (typeSource == 'tous' || typeSource == 'entrepot');
            
            setState(() => _isScanning = false);
            
            if (canAdd) {
              if (isUnknown) {
                final localArticle = await _db.getArticleByBarcode(barcode.trim());
                if (localArticle != null && widget.selectedEntrepotId != null && localArticle['id_entrepot'] != widget.selectedEntrepotId) {
                  _showWrongWarehouseDialog(barcode.trim(), quantite, localArticle['nom']);
                } else {
                  // Propose adding the article
                  _showUnknownArticleDialog(barcode.trim(), quantite);
                }
              } else {
                final articleNom = result['article'] != null ? result['article']['nom'] : 'inconnu';
                _showKnownArticleDialog(barcode.trim(), quantite, articleNom);
              }
            } else {
              _showErrorDialog("Article hors inventaire\nCet article n'est pas inclus dans cet inventaire.");
            }
          } else {
            setState(() => _isScanning = false);
            _handleOfflineScan(barcode.trim(), quantite: quantite);
          }
          return;
        }
      }
    } catch (e) {
      // Erreur réseau ou autre - basculer en offline
      if (mounted) {
        _handleOfflineScan(barcode.trim(), quantite: quantite);
      }
    }
  }

  Future<void> _handleOfflineScan(String barcode, {int quantite = 1}) async {
    try {
      // Récupérer l'article localement (en filtrant par entrepôt si sélectionné)
      final article = await _db.getArticleByBarcode(barcode, idEntrepot: widget.selectedEntrepotId);

      if (article == null) {
        // Article non trouvé localement non plus
        if (mounted) {
          setState(() => _isScanning = false);
          _showErrorDialog('Article non trouvé\n(Mode offline: Articles non téléchargés)');
        }
        return;
      }
      
      if (widget.selectedEntrepotId != null && article['id_entrepot'] != widget.selectedEntrepotId) {
        if (mounted) {
          setState(() => _isScanning = false);
          _showWrongWarehouseDialog(barcode, quantite, article['nom']);
        }
        return;
      }

      // Enregistrer le scan localement
      final localResult = await _inventoryService.recordScanLocally(
        inventaireId: widget.inventoryId,
        codeBarres: barcode,
        ligneInventaireId: article['ligne_inventaire_id'] ?? 0,
        articleName: article['nom'],
        quantiteComptee: quantite,
        idEntrepot: widget.selectedEntrepotId,
      );

      if (mounted) {
        setState(() {
          _isScanning = false;
          _isOnline = false;
        });

        if (localResult['success'] == true) {
          _snackMessage = '$barcode + $quantite';
          _lastScannedArticleName = article['nom'];
          _lastBarcode = barcode;
          _lastScanTime = DateTime.now();
          _isQuantityMode = false;
          _quantityController.text = '1';
          
          // Charger l'unsynced count
          _loadSyncStatus();

          setState(() {
            Future.delayed(const Duration(seconds: 2), () {
              if (mounted) setState(() => _snackMessage = null);
            });
          });
        } else {
          setState(() => _isScanning = false);
          _showErrorDialog(localResult['message'] ?? 'Erreur lors de l\'enregistrement');
        }
      }
    } catch (e) {
      if (mounted) {
        _showErrorDialog('Erreur: ${e.toString()}');
        setState(() => _isScanning = false);
      }
    }
  }

  void _showWrongWarehouseDialog(String barcode, int quantite, String articleName) {
    _scannerController.stop();
    bool isSubmitting = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              contentPadding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              title: Column(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 32),
                  const SizedBox(height: 10),
                  const Text(
                    'Mauvais entrepôt',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.orange, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'L\'article "$articleName" ($barcode) existe dans l\'inventaire mais pas dans cet entrepôt.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Voulez-vous l\'y ajouter ?',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: isSubmitting ? null : () {
                    Navigator.pop(ctx);
                    _scannerController.start();
                  },
                  child: const Text('ANNULER', style: TextStyle(color: Colors.grey, fontSize: 13)),
                ),
                ElevatedButton(
                  onPressed: isSubmitting ? null : () async {
                    setModalState(() => isSubmitting = true);
                    final result = await _inventoryService.proposeArticle(
                      inventaireId: widget.inventoryId,
                      codeBarres: barcode,
                      nom: articleName,
                      quantite: quantite,
                      idEntrepot: widget.selectedEntrepotId,
                    );
                    
                    if (ctx.mounted) {
                      Navigator.pop(ctx);
                      if (result['success'] == true) {
                        setState(() {
                          _snackMessage = '$barcode + $quantite';
                          _lastScannedArticleName = articleName;
                          _lastBarcode = barcode;
                          _lastScanTime = DateTime.now();
                          Future.delayed(const Duration(seconds: 3), () {
                            if (mounted) setState(() => _snackMessage = null);
                          });
                        });
                      } else {
                        _showErrorDialog(result['message'] ?? 'Erreur lors de l\'ajout.');
                      }
                      _scannerController.start();
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                  child: isSubmitting 
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('AJOUTER', style: TextStyle(color: Colors.white, fontSize: 13)),
                ),
              ],
            );
          }
        );
      },
    );
  }

  void _showUnknownArticleDialog(String barcode, int quantite) {
    _scannerController.stop();
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        contentPadding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
        title: Column(
          children: [
           
            const SizedBox(height: 10),
            const Text(
              'Article non trouvé',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.primary, fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Le code-barres scanné est inconnu dans le système.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.backgroundStart,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AppColors.primary),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    barcode,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Voulez-vous ajouter cet article à l\'inventaire ?',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
          ],
        ),
        actions: [
          Row(
            children: [
              Expanded(
                child: TextButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _scannerController.start();
                  },
                  child: const Text('IGNORER', style: TextStyle(color: AppColors.textMuted)),
                ),
              ),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _showProposeArticleForm(barcode, quantite);
                  },
                  label: const Text('AJOUTER'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
        ],
      ),
    );
  }

  void _showKnownArticleDialog(String barcode, int quantite, String nom) {
    _scannerController.stop();
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        contentPadding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
        title: Column(
          children: [
            const SizedBox(height: 10),
            const Text(
              'Article hors inventaire',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.primary, fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Article connu mais non inclus dans l\'inventaire.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.backgroundStart,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AppColors.primary),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    nom,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppColors.textMain,
                      fontSize: 14,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    barcode,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Voulez-vous l\'ajouter ?',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
          ],
        ),
        actions: [
          Row(
            children: [
              Expanded(
                child: TextButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _scannerController.start();
                  },
                  child: const Text('IGNORER', style: TextStyle(color: AppColors.textMuted)),
                ),
              ),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () async {
                    Navigator.pop(ctx);
                    await _addKnownArticle(barcode, quantite);
                  },
                  label: const Text('AJOUTER'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
        ],
      ),
    );
  }

  Future<void> _addKnownArticle(String barcode, int quantite) async {
    setState(() => _isScanning = true);
    try {
      int? selectedEntrepotId = widget.selectedEntrepotId ?? widget.inventoryData?['id_entrepot'];
      if (selectedEntrepotId == null && widget.inventoryData?['type_source'] == 'tous' && _entrepots.isNotEmpty) {
        selectedEntrepotId = _entrepots.first['id_entrepot'];
      }

      final result = await _inventoryService.addKnownArticleToInventory(
        widget.inventoryId,
        barcode,
        quantite: quantite,
        idEntrepot: selectedEntrepotId,
      );

      if (mounted) {
        if (result['success'] == true) {
          setState(() {
            _snackMessage = '$barcode ajouté';
            _lastScannedArticleName = result['data']?['article']?['nom'];
            _lastBarcode = barcode;
            _lastScanTime = DateTime.now();
            _isQuantityMode = false;
            _quantityController.text = '1';
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('L\'article a été ajouté à l\'inventaire avec succès.', style: TextStyle(color: Colors.white)), backgroundColor: Colors.green),
          );
        } else {
          _showErrorDialog(result['message'] ?? 'Erreur lors de l\'ajout');
        }
      }
    } catch (e) {
      if (mounted) {
        _showErrorDialog('Erreur de connexion');
      }
    } finally {
      if (mounted) {
        setState(() => _isScanning = false);
        _scannerController.start();
      }
    }
  }

  void _showProposeArticleForm(String barcode, int quantite) {
  final nomController = TextEditingController();
  bool isSubmitting = false;
  int? selectedEntrepotId = widget.selectedEntrepotId ?? widget.inventoryData?['id_entrepot'];
  
  // If it's a global inventory and no specific warehouse was passed, default to first
  if (selectedEntrepotId == null && widget.inventoryData?['type_source'] == 'tous' && _entrepots.isNotEmpty) {
    selectedEntrepotId = _entrepots.first['id_entrepot'];
  }

  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setModalState) => Dialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8), // تم تعديلها إلى 8
        ),
        insetPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 24,
        ),
        child: Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8), // تم تعديلها إلى 8 لكل الجهات
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 20),
                const Text(
                  'Ajouter un article inconnu',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.primary),
                ),
                const SizedBox(height: 4),
                Text(
                  'Les informations manquantes seront complétées par l\'administrateur.',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                ),
                const SizedBox(height: 20),
                // Barcode (non-editable)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8), // تم تعديلها إلى 8
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: Row(
                    children: [
                      const Text(
                        'Code-barres :',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 8), // تم إصلاحها لإعطاء مسافة أفقية
                      Text(
                        barcode,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                          fontSize: 14,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Warehouse selection if global
                if (widget.inventoryData?['type_source'] == 'tous' && _entrepots.isNotEmpty) ...[
                  const Text('Entrepôt de destination : ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary)),
                  const SizedBox(height: 4),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8), // تم تعديلها إلى 8
                      border: Border.all(color: Colors.grey.shade300),
                    ),
                    child: Text(
                      _entrepots.firstWhere(
                        (e) => e['id_entrepot'] == selectedEntrepotId,
                        orElse: () => {'nom': 'Entrepôt'},
                      )['nom'],
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.primary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                ],
                // Article name
                TextFormField(
                  controller: nomController,
                  autofocus: true,
                  decoration: InputDecoration(
                    labelText: 'Nom de l\'article',
                    hintText: 'Ex: Carton de lait 1L',
                    labelStyle: const TextStyle(color: AppColors.primary, fontSize: 13),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)), // تم تعديلها إلى 8
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.primary)), // تم تعديلها إلى 8
                    prefixIcon: const Icon(Icons.edit_outlined, color: AppColors.primary, size: 18),
                    contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: isSubmitting
                      ? null
                      : () async {
                          final nom = nomController.text.trim();
                          if (nom.isEmpty) return;
                          setModalState(() => isSubmitting = true);
                          final result = await _inventoryService.proposeArticle(
                            inventaireId: widget.inventoryId,
                            codeBarres: barcode,
                            nom: nom,
                            quantite: quantite,
                            idEntrepot: selectedEntrepotId,
                          );
                          if (ctx.mounted) {
                            Navigator.pop(ctx);
                            if (result['success'] == true) {
                              setState(() {
                                _snackMessage = '$barcode + $quantite';
                                _lastScannedArticleName = nom;
                                _lastBarcode = barcode;
                                _lastScanTime = DateTime.now();
                                Future.delayed(const Duration(seconds: 3), () {
                                  if (mounted) setState(() => _snackMessage = null);
                                });
                              });
                            } else {
                              _showErrorDialog(result['message'] ?? 'Erreur lors de la proposition.');
                            }
                            _scannerController.start();
                          }
                        },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)), // تم تعديلها إلى 8
                    ),
                    child: isSubmitting
                      ? const SizedBox(width: 20, height: 15, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Proposer à l\'administrateur', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

  void _showErrorDialog(String message) {
    // Arrêter le scanner pour que l'utilisateur puisse lire l'erreur
    _scannerController.stop();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
        title: const Column(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 40),
            SizedBox(height: 10),
            Text('Attention', 
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.primary, fontSize: 18, fontWeight: FontWeight.bold)
            ),
          ],
        ),
        content: Text(message, 
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 14)
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            child: TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                _scannerController.start(); // Redémarrer après validation
              },
              child: const Text('OK', style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.bold, fontSize: 16)),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _syncService.removeStatusListener(_onSyncStatusChanged);
    _animationController.dispose();
    _scannerController.dispose();
    _barcodeController.dispose();
    _quantityController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Scaffold(
        resizeToAvoidBottomInset: false, 
        backgroundColor: Colors.black,
      body: Stack(
        children: [
          // camera
          MobileScanner(
            controller: _scannerController,
            onDetect: (capture) {
              final List<Barcode> barcodes = capture.barcodes;
              for (final barcode in barcodes) {
                if (barcode.rawValue != null) {
                  _handleScan(barcode.rawValue!);
                  break;
                }
              }
            },
          ),

          Positioned.fill(
            child: CustomPaint(
              painter: ScannerOverlayPainter(
                rectWidth: 280,
                rectHeight: 200,
                borderRadius: 4,
              ),
            ),
          ),

          Positioned.fill(
            child: Center(
              child: Container(
                width: 280,
                height: 200,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.white.withOpacity(0.1), width: 1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Stack(
                  children: [
                    // Ligne rouge animée
                    AnimatedBuilder(
                      animation: _animationController,
                      builder: (context, child) {
                        return Positioned(
                          top: _animationController.value * 200,
                          left: 0,
                          right: 0,
                          child: Container(
                            height: 2,
                            decoration: BoxDecoration(
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.red.withOpacity(0.6),
                                  blurRadius: 8,
                                  spreadRadius: 2,
                                )
                              ],
                              color: Colors.red,
                            ),
                          ),
                        );
                      },
                    ),
                    // Bouton Flash
                    Positioned(
                      bottom: 8,
                      right: 8,
                      child: CircleAvatar(
                        radius: 18,
                        backgroundColor: Colors.black45,
                        child: IconButton(
                          padding: EdgeInsets.zero,
                          icon: Icon(_isFlashOn ? Icons.flash_on : Icons.flash_off, color: AppColors.accent, size: 18),
                          onPressed: () {
                            setState(() => _isFlashOn = !_isFlashOn);
                            _scannerController.toggleTorch();
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.8),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: AppColors.accent.withOpacity(0.3)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(_inventoryTitle, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                                  ),
                                  // Indicateur de statut wifi online/offline
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          _isOnline ? Icons.wifi : Icons.wifi_off,
                                          color: AppColors.accent,
                                          size: 20,
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              if (_lastScannedArticleName != null)
                                Text(
                                  _lastScannedArticleName!,
                                  style: const TextStyle(color: AppColors.accent, fontSize: 13, fontWeight: FontWeight.w500),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              Row(
                                children: [
                                  Text(_typeLabel(), style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 11)),
                                  if (_unsyncedCount > 0) ...[
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.red.withOpacity(0.8),
                                        borderRadius: BorderRadius.circular(3),
                                      ),
                                      child: Text(
                                        '$_unsyncedCount non sync.',
                                        style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.pause_circle_filled, color: AppColors.accent, size: 32),
                          onPressed: () {
                            _scannerController.stop();
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (context) => PauseMenuPage(
                                inventoryId: widget.inventoryId,
                                selectedEntrepotId: widget.selectedEntrepotId,
                              )),
                            ).then((_) => _scannerController.start());
                          },
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 20),
                const Text('Scanner un code-barres', 
                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text('Placez le code dans le cadre pour scanner', 
                  style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12)),

                const Spacer(),
                const Spacer(), // Just double spacer to push content around the center frame


                // Bouton de synchronisation manuel
                if (_unsyncedCount > 0)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                    child: SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _isSyncing ? null : _handleSync,
                        icon: _isSyncing
                            ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.cloud_upload, size: 18,color: Colors.white,),
                        label: Text(
                          _isSyncing ? 'Synchronisation...' : 'Synchroniser ($_unsyncedCount)',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold,color: Colors.white),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          disabledBackgroundColor: Colors.grey.shade400,
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
                        ),
                      ),
                    ),
                  ),

                const SizedBox(height: 80),
              ],
            ),
          ),

          // Corrected Positioned for the snack message - placed directly in the Stack
          if (_snackMessage != null)
            Positioned(
              bottom: 120,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 24),
                  decoration: BoxDecoration(
                    color: _isOnline ? const Color(0xFF10B981) : Colors.orange.shade600,
                    borderRadius: BorderRadius.circular(50),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.2),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Text(
                    _snackMessage!,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ),
            ),
//saisir manuellement
          Positioned(
            left: _manualOffset.dx,
            top: _manualOffset.dy,
            child: Draggable(
              feedback: _buildManualEntryUI(true),
              childWhenDragging: Container(),
              onDragEnd: (details) {
                setState(() {
                  _manualOffset = Offset(0, details.offset.dy);
                });
              },
              child: _buildManualEntryUI(false),
            ),
          ),
        ],
      ),
    ),
    );
  }

  Widget _buildManualEntryUI(bool isDragging) {
    return Material(
      color: Colors.transparent,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        width: _isManualOpen ? (_isQuantityMode ? 350 : 250) : 40,
        child: Row(
          children: [
            GestureDetector(
              onTap: () {
                setState(() {
                  _isManualOpen = !_isManualOpen;
                  if (!_isManualOpen) _isQuantityMode = false;
                });
              },
              child: Container(
                width: 40,
                height: 50,
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(isDragging ? 0.6 : 0.9),
                  borderRadius: const BorderRadius.only(
                    topRight: Radius.circular(5),
                    bottomRight: Radius.circular(5),
                  ),
                  border: Border.all(color: AppColors.accent.withOpacity(0.3)),
                ),
                child: Icon(
                  _isManualOpen ? Icons.chevron_left : Icons.keyboard,
                  color: AppColors.accent,
                ),
              ),
            ),
            if (_isManualOpen)
              Expanded(
                child: Container(
                  height: 50,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.9),
                    border: Border.symmetric(
                      horizontal: BorderSide(color: AppColors.accent.withOpacity(0.3)),
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: TextField(
                          controller: _barcodeController,
                          autofocus: true,
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                          enabled: !_isQuantityMode,
                          decoration: const InputDecoration(
                            hintText: 'Code...',
                            hintStyle: TextStyle(color: Colors.white38, fontSize: 11),
                            border: InputBorder.none,
                          ),
                        ),
                      ),
                      if (!_isQuantityMode)
                        IconButton(
                          icon: const Icon(Icons.arrow_forward, color: AppColors.accent, size: 20),
                          onPressed: () {
                            if (_barcodeController.text.trim().isNotEmpty) {
                              setState(() => _isQuantityMode = true);
                            }
                          },
                        ),
                      if (_isQuantityMode) ...[
                        const VerticalDivider(color: Colors.white24, indent: 10, endIndent: 10),
                        Expanded(
                          flex: 1,
                          child: TextField(
                            controller: _quantityController,
                            autofocus: true,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(color: AppColors.accent, fontSize: 14, fontWeight: FontWeight.bold),
                            decoration: const InputDecoration(
                              hintText: 'Qté',
                              hintStyle: TextStyle(color: Colors.white38, fontSize: 11),
                              border: InputBorder.none,
                            ),
                          ),
                        ),
                      ],
                      if (_isScanning)
                        const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accent))
                      else
                        IconButton(
                          icon: const Icon(Icons.send_rounded, color: AppColors.accent, size: 20),
                          onPressed: () {
                            final qte = int.tryParse(_quantityController.text) ?? 1;
                            _handleScan(_barcodeController.text, quantite: qte);
                          },
                        ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

//scanner overlay painter
class ScannerOverlayPainter extends CustomPainter {
  final double rectWidth;
  final double rectHeight;
  final double borderRadius;

  ScannerOverlayPainter({required this.rectWidth, required this.rectHeight, required this.borderRadius});

  @override
  void paint(Canvas canvas, Size size) {
    final scanRect = Rect.fromCenter(
      center: Offset(size.width / 2, size.height / 2),
      width: rectWidth,
      height: rectHeight,
    );

    const double radius = 12.0;

    // 1. Draw darkened background around the scan area
    final backgroundPath = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addRRect(RRect.fromRectAndRadius(scanRect, const Radius.circular(radius)))
      ..fillType = PathFillType.evenOdd;
    
    canvas.drawPath(backgroundPath, Paint()..color = Colors.black.withOpacity(0.5));

    // 2. Draw corners
    final Paint paint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.0
      ..strokeCap = StrokeCap.round;

    final double cornerSize = 30.0;

    // Coins (Corners) - Dessiner des "L" stylisés et épais
    
    // Haut Gauche
    canvas.drawPath(
      Path()
        ..moveTo(scanRect.left, scanRect.top + cornerSize)
        ..lineTo(scanRect.left, scanRect.top + radius)
        ..arcToPoint(Offset(scanRect.left + radius, scanRect.top), radius: const Radius.circular(radius))
        ..lineTo(scanRect.left + cornerSize, scanRect.top),
      paint,
    );

    // Haut Droite
    canvas.drawPath(
      Path()
        ..moveTo(scanRect.right - cornerSize, scanRect.top)
        ..lineTo(scanRect.right - radius, scanRect.top)
        ..arcToPoint(Offset(scanRect.right, scanRect.top + radius), radius: const Radius.circular(radius))
        ..lineTo(scanRect.right, scanRect.top + cornerSize),
      paint,
    );

    // Bas Gauche
    canvas.drawPath(
      Path()
        ..moveTo(scanRect.left, scanRect.bottom - cornerSize)
        ..lineTo(scanRect.left, scanRect.bottom - radius)
        ..arcToPoint(Offset(scanRect.left + radius, scanRect.bottom), radius: const Radius.circular(radius), clockwise: false)
        ..lineTo(scanRect.left + cornerSize, scanRect.bottom),
      paint,
    );

    // Bas Droite
    canvas.drawPath(
      Path()
        ..moveTo(scanRect.right - cornerSize, scanRect.bottom)
        ..lineTo(scanRect.right - radius, scanRect.bottom)
        ..arcToPoint(Offset(scanRect.right, scanRect.bottom - radius), radius: const Radius.circular(radius), clockwise: true)
        ..lineTo(scanRect.right, scanRect.bottom - cornerSize),
      paint,
    );
  }

  @override
  bool shouldRepaint(CustomPainter oldDelegate) => false;
}