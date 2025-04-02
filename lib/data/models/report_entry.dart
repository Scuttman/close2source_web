class ReportEntry {
  final String id;
  final String profileId;
  final String title;
  final String description;
  final DateTime date;
  final List<String> photos;         // Local or uploaded URLs
  final bool isUploaded;             // ✅ Tracks sync status

  ReportEntry({
    required this.id,
    required this.profileId,
    required this.title,
    required this.description,
    required this.date,
    required this.photos,
    required this.isUploaded,
  });

  ReportEntry copyWith({
    List<String>? photos,
    bool? isUploaded,
  }) {
    return ReportEntry(
      id: id,
      profileId: profileId,
      title: title,
      description: description,
      date: date,
      photos: photos ?? this.photos,
      isUploaded: isUploaded ?? this.isUploaded,
    );
  }

  Map<String, dynamic> toFirestore() => {
    'id': id,
    'title': title,
    'description': description,
    'date': date.toIso8601String(),
    'photos': photos,
    'isUploaded': isUploaded,
  };

  factory ReportEntry.fromJson(Map<String, dynamic> json) => ReportEntry(
    id: json['id'],
    profileId: json['profileId'],
    title: json['title'],
    description: json['description'],
    date: DateTime.parse(json['date']),
    photos: List<String>.from(json['photos'] ?? []),
    isUploaded: json['isUploaded'] ?? false,
  );
}