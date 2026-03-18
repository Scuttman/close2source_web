# AI Text Assistant

An AI-powered text improvement feature using ChatGPT to help users write better content.

## Features

- **Improve Text**: Fixes grammar, spelling, and improves clarity
- **Make Shorter**: Creates concise versions while keeping key information
- **Make Longer**: Expands text with more detail and explanation
- **Preview Before Apply**: Shows original vs improved text side-by-side
- **Easy Integration**: Drop-in replacement for standard TextField widgets

## Quick Start

### 1. Replace TextField with AITextField

**Before:**
```dart
TextField(
  controller: _bioController,
  decoration: const InputDecoration(labelText: 'Bio'),
  maxLines: 4,
)
```

**After:**
```dart
AITextField(
  controller: _bioController,
  labelText: 'Bio',
  maxLines: 4,
  aiContext: 'a professional bio', // Optional: helps AI understand context
)
```

### 2. Import the Widget

```dart
import '../widgets/ai_text_field.dart';
```

### 3. Use It!

The AI icon automatically appears when the user types text. Click it to:
- Improve the text
- Make it shorter
- Make it longer

## Integration Examples

### Profile Bio Field

```dart
AITextField(
  controller: _bioController,
  labelText: 'Short bio',
  hintText: 'Tell us about yourself...',
  maxLines: 4,
  aiContext: 'a professional bio',
  onAIImproved: (improvedText) {
    print('Bio was improved!');
    // Optional: track usage or save
  },
)
```

### Project Description

```dart
AITextField(
  controller: _descriptionController,
  labelText: 'Project Description',
  maxLines: 6,
  aiContext: 'a project description for a fundraising platform',
)
```

### General Text Input

```dart
AITextField(
  controller: _controller,
  labelText: 'Enter text',
  maxLines: 1,
  showAIButton: true, // Default: true, set false to disable AI
)
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `controller` | `TextEditingController` | Required | Text controller |
| `labelText` | `String?` | `null` | Field label |
| `hintText` | `String?` | `null` | Placeholder text |
| `maxLines` | `int?` | `1` | Maximum lines |
| `minLines` | `int?` | `null` | Minimum lines |
| `decoration` | `InputDecoration?` | `null` | Custom decoration |
| `keyboardType` | `TextInputType?` | `null` | Keyboard type |
| `aiContext` | `String?` | `null` | Context for AI (e.g., "a bio", "a vision statement") |
| `showAIButton` | `bool` | `true` | Show/hide AI button |
| `onAIImproved` | `Function(String)?` | `null` | Callback when text is improved |

## Security Note

The API key is currently stored in the `ai_text_service.dart` file. For production:

1. **Use Environment Variables**: Store the key in `.env` file
2. **Use flutter_dotenv**: Load secrets securely
3. **Backend Proxy**: Call your own backend API that proxies to OpenAI

### Example with flutter_dotenv (Recommended)

1. Add to `pubspec.yaml`:
```yaml
dependencies:
  flutter_dotenv: ^5.1.0
```

2. Create `.env` file:
```
OPENAI_API_KEY=your-api-key-here
```

3. Update `ai_text_service.dart`:
```dart
import 'package:flutter_dotenv/flutter_dotenv.dart';

class AITextService {
  static String get _apiKey => dotenv.env['OPENAI_API_KEY'] ?? '';
  // ... rest of code
}
```

## How to Update Existing Screens

### Example: Profile Setup Screen

Find this in `profile_setup_screen.dart`:
```dart
TextField(
  controller: _bio,
  maxLines: 4,
  decoration: const InputDecoration(labelText: 'Short bio'),
),
```

Replace with:
```dart
AITextField(
  controller: _bio,
  labelText: 'Short bio',
  maxLines: 4,
  aiContext: 'a professional bio',
),
```

### Example: Organization Profile Screen

Find text fields for descriptions and replace with AITextField to enable AI improvements.

## Testing

Use the demo screen to test the feature:

```dart
import 'package:close2source_mobile/screens/examples/ai_text_demo_screen.dart';

// Navigate to demo
Navigator.push(
  context,
  MaterialPageRoute(builder: (context) => const AITextDemoScreen()),
);
```

## API Usage

The feature uses OpenAI's GPT-4o-mini model which is cost-effective:
- ~$0.15 per 1M input tokens
- ~$0.60 per 1M output tokens
- Average improvement uses ~200 tokens (< $0.001 per request)

## Customization

### Change AI Model

In `ai_text_service.dart`, change the model:
```dart
'model': 'gpt-4o', // More powerful, more expensive
'model': 'gpt-4o-mini', // Default: good balance
'model': 'gpt-3.5-turbo', // Cheaper, faster
```

### Customize Icon Style

In `ai_text_field.dart`, modify the gradient colors:
```dart
gradient: LinearGradient(
  colors: [Colors.purple[400]!, Colors.blue[400]!], // Change these
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
),
```

### Add More AI Actions

Add new methods to `AITextService`:
```dart
static Future<String?> fixGrammar(String text) async {
  // Custom implementation
}
```

Then add to the menu in `AITextField`:
```dart
ListTile(
  title: const Text('Fix Grammar Only'),
  onTap: () => Navigator.pop(context, 'grammar'),
),
```

## Troubleshooting

**AI button doesn't appear:**
- Make sure `showAIButton` is `true` (default)
- Type some text first (button only shows when field has content)

**"Failed to improve text" error:**
- Check API key is valid
- Check internet connection
- Check API quota/billing in OpenAI dashboard

**Text improvement is slow:**
- Normal for first request (cold start)
- Consider using gpt-3.5-turbo for faster responses
- Implement local caching for common improvements

## Future Enhancements

- [ ] Tone adjustment (formal, casual, friendly)
- [ ] Language translation
- [ ] Undo/redo improved text
- [ ] Save favorite improvements
- [ ] Offline mode with cached suggestions
- [ ] Custom prompts per field type
