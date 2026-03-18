import 'package:flutter/material.dart';
import '../../widgets/ai_text_field.dart';

/// Example screen demonstrating the AI-enhanced text field
class AITextDemoScreen extends StatefulWidget {
  const AITextDemoScreen({super.key});

  @override
  State<AITextDemoScreen> createState() => _AITextDemoScreenState();
}

class _AITextDemoScreenState extends State<AITextDemoScreen> {
  final _bioController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _visionController = TextEditingController();

  @override
  void dispose() {
    _bioController.dispose();
    _descriptionController.dispose();
    _visionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Text Assistant Demo'),
        backgroundColor: Colors.blue[700],
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'AI-Enhanced Text Fields',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Type some text and click the AI icon to improve it using ChatGPT.',
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 32),

            // Example 1: Bio
            const Text(
              'Your Bio',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            AITextField(
              controller: _bioController,
              labelText: 'Short bio',
              hintText: 'Tell us about yourself...',
              maxLines: 4,
              aiContext: 'a professional bio',
              onAIImproved: (text) {
                print('Bio improved: $text');
              },
            ),
            const SizedBox(height: 32),

            // Example 2: Project Description
            const Text(
              'Project Description',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            AITextField(
              controller: _descriptionController,
              labelText: 'Describe your project',
              hintText: 'What is your project about?',
              maxLines: 6,
              aiContext: 'a project description',
            ),
            const SizedBox(height: 32),

            // Example 3: Vision Statement
            const Text(
              'Vision Statement',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            AITextField(
              controller: _visionController,
              labelText: 'Your vision',
              hintText: 'What impact do you want to make?',
              maxLines: 5,
              aiContext: 'a vision statement',
            ),
            const SizedBox(height: 32),

            // Info card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.blue[50],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.blue[200]!),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.info_outline, color: Colors.blue[700]),
                      const SizedBox(width: 8),
                      const Text(
                        'How it works',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    '1. Type or paste your text into any field\n'
                    '2. Click the gradient AI icon that appears\n'
                    '3. Choose to improve, shorten, or lengthen\n'
                    '4. Review the AI suggestion and accept or cancel',
                    style: TextStyle(fontSize: 14),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
