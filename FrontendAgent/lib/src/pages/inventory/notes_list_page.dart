import 'package:provider/provider.dart';
import '../../providers/user_provider.dart';
import '../../services/inventory_service.dart';
import '../../services/websocket_service.dart';
import '../../constants/app_colors.dart';
import 'package:flutter/material.dart';
import '../../widgets/custom_app_bar.dart';

class NotesListPage extends StatefulWidget {
  final int inventoryId;
  final String inventoryTitle;

  const NotesListPage({
    super.key,
    required this.inventoryId,
    this.inventoryTitle = 'Inventaire',
  });

  @override
  State<NotesListPage> createState() => _NotesListPageState();
}

class _NotesListPageState extends State<NotesListPage> {
  final InventoryService _inventoryService = InventoryService();
  final WebSocketService _wsService = WebSocketService();
  final TextEditingController _searchController = TextEditingController();

  List<dynamic> _notes = [];
  bool _isLoading = true;
  String _currentFilter = 'all';

  @override
  void initState() {
    super.initState();
    _fetchNotes();
    _setupWebSocket();
  }

  Future<void> _setupWebSocket() async {
    await _wsService.subscribeToInventaireChannel(
      widget.inventoryId,
      onNoteReceived: (_) => _fetchNotes(),
      onNoteUpdated: (_) => _fetchNotes(),
      onNoteDeleted: (_) => _fetchNotes(),
    );
  }

  Future<void> _fetchNotes() async {
    setState(() => _isLoading = true);

    final result = await _inventoryService.getNotes(
      widget.inventoryId,
      filter: _currentFilter,
      search: _searchController.text,
    );

    if (mounted) {
      setState(() {
        _notes = result['data'] ?? [];
        _isLoading = false;
      });

      for (var note in _notes) {
        if (note['lu'] == 0 || note['lu'] == false) {
          _inventoryService.markNoteAsRead(note['id_note']);
        }
      }
    }
  }

  String _formatDateTime(String? iso) {
    if (iso == null || iso.isEmpty) return '—';

    try {
      final dt = DateTime.parse(iso);

      return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }

  Future<void> _handleDelete(int noteId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text(
          'Supprimer la note ?',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
        content: const Text(
          'Cette action est irréversible.',
          style: TextStyle(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text(
              'ANNULER',
              style: TextStyle(color: Colors.red),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'SUPPRIMER',
              style: TextStyle(
                color: Colors.red,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final res = await _inventoryService.deleteNote(noteId);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'])),
        );

        if (res['success']) {
          _fetchNotes();
        }
      }
    }
  }

  Future<void> _handleEdit(dynamic note) async {
    final controller =
        TextEditingController(text: note['contenu']);

    final newContent = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text(
          'Modifier la note',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
        content: TextField(
          controller: controller,
          maxLines: 5,
          style: const TextStyle(fontSize: 13),
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
            hintText: 'Éditer le contenu...',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(
              'ANNULER',
              style: TextStyle(color: Colors.red),
            ),
          ),
          TextButton(
            onPressed: () =>
                Navigator.pop(ctx, controller.text),
            child: const Text(
              'ENREGISTRER',
              style: TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );

    if (newContent != null &&
        newContent.isNotEmpty &&
        newContent != note['contenu']) {
      final res = await _inventoryService.updateNote(
        noteId: note['id_note'],
        content: newContent,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'])),
        );

        if (res['success']) {
          _fetchNotes();
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentUser =
        Provider.of<UserProvider>(context).user;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: CustomAppBar(
        title: 'Notes de ${widget.inventoryTitle}',
        
      ),
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppColors.backgroundStart,
              AppColors.backgroundEnd,
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                      ),
                      decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(30), 
                border: Border.all(color: AppColors.darkBlueBorder, width: 1.2), // Dark blue border
              ),
                      child: TextField(
                        controller: _searchController,
                        onChanged: (_) => _fetchNotes(),
                        style:
                            const TextStyle(fontSize: 12),
                        decoration: InputDecoration(
                          hintText: 'Rechercher une note...',
                          hintStyle: const TextStyle(fontSize: 12),
                          icon: const Icon(Icons.search, color: Colors.grey, size: 18),
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),

                    Row(
                  
                      children: [
                        _filterChip('Tous', 'all'),
                     
                        const SizedBox(width: 10),
                   
                         _filterChip( 'Admin', 'admin'),
                       
                        const SizedBox(width: 10),
                      
                          _filterChip('Mes notes', 'mine'),
                        
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              Expanded(
                child: _isLoading
                    ? const Center(
                        child:
                            CircularProgressIndicator(
                          color: AppColors.accent,
                        ),
                      )
                    : _notes.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment:
                                  MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.note_alt_outlined,
                                  size: 64,
                                  color:
                                      Colors.grey.shade300,
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  'Aucune note trouvée',
                                  style: TextStyle(
                                    color: Colors
                                        .grey.shade500,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding:
                                const EdgeInsets.all(16),
                            physics:
                                const BouncingScrollPhysics(),
                            itemCount: _notes.length,
                            itemBuilder:
                                (context, index) =>
                                    _noteCard(
                              _notes[index],
                              currentUser,
                            ),
                          ),
              ),

              Padding(
                padding: const EdgeInsets.all(20),
                child: SizedBox(
                  width: double.infinity,
                 child: ElevatedButton.icon(
                onPressed: () async {
                  final controller = TextEditingController();

                  final content = await showDialog<String>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text(
                        'Nouvelle note',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      content: TextField(
                        controller: controller,
                        maxLines: 5,
                        decoration: const InputDecoration(
                          hintText: 'Écrire une note...',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text(
                            'ANNULER',
                            style: TextStyle(color: Colors.red),
                          ),
                        ),
                        TextButton(
                          onPressed: () =>
                              Navigator.pop(ctx, controller.text),
                          child: const Text(
                            'AJOUTER',
                            style: TextStyle(
                              color: AppColors.primary,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );

                  if (content != null &&
                      content.trim().isNotEmpty) {
                    final res = await _inventoryService.addNote(
                      inventoryId: widget.inventoryId,
                      content: content.trim(),
                    );

                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(res['message'])),
                      );

                      if (res['success']) {
                        _fetchNotes();
                      }
                    }
                  }
                },

                label: const Text(
                  'nouvelle note',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                ),

                  style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                       elevation: 2,
                ),
              ),
                ), 
              ), 
            ],
          ),
        ),
      ),
    );
  }

 Widget _filterChip(String label, String value) {
    final isActive = _currentFilter == value;
    return GestureDetector(
      onTap: () {
        setState(() => _currentFilter = value);
        _fetchNotes();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isActive ? AppColors.accent : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: isActive ? AppColors.accent : AppColors.primary, width: 1.2),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isActive ? Colors.white : Colors.grey,
            fontWeight: FontWeight.w600,
            fontSize: 11,
          ),
        ),
      ),
    );
  }

  Widget _noteCard(
    dynamic note,
    Map<String, dynamic>? currentUser,
  ) {
    final user = note['user'] ?? {};

    final userName =
        '${user['nom'] ?? ''} ${user['prenom'] ?? ''}'
            .trim();

    final isNew =
        note['lu'] == 0 || note['lu'] == false;

    final isMine = currentUser != null &&
        note['id_user'] == currentUser['id'];

    final isAdmin = user['role'] == 'admin';

    return Align(
      alignment: isMine
          ? Alignment.centerRight
          : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
          maxWidth:
              MediaQuery.of(context).size.width * 0.85,
        ),
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(12),
            topRight: const Radius.circular(12),
            bottomLeft:
                Radius.circular(isMine ? 12 : 0),
            bottomRight:
                Radius.circular(isMine ? 0 : 12),
          ),
          border: Border.all(
            color: isAdmin
                ? AppColors.accent
                : AppColors.primary,
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color:
                  Colors.black.withOpacity(0.03),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment:
              CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  16, 12, 16, 8),
              child: Row(
                mainAxisAlignment:
                    MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                    

                      Row(
                       
                        children: [
                          Text(
                            userName,
                            style: TextStyle(
                              fontWeight:
                                  FontWeight.bold,
                              fontSize: 13,
                              color:AppColors
                                      .primary,
                            ),
                          ),

                         if (isAdmin)
  Container(
    margin: const EdgeInsets.only(left: 6),
    padding: const EdgeInsets.symmetric(
      horizontal: 8,
      vertical: 2,
    ),
    decoration: BoxDecoration(
      color: AppColors.accent,
      borderRadius: BorderRadius.circular(50),
    ),
    child: const Text(
      'Admin',
      style: TextStyle(
        fontSize: 8,
        color: Colors.white,
        fontWeight: FontWeight.bold,
      ),
    ),
  ),
                        ],
                      ),
                    ],
                  ),

                  if (isMine)
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(
                            Icons.edit_outlined,
                            size: 16,
                            color: Colors.blue,
                          ),
                          
                          onPressed: () =>
                              _handleEdit(note),
                          constraints:
                              const BoxConstraints(),
                          padding:
                              const EdgeInsets.all(1),
                        ),

                        IconButton(
                          icon: const Icon(
                            Icons
                                .delete_outline_rounded,
                            size: 16,
                            color: Colors.red,
                          ),
                          onPressed: () =>
                              _handleDelete(
                                  note['id_note']),
                          constraints:
                              const BoxConstraints(),
                          padding:
                              const EdgeInsets.all(1),
                        ),
                      ],
                    )
                  
                ],
              ),
            ),

            const Divider(height: 1),

            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                note['contenu'] ?? '',
                style: const TextStyle(
                  fontSize: 13,
                  height: 1.4,
                  color: Color(0xFF2D3748),
                ),
              ),
            ),
            Padding(
  padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
  child: Align(
    alignment: Alignment.centerRight,
    child: Text(
      _formatDateTime(note['created_at']),
      style: TextStyle(
        fontSize: 10,
        color: Colors.grey.shade500,
      ),
    ),
  ),
),

            if (isNew && !isMine)
              Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(
                  vertical: 4,
                ),
                decoration: const BoxDecoration(
                  color: AppColors.accent,
                  borderRadius:
                      BorderRadius.vertical(
                    bottom: Radius.circular(10),
                  ),
                ),
                child: const Center(
                  child: Text(
                    'NOUVELLE',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 8,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}