import 'package:flutter/material.dart';

/// Central brand styling constants for the Close2Source mobile app.
class Branding {
  static const Color accent = Color(0xFFFF6A1A);
  static const Color scaffoldDark = Color(0xFF0B0B0C);
  static const Color scaffoldDarkHigh = Color(0xFF111113);
  static const LinearGradient backgroundGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF0B0B0C), Color(0xFF141417), Color(0xFF0B0B0C)],
  );

  static BoxDecoration brandedBackground({bool withGradient = true}) => BoxDecoration(
        gradient: withGradient ? backgroundGradient : null,
      );

  static ShapeBorder cardShape() => RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
  side: BorderSide(color: Colors.white.withValues(alpha: 0.08), width: 1),
      );
}