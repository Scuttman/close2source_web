import 'package:flutter/material.dart';
import '../services/ai_text_service.dart';

/// A TextField widget with an AI improvement button
class AITextField extends StatefulWidget {
  final TextEditingController controller;
  final String? labelText;
  final String? hintText;
  final int? maxLines;
  final int? minLines;
  final InputDecoration? decoration;
  final TextInputType? keyboardType;
  final String? aiContext; // Optional context for AI improvement
  final bool showAIButton; // Whether to show the AI button
  final Function(String)? onAIImproved; // Callback when text is improved

  const AITextField({
    super.key,
    required this.controller,
    this.labelText,
    this.hintText,
    this.maxLines = 1,
    this.minLines,
    this.decoration,
    this.keyboardType,
    this.aiContext,
    this.showAIButton = true,
    this.onAIImproved,
  });

  @override
  State<AITextField> createState() => _AITextFieldState();
}

class _AITextFieldState extends State<AITextField> {
  bool _isImproving = false;
  String _lastImprovedText = '';

  Future<void> _showAIMenu() async {
    final result = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'AI Text Assistant',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 20),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(Icons.auto_fix_high, color: Colors.blue[700]),
              ),
              title: const Text('Improve Text'),
              subtitle: const Text('Fix grammar, spelling, and clarity'),
              onTap: () => Navigator.pop(context, 'improve'),
            ),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.orange[50],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(Icons.compress, color: Colors.orange[700]),
              ),
              title: const Text('Make Shorter'),
              subtitle: const Text('More concise while keeping key points'),
              onTap: () => Navigator.pop(context, 'shorter'),
            ),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.green[50],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(Icons.expand, color: Colors.green[700]),
              ),
              title: const Text('Make Longer'),
              subtitle: const Text('Add more detail and explanation'),
              onTap: () => Navigator.pop(context, 'longer'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (result != null) {
      _improveText(result);
    }
  }

  Future<void> _improveText(String action) async {
    final currentText = widget.controller.text;
    if (currentText.trim().isEmpty) {
      _showSnackBar('Please enter some text first', isError: true);
      return;
    }

    setState(() {
      _isImproving = true;
      _lastImprovedText = currentText;
    });

    String? improvedText;
    switch (action) {
      case 'improve':
        improvedText = await AITextService.improveText(
          currentText,
          context: widget.aiContext,
        );
        break;
      case 'shorter':
        improvedText = await AITextService.makeTextShorter(currentText);
        break;
      case 'longer':
        improvedText = await AITextService.makeTextLonger(currentText);
        break;
    }

    setState(() {
      _isImproving = false;
    });

    if (improvedText != null && improvedText.isNotEmpty) {
      _showPreview(improvedText);
    } else {
      _showSnackBar('Failed to improve text. Please try again.', isError: true);
    }
  }

  void _showPreview(String improvedText) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.auto_awesome, color: Colors.blue),
            SizedBox(width: 8),
            Text('AI Suggestion'),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey[100],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey[300]!),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Original:',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _lastImprovedText,
                      style: TextStyle(
                        color: Colors.grey[700],
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.blue[200]!),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'AI Improved:',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: Colors.blue,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      improvedText,
                      style: const TextStyle(fontSize: 14),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton.icon(
            onPressed: () {
              widget.controller.text = improvedText;
              widget.onAIImproved?.call(improvedText);
              Navigator.pop(context);
              _showSnackBar('Text updated!');
            },
            icon: const Icon(Icons.check),
            label: const Text('Use This'),
          ),
        ],
      ),
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red : Colors.green,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: widget.controller,
      maxLines: widget.maxLines,
      minLines: widget.minLines,
      keyboardType: widget.keyboardType,
      decoration: (widget.decoration ??
              InputDecoration(
                  labelText: widget.labelText, hintText: widget.hintText))
          .copyWith(
        suffixIcon: widget.showAIButton && widget.controller.text.isNotEmpty
            ? Padding(
                padding: const EdgeInsets.only(right: 4),
                child: _isImproving
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : IconButton(
                        icon: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [Colors.purple[400]!, Colors.blue[400]!],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(
                            Icons.auto_awesome,
                            size: 18,
                            color: Colors.white,
                          ),
                        ),
                        onPressed: _isImproving ? null : _showAIMenu,
                        tooltip: 'Improve with AI',
                      ),
              )
            : widget.decoration?.suffixIcon,
      ),
    );
  }
}
