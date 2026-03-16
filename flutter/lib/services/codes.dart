import 'dart:math';

/// Generates a short, human-friendly code for entities like projects.
/// Example: P-7G9K4RX (prefix optional in callers)
String generateCode({int length = 7}) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  final rand = Random.secure();
  return List.generate(length, (_) => chars[rand.nextInt(chars.length)]).join();
}

/// Convenience wrapper for project codes (matches web intent: generateCode('project'))
String generateProjectCode() {
  return 'P-${generateCode(length: 7)}';
}
