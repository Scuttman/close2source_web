import 'package:flutter/material.dart';
import '../../imports.dart';

class BackgroundScaffold extends StatelessWidget {
  final Widget child;
  final bool addOverlay;

  const BackgroundScaffold({
    super.key,
    required this.child,
    this.addOverlay = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        image: DecorationImage(
          image: AssetImage('assets/sitebg.jpg'),
          fit: BoxFit.cover,
        ),
      ),
      child: Container(
        // Transparent overlay instead of black
        decoration: BoxDecoration(
          color:
              addOverlay ? Colors.white.withOpacity(0.0) : Colors.transparent,
        ),
        child: SafeArea(child: child),
      ),
    );
  }
}
