import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/project_service.dart';
import '../services/organization_service.dart';

class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({super.key});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> with SingleTickerProviderStateMixin {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    formats: [BarcodeFormat.qrCode],
  );
  bool _handled = false;
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    _pulse.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture cap) async {
    if (_handled) return;
    final codes = cap.barcodes;
    if (codes.isEmpty) return;
    final raw = codes.first.rawValue;
    if (raw == null || raw.isEmpty) return;
    _handled = true;
    try {
      // We expect raw to be a code (e.g., P-XXXXXXX or O-XXXXXXX). If it's JSON, parse and extract `code`.
      String code = raw.trim();
      if (code.startsWith('{') && code.endsWith('}')) {
        try {
          final obj = jsonDecode(code);
          if (obj is Map && obj['code'] is String) {
            code = (obj['code'] as String).trim();
          }
        } catch (_) {}
      }
      await _linkByCode(code);
      if (!mounted) return;
      final isProject = code.toUpperCase().startsWith('P-');
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(isProject ? 'Project linked successfully' : 'Organization linked successfully')));
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to link: $e')));
      Navigator.of(context).pop(false);
    }
  }

  Future<void> _linkByCode(String code) async {
    final user = FirebaseAuth.instance.currentUser;
    String? indDbId;
    String? indCode;
    if (user != null) {
      try {
        final qs = await FirebaseFirestore.instance
            .collection('individuals')
            .where('ownerUid', isEqualTo: user.uid)
            .limit(1)
            .get();
        if (qs.docs.isNotEmpty) {
          final d = qs.docs.first;
          indDbId = d.id;
          indCode = (d.data()['individualId'] ?? d.id).toString();
        }
      } catch (_) {}
    }
    if (code.toUpperCase().startsWith('O-')) {
      await OrganizationService.instance.linkOrganizationByCode(code);
    } else {
      await ProjectService.instance.linkProjectToIndividualByCode(
        projectCode: code,
        individualDbId: indDbId,
        individualId: indCode,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
  title: const Text('Scan QR to link project/org'),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on),
            onPressed: () => _controller.toggleTorch(),
          ),
          IconButton(
            icon: const Icon(Icons.cameraswitch),
            onPressed: () => _controller.switchCamera(),
          ),
          IconButton(
            tooltip: 'Enter code manually',
            icon: const Icon(Icons.keyboard),
            onPressed: () async {
              final navigator = Navigator.of(context);
              final messenger = ScaffoldMessenger.of(context);
              final code = await showDialog<String>(
                context: context,
                builder: (ctx) {
                  final ctrl = TextEditingController();
                  return AlertDialog(
                    title: const Text('Link by code'),
                    content: TextField(
                      controller: ctrl,
                      textCapitalization: TextCapitalization.characters,
                      decoration: const InputDecoration(
                        labelText: 'Code (e.g., P-7G9K4RX or O-3H8K9ZA)'
                      ),
                    ),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                      FilledButton(onPressed: () => Navigator.pop(ctx, ctrl.text.trim().toUpperCase()), child: const Text('Link')),
                    ],
                  );
                },
              );
              if ((code == null) || code.isEmpty) return;
              try {
                await _linkByCode(code);
                final isProject = code.toUpperCase().startsWith('P-');
                messenger.showSnackBar(SnackBar(content: Text(isProject ? 'Project linked successfully' : 'Organization linked successfully')));
                navigator.pop(true);
              } catch (e) {
                messenger.showSnackBar(SnackBar(content: Text('Failed to link: $e')));
              }
            },
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),
          _AnimatedScannerOverlay(animation: _pulse),
          Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Text(
                'Align the QR code within the frame',
                style: TextStyle(color: Colors.white.withValues(alpha: 0.85)),
              ),
            ),
          )
        ],
      ),
    );
  }
}

class _AnimatedScannerOverlay extends StatelessWidget {
  final Animation<double> animation;
  const _AnimatedScannerOverlay({required this.animation});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        final box = Size(size.width * 0.7, size.width * 0.7);
        final top = (size.height - box.height) / 3;
        final left = (size.width - box.width) / 2;
        return Stack(children: [
          // dim background
          ColorFiltered(
            colorFilter: ColorFilter.mode(Colors.black.withValues(alpha: 0.5), BlendMode.srcOut),
            child: Stack(children: [
              Container(color: Colors.black.withValues(alpha: 0.5)),
              Positioned(
                top: top,
                left: left,
                width: box.width,
                height: box.height,
                child: Container(
                  decoration: const BoxDecoration(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.all(Radius.circular(16)),
                  ),
                ),
              ),
            ]),
          ),
          // animated line
          AnimatedBuilder(
            animation: animation,
            builder: (_, __) {
              final y = top + 8 + (box.height - 16) * animation.value;
              return Positioned(
                top: y,
                left: left + 8,
                right: left + 8,
                child: Container(height: 2, color: Colors.greenAccent),
              );
            },
          ),
          // frame border
          Positioned(
            top: top,
            left: left,
            width: box.width,
            height: box.height,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white70, width: 2),
              ),
            ),
          ),
        ]);
      },
    );
  }
}
