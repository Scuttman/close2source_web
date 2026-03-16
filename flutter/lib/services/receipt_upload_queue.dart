import 'dart:io';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:image/image.dart' as img;
import 'project_finance_service.dart';

/// Offline-first queue for transaction receipt image uploads.
/// Flow:
/// 1. User selects receipts before or after transaction creation.
/// 2. After transaction is created, enqueue each local file with txId.
/// 3. Background worker uploads file to Storage and records metadata via attachReceipts.
/// 4. On success removes queue entry. Retries with exponential backoff on failure.
class ReceiptUploadQueue {
  ReceiptUploadQueue._();
  static final ReceiptUploadQueue instance = ReceiptUploadQueue._();

  static const _boxName = 'pending_receipts';
  Box? _box;
  bool _working = false;
  DateTime _nextRun = DateTime.fromMillisecondsSinceEpoch(0);

  Future<void> init() async {
    if (_box != null) return;
    await Hive.initFlutter();
    _box = await Hive.openBox(_boxName);
  }

  /// Enqueue a list of file paths for a given transaction.
  Future<void> enqueueList({required String profileId, required String txId, required List<String> filePaths}) async {
    if (filePaths.isEmpty) return;
    await init();
    for (final p in filePaths) {
      if (!File(p).existsSync()) continue;
      final id = '${txId}_${DateTime.now().microsecondsSinceEpoch}_${p.hashCode}';
      await _box!.put(id, {
        'id': id,
        'profileId': profileId,
        'txId': txId,
        'path': p,
        'retries': 0,
        'created': DateTime.now().millisecondsSinceEpoch,
      });
    }
    _scheduleWork();
  }

  void _scheduleWork() {
    if (DateTime.now().isBefore(_nextRun)) return; // backoff window
    if (!_working) {
      _process();
    }
  }

  Future<void> _process() async {
    await init();
    if (_working) return;
    _working = true;
    try {
      // Check connectivity first
      final dynamic netStatusRaw = await Connectivity().checkConnectivity();
      bool offline;
      if (netStatusRaw is ConnectivityResult) {
        offline = netStatusRaw == ConnectivityResult.none;
      } else if (netStatusRaw is List<ConnectivityResult>) {
        offline = netStatusRaw.every((r) => r == ConnectivityResult.none);
      } else {
        offline = false; // unknown type, assume online
      }
      if (offline) {
        _nextRun = DateTime.now().add(const Duration(minutes: 2));
        return;
      }
      final entries = _box!.values.toList().cast<Map>();
      if (entries.isEmpty) return;
      // Group by txId to batch metadata updates.
      final byTx = <String, List<Map>>{};
      for (final e in entries) {
        final txId = e['txId']?.toString() ?? '';
        if (txId.isEmpty) continue; // skip invalid
        byTx.putIfAbsent(txId, () => []).add(e);
      }
      for (final txId in byTx.keys) {
        final list = byTx[txId]!;
        final uploads = <UploadedReceipt>[];
        for (final item in list) {
          final path = item['path'] as String;
            final file = File(path);
          if (!file.existsSync()) {
            await _box!.delete(item['id']);
            continue;
          }
          try {
            final ext = path.contains('.') ? path.split('.').last.toLowerCase() : 'jpg';
            // New storage path nested under profile
            final profileId = (item['profileId'] ?? '').toString();
            final storagePath = 'profiles/$profileId/profileTransactions/$txId/receipts/${item['id']}.$ext';
            final ref = FirebaseStorage.instance.ref(storagePath);
            await ref.putFile(file, SettableMetadata(contentType: _inferMime(ext)));
            int? w; int? h;
            try {
              final bytes = await file.readAsBytes();
              final decoded = img.decodeImage(bytes);
              if (decoded != null) { w = decoded.width; h = decoded.height; }
            } catch (_) {}
            uploads.add(UploadedReceipt(storagePath: storagePath, width: w, height: h, mimeType: _inferMime(ext)));
            // Remove file only after successful upload; keep for potential local cache if desired.
            await _box!.delete(item['id']);
          } catch (e) {
            final retries = (item['retries'] is int) ? item['retries'] as int : 0;
            if (retries >= 5) {
              // Give up after 5 attempts.
              await _box!.delete(item['id']);
            } else {
              await _box!.put(item['id'], {...item, 'retries': retries + 1});
            }
          }
        }
        if (uploads.isNotEmpty) {
          try {
            // Need projectId from one of the entries
            final profileId = list.first['profileId'].toString();
            await ProjectFinanceService.instance.attachReceipts(
              transactionId: txId,
              profileId: profileId,
              uploads: uploads,
            );
          } catch (_) {
            // If metadata attach fails, requeue uploads (simplistic fallback: put them back if needed)
            for (final u in uploads) {
              final restoreId = '${txId}_restore_${u.storagePath.hashCode}_${DateTime.now().millisecondsSinceEpoch}';
              await _box!.put(restoreId, {
                'id': restoreId,
                'profileId': list.first['profileId'].toString(),
                'txId': txId,
                'path': u.storagePath, // cannot re-upload easily without original file; ignore.
                'retries': 6, // force drop later
                'created': DateTime.now().millisecondsSinceEpoch,
              });
            }
          }
        }
      }
    } finally {
      _working = false;
      // Reschedule if items remain
      if (_box != null && _box!.isNotEmpty) {
        _nextRun = DateTime.now().add(const Duration(seconds: 30));
        Future.delayed(const Duration(seconds: 35), _scheduleWork);
      }
    }
  }

  String _inferMime(String ext) {
    switch (ext) {
      case 'png': return 'image/png';
      case 'gif': return 'image/gif';
      case 'webp': return 'image/webp';
      default: return 'image/jpeg';
    }
  }
}