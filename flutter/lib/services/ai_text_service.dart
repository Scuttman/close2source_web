import 'dart:convert';
import 'package:http/http.dart' as http;

class AITextService {
  // Store your API key securely - consider using flutter_dotenv or similar
  // API key must be set via environment/config - do not hardcode
  static const String _apiKey =
      String.fromEnvironment('OPENAI_API_KEY', defaultValue: '');
  static const String _baseUrl = 'https://api.openai.com/v1/chat/completions';

  /// Improves the given text using ChatGPT
  /// Returns the improved text or null if there's an error
  static Future<String?> improveText(String originalText,
      {String? context}) async {
    if (originalText.trim().isEmpty) {
      return null;
    }

    try {
      final prompt = context != null
          ? 'Improve the following text for $context. Keep the same meaning and tone, but make it clearer, more professional, and fix any grammar or spelling issues:\n\n$originalText'
          : 'Improve the following text. Keep the same meaning and tone, but make it clearer, more professional, and fix any grammar or spelling issues:\n\n$originalText';

      final response = await http.post(
        Uri.parse(_baseUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_apiKey',
        },
        body: jsonEncode({
          'model': 'gpt-4o-mini',
          'messages': [
            {
              'role': 'system',
              'content':
                  'You are a helpful writing assistant that improves text while preserving the author\'s voice and intent. Return only the improved text without explanations or additional commentary.',
            },
            {
              'role': 'user',
              'content': prompt,
            },
          ],
          'temperature': 0.7,
          'max_tokens': 1000,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final improvedText = data['choices'][0]['message']['content'] as String;
        return improvedText.trim();
      } else {
        print(
            'AI Text Service Error: ${response.statusCode} - ${response.body}');
        return null;
      }
    } catch (e) {
      print('AI Text Service Exception: $e');
      return null;
    }
  }

  /// Makes the text shorter while preserving key information
  static Future<String?> makeTextShorter(String originalText) async {
    if (originalText.trim().isEmpty) {
      return null;
    }

    try {
      final response = await http.post(
        Uri.parse(_baseUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_apiKey',
        },
        body: jsonEncode({
          'model': 'gpt-4o-mini',
          'messages': [
            {
              'role': 'system',
              'content':
                  'You are a helpful writing assistant. Make the text more concise while preserving all key information. Return only the shortened text.',
            },
            {
              'role': 'user',
              'content':
                  'Make this text shorter and more concise:\n\n$originalText',
            },
          ],
          'temperature': 0.7,
          'max_tokens': 1000,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return (data['choices'][0]['message']['content'] as String).trim();
      }
      return null;
    } catch (e) {
      print('AI Text Service Exception: $e');
      return null;
    }
  }

  /// Makes the text longer with more detail
  static Future<String?> makeTextLonger(String originalText) async {
    if (originalText.trim().isEmpty) {
      return null;
    }

    try {
      final response = await http.post(
        Uri.parse(_baseUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_apiKey',
        },
        body: jsonEncode({
          'model': 'gpt-4o-mini',
          'messages': [
            {
              'role': 'system',
              'content':
                  'You are a helpful writing assistant. Expand the text with more detail and explanation while staying on topic. Return only the expanded text.',
            },
            {
              'role': 'user',
              'content': 'Expand this text with more detail:\n\n$originalText',
            },
          ],
          'temperature': 0.7,
          'max_tokens': 1500,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return (data['choices'][0]['message']['content'] as String).trim();
      }
      return null;
    } catch (e) {
      print('AI Text Service Exception: $e');
      return null;
    }
  }
}
