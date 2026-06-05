import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/user_provider.dart';
import '../../constants/app_colors.dart';
import '../../constants/api_constants.dart';
import '../../services/inventory_service.dart';
import '../../services/websocket_service.dart';
import '../../services/sync_service.dart';
import 'scan_page.dart';
import 'notes_list_page.dart';
import '../../widgets/custom_app_bar.dart';

class AgentsProvider extends ChangeNotifier {
  List<dynamic> agents = [];

  void setAgents(List<dynamic> newAgents) {
    agents = newAgents;
    notifyListeners();
  }

  void updateAgentStatus(dynamic agentId, String newStatus) {
    final index = agents.indexWhere((aff) {
      final id = aff['agent']?['id'];
      return id?.toString() == agentId?.toString();
    });
    if (index != -1) {
      agents[index]['statut_participation'] = newStatus;
      notifyListeners();
    }
  }
}

class InventoryDetailsPage extends StatefulWidget {
  final int inventoryId;
  final bool showActionButton;
  const InventoryDetailsPage({
    super.key, 
    required this.inventoryId, 
    this.showActionButton = true
  });

  @override
  State<InventoryDetailsPage> createState() => _InventoryDetailsPageState();
}

class _InventoryDetailsPageState extends State<InventoryDetailsPage> {
  final InventoryService _inventoryService = InventoryService();
  final WebSocketService _wsService = WebSocketService();
  final SyncService _syncService = SyncService();
  Map<String, dynamic>? _details;
  bool _isLoading = true;
  bool _isStarting = false;
  String? _errorMessage;
  bool _showArticles = false;
  bool _liveUpdate = false; // true for 2s when a real-time update arrives

  final AgentsProvider _agentsProvider = AgentsProvider();

  bool _hasUnreadNotes = false;
  List<Map<String, dynamic>> _uniqueEntrepots = [];
  int? _selectedEntrepotId;

  @override
  void initState() {
    super.initState();
    _fetchDetails();
    _connectWebSocket();
  }

  Future<void> _connectWebSocket() async {
    await _wsService.connect();
    await _wsService.subscribeToInventaireChannel(
      widget.inventoryId,
      onScan: (data) {
        // Refresh details silently when a scan arrives from another device
        if (mounted) _refreshSilently();
      },
      onAgentStatus: (data) {
        if (mounted && data['agent_id'] != null && data['status'] != null) {
          _agentsProvider.updateAgentStatus(data['agent_id'], data['status']);
        }
      },
      onNoteReceived: (data) {
        final currentUserId = Provider.of<UserProvider>(context, listen: false).user?['id'];
        if (mounted && data['user']?['id'] != currentUserId) {
          setState(() => _hasUnreadNotes = true);
          final isAdmin = data['user']?['role'] == 'admin';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(isAdmin ? 'Nouvelle note de l\'Administrateur !' : 'Nouvelle note ajoutée !'),
              backgroundColor: isAdmin ? Colors.orange : AppColors.accent,
              duration: const Duration(seconds: 3),
            ),
          );
        }
      },
      onNoteUpdated: (data) {
        final currentUserId = Provider.of<UserProvider>(context, listen: false).user?['id'];
        if (mounted && data['user']?['id'] != currentUserId) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Une note a été modifiée'), backgroundColor: Colors.blue),
          );
        }
      },
      onNoteDeleted: (data) {
        // Assume data contains 'user_id' or 'id_user' of the person who deleted
        final currentUserId = Provider.of<UserProvider>(context, listen: false).user?['id'];
        final deleterId = data['user_id'] ?? data['id_user'];
        if (mounted && deleterId != currentUserId) {
           ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Une note a été supprimée'), backgroundColor: Colors.red),
          );
        }
      },
    );
  }

  Future<void> _refreshSilently() async {
    final result = await _inventoryService.getInventoryDetails(widget.inventoryId);
    if (mounted && result['success'] == true) {
      setState(() {
        _details = result['data'];
        _liveUpdate = true;
      });
      // Reset live indicator after 2 seconds
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) setState(() => _liveUpdate = false);
      });
    }
  }

  @override
  void dispose() {
    _agentsProvider.dispose();
    _wsService.unsubscribe('private-inventaire.${widget.inventoryId}');
    super.dispose();
  }

  Future<void> _fetchDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    final result = await _inventoryService.getInventoryDetails(widget.inventoryId);
    if (mounted) {
      setState(() {
        if (result['success'] == true) {
          _details = result['data'];
          _agentsProvider.setAgents((result['data']['affectations'] as List?) ?? []);
          
          // Extraire les entrepôts uniques des lignes
          final lignes = (_details!['lignes'] as List?) ?? [];
          final Map<int, Map<String, dynamic>> entrepotsMap = {};
          for (var ligne in lignes) {
            if (ligne['entrepot'] != null) {
              final id = ligne['entrepot']['id_entrepot'];
              if (id != null) {
                entrepotsMap[id] = Map<String, dynamic>.from(ligne['entrepot']);
              }
            }
          }
          _uniqueEntrepots = entrepotsMap.values.toList();

          if (_details!['type_source'] == 'entrepot' && _details!['id_entrepot'] != null) {
            _selectedEntrepotId = _details!['id_entrepot'];
          } else if (_uniqueEntrepots.length == 1) {
            _selectedEntrepotId = _uniqueEntrepots.first['id_entrepot'];
          }
        } else {
          _errorMessage = result['message'] ?? 'Erreur de chargement';
        }
        _isLoading = false;
      });
    }
  }

  String _formatDate(String? iso) {
    if (iso == null || iso.isEmpty) return '—';
    try {
      final dt = DateTime.parse(iso);
      return '${dt.day.toString().padLeft(2, '0')} - ${dt.month.toString().padLeft(2, '0')} - ${dt.year}';
    } catch (_) {
      return iso;
    }
  }

  Color _statusColor(String? statut) {
 switch (statut) {
  case 'en cours':
    return const Color(0xFF10B981); 
    
  case 'en attente':
    return const Color(0xFFF59E0B); 
    
  case 'cloture':
    return const Color(0xFFEF4444); 
    
  default:
    return Colors.grey;
}
  }

  String _typeLabel(Map<String, dynamic> item) {
    final type = item['type_source'] ?? '';
    if (type == 'tous') return 'Tous les articles';
    if (type == 'entrepot') {
      final name = item['entrepot']?['nom'] ?? '—';
      return 'Entrepôt ($name)';
    }
    if (type == 'article') {
      final count = (item['lignes'] as List?)?.length ?? 0;
      return 'Articles ($count)';
    }
    return type;
  }

  Future<void> _showWarehouseSelection() async {
    if (_uniqueEntrepots.length <= 1) {
      if (_uniqueEntrepots.length == 1) {
        _selectedEntrepotId = _uniqueEntrepots.first['id_entrepot'];
      }
      _handleStart();
      return;
    }

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Choisir l\'entrepôt', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.primary)),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: _uniqueEntrepots.length,
            itemBuilder: (context, index) {
              final entrepot = _uniqueEntrepots[index];
              return ListTile(
                leading: const Icon(Icons.warehouse_outlined, color: AppColors.primary),
                title: Text(entrepot['nom'] ?? 'Entrepôt', style: const TextStyle(fontSize: 13)),
                onTap: () {
                  _selectedEntrepotId = entrepot['id_entrepot'];
                  Navigator.pop(ctx);
                  _handleStart();
                },
              );
            },
          ),
        ),
      ),
    );
  }

  Future<void> _handleStart() async {
    setState(() => _isStarting = true);
    
    try {
      // Étape 1: Démarrer l'inventaire sur le serveur
      final startResult = await _inventoryService.startInventaire(widget.inventoryId);
      if (mounted && startResult['success'] != true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(startResult['message'] ?? 'Erreur'), backgroundColor: Colors.red.shade400),
        );
        setState(() => _isStarting = false);
        return;
      }

      // Étape 2: Télécharger les articles essentiels localement
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Téléchargement des articles...'), backgroundColor: Colors.blue),
        );
      }

      final downloadResult = await _inventoryService.downloadArticles(widget.inventoryId);
      if (downloadResult['success'] != true) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(downloadResult['message'] ?? 'Erreur de téléchargement'),
              backgroundColor: Colors.orange.shade600,
            ),
          );
        }
      }

      // Étape 3: Mettre à jour l'ID d'inventaire actif dans le provider
      if (mounted) {
        Provider.of<UserProvider>(context, listen: false).setActiveInventory(widget.inventoryId);
      }

      // Étape 4: Démarrer la synchronisation automatique
      _syncService.startAutoSync();

      // Étape 5: Rafraîchir les détails et naviguer vers ScanPage
      if (mounted) {
        await _fetchDetails();
        if (mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ScanPage(
                inventoryId: widget.inventoryId,
                inventoryData: _details,
                selectedEntrepotId: _selectedEntrepotId,
              ),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red.shade400),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isStarting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppColors.accent)));
    }

    if (_errorMessage != null) {
      return Scaffold(
        body: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [AppColors.backgroundStart, AppColors.backgroundEnd],
            ),
          ),
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.error_outline, size: 40, color: Colors.grey.shade400),
                const SizedBox(height: 10),
                Text(_errorMessage!, style: TextStyle(color: Colors.grey.shade600, fontSize: 11)),
                const SizedBox(height: 10),
                ElevatedButton(
                  onPressed: _fetchDetails,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.accent, 
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                  child: const Text('Réessayer', style: TextStyle(color: Colors.white, fontSize: 11)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_details == null) return const Scaffold(body: Center(child: Text('Erreur')));

    final statut = _details!['statut'] ?? 'en attente';
    final statusColor = _statusColor(statut);
    final lignes = (_details!['lignes'] as List?) ?? [];
    
    // Group and sort unique articles by barcode
    final Map<String, Map<String, dynamic>> uniqueArticlesMap = {};
    for (var ligne in lignes) {
      final article = ligne['article'];
      if (article != null) {
        final barcode = article['code_barres'] ?? '';
        if (barcode.isNotEmpty && !uniqueArticlesMap.containsKey(barcode)) {
          uniqueArticlesMap[barcode] = Map<String, dynamic>.from(article);
        }
      }
    }
    final uniqueArticlesList = uniqueArticlesMap.values.toList();
    uniqueArticlesList.sort((a, b) {
      final barcodeA = (a['code_barres'] ?? '').toString();
      final barcodeB = (b['code_barres'] ?? '').toString();
      return barcodeA.compareTo(barcodeB);
    });

    final affectations = (_details!['affectations'] as List?) ?? [];
    final remarque = _details!['remarque'] ?? '';

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: const CustomAppBar(
        title: 'Détails de l\'inventaire',
      ),
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.backgroundStart, AppColors.backgroundEnd],
          ),
        ),
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title with status dot
                    Row(
                      children: [
                        Container(
                          width: 10, height: 10,
                          margin: const EdgeInsets.only(right: 8),
                          decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle),
                        ),
                        Expanded(
                          child: Text(
                            _details!['titre'] ?? '(sans titre)',
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.accent),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),

                    // Info rows
                    _detailRow(Icons.calendar_today_outlined, 'Date de début', _formatDate(_details!['date_debut'])),
                    _detailRow(Icons.calendar_month_outlined, 'Date limite', _formatDate(_details!['date_fin'])),
                    _detailRow(Icons.category_outlined, 'Type source', _typeLabel(_details!)),
                    if (_details!['type_source'] == 'entrepot' && _details!['entrepot'] != null)
                      _detailRow(Icons.warehouse_outlined, 'Entrepôt', _details!['entrepot']['nom'] ?? '—'),
                    _detailRow(Icons.location_on_outlined, 'Site', _details!['site'] ?? '—'),
  Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.shade300),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Positioned(
                            top: -22,
                            left: 8,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4),
                              child: const Text('Remarque', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 11)),
                            ),
                          ),
                          Text(
                            remarque.isNotEmpty ? remarque : 'Aucune remarque',
                            style: TextStyle(color: remarque.isNotEmpty ? Colors.grey.shade700 : Colors.grey.shade400, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    // Agents section - expandable list
                    if (affectations.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        child: Theme(
                          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                          child: ExpansionTile(
                            tilePadding: EdgeInsets.zero,
                            leading: Icon(
                              Icons.people_alt_outlined,
                              size: 18,
                              color: AppColors.primary,
                            ),
                            title: const Text(
                              'Agents assignés',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
                                fontSize: 10,
                              ),
                            ),
                             trailing: Icon(
                              Icons.keyboard_arrow_down_rounded,
                              color: AppColors.primary,
                              size: 18,
                            ),
                            children: [
                              const SizedBox(height: 8),
                              ChangeNotifierProvider.value(
                                value: _agentsProvider,
                                child: Consumer<AgentsProvider>(
                                  builder: (context, provider, child) {
                                    final currentAgents = provider.agents;
                                    if (currentAgents.isEmpty) return const SizedBox.shrink();
                                    
                                    return ListView.builder(
                                      shrinkWrap: true,
                                      physics: const NeverScrollableScrollPhysics(),
                                      itemCount: currentAgents.length,
                                      itemBuilder: (context, index) {
                                        final aff = currentAgents[index];
                                        final agent = aff['agent'];
                                        if (agent == null) return const SizedBox.shrink();
                                        
                                        final agentId = agent['id'] ?? index;
                                        final nom = agent['nom'] ?? '';
                                        final prenom = agent['prenom'] ?? '';
                                        final initials = '${nom.isNotEmpty ? nom[0] : ''}${prenom.isNotEmpty ? prenom[0] : ''}'.toUpperCase();
                                        final participationStatus = aff['statut_participation'] ?? 'inactif';
                                        final isActif = participationStatus == 'actif';

                                        return Container(
                                          key: ValueKey(agentId),
                                          margin: const EdgeInsets.only(bottom: 8),
                                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                          decoration: BoxDecoration(
                                            color: Colors.white,
                                            borderRadius: BorderRadius.circular(12),
                                            border: Border.all(color: Colors.grey.shade100),
                                            boxShadow: [
                                              BoxShadow(
                                                color: Colors.black.withOpacity(0.02),
                                                blurRadius: 4,
                                                offset: const Offset(0, 2),
                                              ),
                                            ],
                                          ),
                                          child: Row(
                                            children: [
                                              CircleAvatar(
                                                radius: 15,
                                                backgroundColor: AppColors.primary.withOpacity(0.1),
                                                backgroundImage: (agent['avatar'] != null && agent['avatar'].toString().isNotEmpty)
                                                    ? NetworkImage('${ApiConstants.serverUrl}${agent['avatar']}')
                                                    : null,
                                                child: (agent['avatar'] == null || agent['avatar'].toString().isEmpty)
                                                    ? Text(
                                                        initials,
                                                        style: const TextStyle(
                                                          color: AppColors.primary,
                                                          fontSize: 10,
                                                          fontWeight: FontWeight.bold,
                                                        ),
                                                      )
                                                    : null,
                                              ),
                                              const SizedBox(width: 12),
                                              Expanded(
                                                child: Text(
                                                  '$nom $prenom',
                                                  style: const TextStyle(
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.w500,
                                                    color: Color(0xFF2D3748),
                                                  ),
                                                ),
                                              ),
                                              Container(
                                                width: 8,
                                                height: 8,
                                                decoration: BoxDecoration(
                                                  color: isActif ? const Color(0xFF10B981) : Colors.red,
                                                  shape: BoxShape.circle,
                                                  boxShadow: isActif
                                                      ? [
                                                          BoxShadow(
                                                            color: const Color(0xFF10B981).withOpacity(0.3),
                                                            blurRadius: 4,
                                                            spreadRadius: 1,
                                                          )
                                                        ]
                                                      : null,
                                                ),
                                              ),
                                            ],
                                          ),
                                        );
                                      },
                                    );
                                  },
                                ),
                              ),
                              const SizedBox(height: 2),
                            ],
                          ),
                        ),
                      ),
                    ],
                    
                    // Articles count - clickable to expand
                    if (uniqueArticlesList.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        child: Theme(
                          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                          child: ExpansionTile(
                            tilePadding: EdgeInsets.zero,
                            leading: const Icon(
                              Icons.inventory_2_outlined,
                              size: 18,
                              color: AppColors.primary,
                            ),
                            title: Text(
                              '${uniqueArticlesList.length} article(s)',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
                                fontSize: 10,
                              ),
                            ),
                            trailing: Icon(
                              Icons.keyboard_arrow_down_rounded,
                              color: AppColors.primary,
                              size: 18,
                            ),
                            children: [
                              const SizedBox(height: 4),
                              ...uniqueArticlesList.map<Widget>((article) {
                                final articleName = article['nom'] ?? 'Article #${article['id_article']}';
                                final reference = article['code_barres'] ?? '';

                                return Container(
                                  width: double.infinity,
                                  margin: const EdgeInsets.only(bottom: 6),
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade50, 
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: Colors.grey.shade100),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.circle, size: 4, color: AppColors.primary),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: RichText(
                                          text: TextSpan(
                                            style: const TextStyle(fontSize: 11, color: Color(0xFF2D3748)),
                                            children: [
                                              if (reference.isNotEmpty)
                                                TextSpan(
                                                  text: '$reference : ',
                                                  style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.accent),
                                                ),
                                              TextSpan(
                                                text: articleName,
                                                style: const TextStyle(fontWeight: FontWeight.w500),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              }).toList(),
                              const SizedBox(height: 8),
                            ],
                          ),
                        ),
                      ),
                    ],

                    const SizedBox(height: 2),
                  if (widget.showActionButton && (_details!['type_source'] == 'tous' || _details!['type_source'] == 'article')) ...[
                      const SizedBox(height: 18),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border.all(color: Colors.grey.shade300),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<int>(
                            value: _selectedEntrepotId,
                            hint: const Text('Choisir l\'entrepôt pour commencer', style: TextStyle(fontSize: 10, color:AppColors.primary )),
                            isExpanded: true,
                            icon: const Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.primary ,size: 18,),
                            items: _uniqueEntrepots.map<DropdownMenuItem<int>>((entrepot) {
                              return DropdownMenuItem<int>(
                                value: entrepot['id_entrepot'],
                                child: Text(entrepot['nom'] ?? 'Entrepôt', style: const TextStyle(fontSize: 12, color: Colors.black87)),
                              );
                            }).toList(),
                            onChanged: (value) {
                              setState(() {
                                _selectedEntrepotId = value;
                              });
                            },
                          ),
                        ),
                      ),
                  ]
                  ],
                ),
              ),
            ),
            
            
            // Bottom Action Button
            Builder(
              builder: (context) {
                final now = DateTime.now();
                final today = DateTime(now.year, now.month, now.day);
                
                DateTime startDate = today;
                DateTime endDate = today;
                
                try {
                  final dtStart = DateTime.parse(_details!['date_debut']);
                  startDate = DateTime(dtStart.year, dtStart.month, dtStart.day);
                  
                  final dtEnd = DateTime.parse(_details!['date_fin']);
                  endDate = DateTime(dtEnd.year, dtEnd.month, dtEnd.day);
                } catch (_) {}
                
                final diffDaysStart = startDate.difference(today).inDays;
                final diffDaysEnd = endDate.difference(today).inDays;
                final diffHoursEnd = endDate.difference(now).inHours;
                
                final isFuture = diffDaysStart > 0;
                final isExpired = diffHoursEnd < 0;
                final isTerminated = statut == 'cloture';
                
                final bool isWarehouseRequired = _details!['type_source'] == 'tous' || _details!['type_source'] == 'article';
                final bool hasSelectedWarehouse = _selectedEntrepotId != null || !isWarehouseRequired;
                final bool canStart = !isFuture && !isTerminated && !isExpired && hasSelectedWarehouse;

                String daysInfo = '';
                if (isFuture) {
                  daysInfo = 'Ouvert dans $diffDaysStart jour${diffDaysStart > 1 ? 's' : ''}';
                } else if (isExpired) {
                  daysInfo = 'Date de fin dépassée';
                } else if (isTerminated) {
                  daysInfo = 'Inventaire cloturé';
                } else {
                  if (diffHoursEnd < 24) {
                    daysInfo = 'Il reste $diffHoursEnd heure${diffHoursEnd > 1 ? 's' : ''}';
                  } else {
                    daysInfo = 'Il reste $diffDaysEnd jour${diffDaysEnd > 1 ? 's' : ''}';
                  }
                }

                if (!widget.showActionButton) return const SizedBox.shrink();

                return Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            flex: 1,
                            child: Stack(
                              clipBehavior: Clip.none,
                              children: [
                                OutlinedButton(
                                  onPressed: () {
                                    setState(() => _hasUnreadNotes = false);
                                    Navigator.push(context, MaterialPageRoute(builder: (context) => NotesListPage(
                                      inventoryId: widget.inventoryId,
                                      inventoryTitle: _details?['titre'] ?? 'Inventaire',
                                    )));
                                  },
                                  style: OutlinedButton.styleFrom(
                                    side: const BorderSide(color: AppColors.primary, width: 1.2),
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  ),
                                  child: const Center(child: Text('NOTES', style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.bold))),
                                ),
                                if (_hasUnreadNotes)
                                  Positioned(
                                    top: -4,
                                    right: -4,
                                    child: Container(
                                      padding: const EdgeInsets.all(4),
                                      decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                                      child: const Text('1', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            flex: 2,
                            child: ElevatedButton(
                              onPressed: (_isStarting || !canStart) ? null : _handleStart,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                disabledBackgroundColor: Colors.grey.shade300,
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                elevation: canStart ? 2 : 0,
                              ),
                              child: _isStarting
                                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                  : Text(
                                      statut == 'en cours' ? 'CONTINUER' : 'DEMARRER', 
                                      style: TextStyle(
                                        color: canStart ? Colors.white : Colors.grey.shade500, 
                                        fontSize: 13, 
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 1.1,
                                      )
                                    ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        daysInfo,
                        style: TextStyle(color: Colors.grey.shade500, fontSize: 11, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _detailRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.primary, size: 16),
          const SizedBox(width: 8),
          Text('$label : ', style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 12)),
          Expanded(child: Text(value, style: const TextStyle(color: Colors.black87, fontSize: 12))),
        ],
      ),
    );
  }
}
