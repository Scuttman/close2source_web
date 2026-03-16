import 'dart:io';
import 'package:flutter/material.dart';
import '../services/image_cache_service.dart';

class OrganizationCoverImage extends StatefulWidget {
  final String orgDocId;
  final String coverUrl;
  final double width;
  final double height;
  final BorderRadius? borderRadius;
  final Widget? fallback;
  final BoxFit fit;

  const OrganizationCoverImage({
    super.key,
    required this.orgDocId,
    required this.coverUrl,
    required this.width,
    required this.height,
    this.borderRadius,
    this.fallback,
    this.fit = BoxFit.cover,
  });

  @override
  State<OrganizationCoverImage> createState() => _OrganizationCoverImageState();
}

class _OrganizationCoverImageState extends State<OrganizationCoverImage> {
  String? _localPath;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _ensureLocal();
  }

  @override
  void didUpdateWidget(covariant OrganizationCoverImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.orgDocId != widget.orgDocId || oldWidget.coverUrl != widget.coverUrl) {
      _started = false;
      _localPath = null;
      _ensureLocal();
    }
  }

  Future<void> _ensureLocal() async {
    if (_started) return; _started = true;
    try {
      final p = ImageCacheService.I.getOrgLocalCoverSync(widget.orgDocId);
      if (p != null && mounted) { setState(() => _localPath = p); return; }
    } catch (_) {}
    if (widget.coverUrl.isNotEmpty) {
      try {
        final local = await ImageCacheService.I.getLocalForRemote(widget.coverUrl);
        if (local != null) {
          await ImageCacheService.I.setOrgLocalCover(widget.orgDocId, local);
          if (mounted) setState(() => _localPath = local);
        }
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    final radius = widget.borderRadius ?? BorderRadius.circular(8);
    return ClipRRect(
      borderRadius: radius,
      child: SizedBox(
        width: widget.width,
        height: widget.height,
        child: _buildChild(),
      ),
    );
  }

  Widget _buildChild() {
    if (_localPath != null) {
      final f = File(_localPath!);
      if (f.existsSync()) {
        return Image.file(f, fit: widget.fit);
      }
    }
    if (widget.coverUrl.isNotEmpty) {
      final url = _normalizeStorageUrl(widget.coverUrl);
      return Image.network(
        url,
        fit: widget.fit,
        errorBuilder: (_, __, ___) => widget.fallback ?? const SizedBox.shrink(),
      );
    }
    return widget.fallback ?? const SizedBox.shrink();
  }

  String _normalizeStorageUrl(String url) {
    var out = url;
    if (out.contains('firebasestorage.app')) {
      out = out.replaceFirst('firebasestorage.app', 'firebasestorage.googleapis.com');
    }
    if (out.contains('firebasestorage.googleapis.com')) {
      final idx = out.indexOf('/b/');
      if (idx != -1) {
        final start = idx + 3;
        final end = out.indexOf('/o/', start);
        if (end != -1) {
          final bucket = out.substring(start, end);
          final fixedBucket = bucket.replaceAll('.firebasestorage.app', '');
          if (fixedBucket != bucket) {
            out = out.substring(0, start) + fixedBucket + out.substring(end);
          }
        }
      }
    }
    return out;
  }
}
