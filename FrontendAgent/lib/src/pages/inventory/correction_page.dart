import 'package:flutter/material.dart';
import '../../constants/app_colors.dart';
import '../../services/inventory_service.dart';
import '../../widgets/custom_app_bar.dart';

class CorrectionPage extends StatefulWidget {
  final int inventoryId;
  final int? selectedEntrepotId;
  const CorrectionPage({super.key, required this.inventoryId, this.selectedEntrepotId});

  @override
  State<CorrectionPage> createState() => _CorrectionPageState();
}

class _CorrectionPageState extends State<CorrectionPage> {
  final InventoryService _inventoryService = InventoryService();
  final TextEditingController _remarkController = TextEditingController();
  final TextEditingController _barcodeController = TextEditingController();

  bool _isLoading = true;
  bool _isSubmitting = false;
  int _quantity = 0;
  String? _errorMessage;

  Map<String, dynamic>? _inventoryDetails;
  List<Map<String, dynamic>> _lines = [];
  List<Map<String, dynamic>> _allLines = [];
  Map<String, dynamic>? _selectedLine;
  String _entrepotName = '—';
  String? _barcodeErrorMessage;

  @override
  void initState() {
    super.initState();
    _fetchInventoryDetails();
  }

  @override
  void dispose() {
    _remarkController.dispose();
    _barcodeController.dispose();
    super.dispose();
  }

  Future<void> _fetchInventoryDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final result = await _inventoryService.getInventoryDetails(widget.inventoryId);
    if (!mounted) return;

    setState(() {
      if (result['success'] == true) {
        _inventoryDetails = result['data'];
        final lignes = (_inventoryDetails?['lignes'] as List?) ?? [];
        _allLines = lignes.map((item) => Map<String, dynamic>.from(item as Map<String, dynamic>)).toList();
        
        // Filter lines by selected warehouse if applicable
        if (widget.selectedEntrepotId != null) {
           _lines = _allLines.where((line) => line['id_entrepot'] == widget.selectedEntrepotId || line['entrepot']?['id_entrepot'] == widget.selectedEntrepotId).toList();
        } else {
           _lines = _allLines.toList();
        }
        
        // Determine the warehouse name to display
        if (_lines.isNotEmpty && _lines.first['entrepot']?['nom'] != null) {
          _entrepotName = _lines.first['entrepot']?['nom'];
        } else if (_inventoryDetails?['entrepot']?['nom'] != null) {
          _entrepotName = _inventoryDetails?['entrepot']?['nom'];
        } else {
          _entrepotName = 'Entrepôt sélectionné'; // Fallback
        }
      } else {
        _errorMessage = result['message'] ?? 'Erreur lors du chargement des détails';
      }
      _isLoading = false;
    });
  }

  void _onBarcodeChanged(String code) {
    final trimmedCode = code.trim();
    if (trimmedCode.isEmpty) {
      setState(() {
        _selectedLine = null;
        _quantity = 0;
        _barcodeErrorMessage = null;
      });
      return;
    }

    final foundLine = _lines.firstWhere(
      (line) => line['article']?['code_barres']?.toString().toLowerCase() == trimmedCode.toLowerCase(),
      orElse: () => {},
    );

    if (foundLine.isNotEmpty) {
      setState(() {
        _selectedLine = foundLine;
        _quantity = 0;
        _barcodeErrorMessage = null;
      });
      return;
    }

    // Not found in this warehouse, check if it exists in another warehouse
    final foundInOther = _allLines.firstWhere(
      (line) => line['article']?['code_barres']?.toString().toLowerCase() == trimmedCode.toLowerCase(),
      orElse: () => {},
    );

    setState(() {
      _selectedLine = null;
      _quantity = 0;
      if (foundInOther.isNotEmpty) {
        _barcodeErrorMessage = 'Cet article existe, mais n\'est pas dans l\'entrepôt sélectionné ($_entrepotName).';
      } else {
        _barcodeErrorMessage = 'Aucun article trouvé avec ce code-barres dans cet inventaire.';
      }
    });
  }



  void _increment() {
    if (_selectedLine == null) return;
    
    num rawComptee = _selectedLine!['quantite_comptee'] ?? 0;
    int maxAllowed = rawComptee.toInt();
    
    if (_quantity < maxAllowed) {
      setState(() => _quantity++);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Vous ne pouvez pas diminuer plus que la quantité comptée ($maxAllowed).'),
          duration: const Duration(seconds: 2),
          backgroundColor: Colors.red.shade400,
        ),
      );
    }
  }

  void _decrement() {
    if (_quantity > 0) setState(() => _quantity--);
  }

  Future<void> _submitCorrection() async {
    if (_selectedLine == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez spécifier un article valide via un code-barres.')),
      );
      return;
    }

    if (_quantity <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez indiquer une quantité à diminuer.')),
      );
      return;
    }
    
    num rawComptee = _selectedLine!['quantite_comptee'] ?? 0;
    int maxAllowed = rawComptee.toInt();
    
    if (_quantity > maxAllowed) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('La quantité ne peut pas dépasser la quantité comptée ($maxAllowed).'),
          backgroundColor: Colors.red.shade400,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    final result = await _inventoryService.submitCorrection(
      ligneInventaireId: _selectedLine!['id_ligne'],
      quantity: _quantity,
      remark: _remarkController.text.trim(),
      articleCode: _selectedLine?['article']?['code_barres'],
      entrepotId: _selectedLine?['id_entrepot'],
    );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(result['message'] ?? 'Erreur lors de l\'envoi')),
    );

    if (result['success'] == true) {
      Navigator.pop(context);
    }
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
          const SizedBox(width: 8),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold))),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: const CustomAppBar(
        title: 'Demande de correction',
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
        child: SafeArea(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : _errorMessage != null
                  ? Center(child: Text(_errorMessage!, style: const TextStyle(color: Colors.red)))
                  : Column(
                      children: [
                        Expanded(
                          child: SingleChildScrollView(
                            physics: const BouncingScrollPhysics(),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const SizedBox(height: 10),
                                  if (_inventoryDetails != null) ...[
                                    _infoRow('Inventaire :', _inventoryDetails?['titre'] ?? '—'),
                                    _infoRow('Site :', _inventoryDetails?['site'] ?? '—'),
                                    _infoRow('Entrepôt :', _entrepotName), 
                                    const SizedBox(height: 12),
                                  ],
                                  const Text('Saisir ou scanner le code-barres', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                                  const SizedBox(height: 10),
                                  
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Container(
                                          decoration: BoxDecoration(
                                            color: Colors.white,
                                            borderRadius: BorderRadius.circular(12),
                                            border: Border.all(color: Colors.grey.shade300),
                                          ),
                                          child: TextField(
                                            controller: _barcodeController,
                                            onChanged: _onBarcodeChanged,
                                            style: const TextStyle(fontSize: 14),
                                            decoration: const InputDecoration(
                                              contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                              border: InputBorder.none,
                                              hintText: 'Entrez le code-barres...',
                                              hintStyle: TextStyle(fontSize: 13),
                                            ),
                                          ),
                                        ),
                                      ),
                                     
                                    ],
                                  ),
                                  const SizedBox(height: 20),
                                  
                                  if (_barcodeErrorMessage != null && _selectedLine == null)
                                    Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 4),
                                      child: Text(
                                        _barcodeErrorMessage!,
                                        style: const TextStyle(color: Colors.red, fontSize: 13, fontWeight: FontWeight.w500),
                                      ),
                                    ),

                                  if (_selectedLine != null) ...[
                                    Container(
                                      width: double.infinity,
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(alpha: 0.7),
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: Colors.grey.shade200),
                                      ),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text('Détails du produit', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.accent)),
                                          const SizedBox(height: 16),
                                          _infoRow('Article :', _selectedLine?['article']?['nom'] ?? '—'),
                                          _infoRow('Code :', _selectedLine?['article']?['code_barres'] ?? '—'),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(height: 14),
                                    Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: Colors.grey.shade200),
                                      ),
                                      child: Row(
                                        children: [
                                          const Icon(Icons.remove_circle_outline_rounded, size: 20, color: Colors.red),
                                          const SizedBox(width: 12),
                                          const Expanded(child: Text('Quantité à diminuer', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500))),
                                          _quantityControl(),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(height: 20),
                                    TextFormField(
                                      controller: _remarkController,
                                      maxLines: 4,
                                      style: const TextStyle(fontSize: 13),
                                      decoration: InputDecoration(
                                        labelText: 'Remarque',
                                        hintText: 'Expliquez pourquoi la quantité doit être ajustée...',
                                        labelStyle: const TextStyle(color: AppColors.primary, fontSize: 13),
                                        hintStyle: TextStyle(fontSize: 12, color: Colors.grey.shade400),
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(8),
                                          borderSide: BorderSide(color: Colors.grey.shade300),
                                        ),
                                        enabledBorder: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(8),
                                          borderSide: BorderSide(color: Colors.grey.shade300),
                                        ),
                                        focusedBorder: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(8),
                                          borderSide: const BorderSide(color: AppColors.primary),
                                        ),
                                        contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(20.0),
                          child: SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: _isSubmitting ? null : _submitCorrection,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                elevation: 2,
                              ),
                              child: _isSubmitting
                                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                  : const Text(
                                      'Envoyer la demande',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                      ),
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

  Widget _quantityControl() {
    return Row(
      children: [
        GestureDetector(
          onTap: _decrement,
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, border: Border.all(color: Colors.grey.shade300)),
            child: const Icon(Icons.remove, size: 16, color: AppColors.primary),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text('$_quantity', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.primary)),
        ),
        GestureDetector(
          onTap: _increment,
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
            child: const Icon(Icons.add, size: 16, color: Colors.white),
          ),
        ),
      ],
    );
  }
}

