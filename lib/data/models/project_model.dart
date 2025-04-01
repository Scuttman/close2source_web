import '../data_imports.dart';

class Project {
  final String projectId;
  final String projectCode;
  final String projectName;
  final String projectDesc;
  final String projectOwner;
  final String projectSponsor;
  final double projectBudget;
  final String projectBalance;
  final String projectCurrency;
  final Timestamp projectStartDate;
  final Timestamp creationDate;
  final Timestamp lastUpdated;
  final String createdBy;
  final Timestamp expiryDate;
  final String status;
  final List<dynamic> reportList;
  final List<dynamic> transactionList;
  final List<dynamic> photoList;
  final List<String> profileUsersIds;
  final List<dynamic> profileUsers;

  Project({
    required this.projectId,
    required this.projectCode,
    required this.projectDesc,
    required this.projectName,
    required this.projectOwner,
    required this.projectSponsor,
    required this.projectBudget,
    required this.projectBalance,
    required this.projectCurrency,
    required this.projectStartDate,
    required this.creationDate,
    required this.lastUpdated,
    required this.createdBy,
    required this.expiryDate,
    required this.status,
    required this.reportList,
    required this.transactionList,
    required this.photoList,
    required this.profileUsersIds,
    required this.profileUsers
  });

  /// Convert Firestore document to Project model
  /// Convert Firestore document to Project model
  factory Project.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Project(
      projectId: data['projectId'] ?? '',
      projectCode: data['projectCode'] ?? '',
      projectDesc: data['projectDesc'] ?? '',
      projectName: data['projectName'] ?? '',
      projectOwner: data['projectOwner'] ?? '',
      projectSponsor: data['projectSposor'] ?? '', // Keeping typo consistent
      projectBudget: (data['projectBudget'] ?? 0).toDouble(),
      projectBalance: data['projectBalance'] ?? '0',
      projectCurrency: data['projectCurrency'] ?? 'USD',
      projectStartDate: _convertToTimestamp(data['projectStartDate']),
      creationDate: _convertToTimestamp(data['creationDate']),
      lastUpdated: _convertToTimestamp(data['lastUpdated']),
      expiryDate: _convertToTimestamp(data['expiryDate']),
      createdBy: data['createdBy'] ?? '',
      status: data['status'] ?? 'active',
      reportList: data['reportList'] ?? [],
      transactionList: data['transactionList'] ?? [],
      photoList: data['photoList'] ?? [],
      profileUsersIds: data['profileUsersIds'] ?? [],
      profileUsers: data['profileUsers'] ?? []
    );
  }

  /// Helper function to ensure proper Timestamp conversion
  static Timestamp _convertToTimestamp(dynamic value) {
    if (value is Timestamp) {
      return value; // Already a Timestamp
    } else if (value is String) {
      // If Firestore stored it as a string, try parsing
      DateTime parsedDate = DateTime.tryParse(value) ?? DateTime.now();
      return Timestamp.fromDate(parsedDate);
    } else {
      // Default to current time if null or unknown type
      return Timestamp.now();
    }
  }

  /// Convert Project model to Firestore document
  Map<String, dynamic> toJson() {
    return {
      'projectId': projectId,
      'projectCode': projectCode,
      'projectDesc': projectDesc,
      'projectName': projectName,
      'projectOwner': projectOwner,
      'projectSposor': projectSponsor, // Keeping typo consistent
      'projectBudget': projectBudget,
      'projectBalance': projectBalance,
      'projectCurrency': projectCurrency,
      'projectStartDate': projectStartDate,
      'creationDate': creationDate,
      'lastUpdated': lastUpdated,
      'createdBy': createdBy,
      'expiryDate': expiryDate,
      'status': status,
      'reportList': reportList,
      'transactionList': transactionList,
      'photoList': photoList,
      'profileUsersIds': profileUsersIds
    };
  }

  /// Create a new copy of the Project with modified fields
  Project copyWith({
    String? projectId,
    String? projectCode,
    String? projectDesc,
    String? projectName,
    String? projectOwner,
    String? projectSponsor,
    double? projectBudget,
    String? projectBalance,
    String? projectCurrency,
    Timestamp? projectStartDate,
    Timestamp? creationDate,
    Timestamp? lastUpdated,
    String? createdBy,
    Timestamp? expiryDate,
    String? status,
    List<dynamic>? reportList,
    List<dynamic>? transactionList,
    List<dynamic>? photoList,
    List<String>? profileUsersIds,
    List<dynamic>? profileUsers
  }) {
    return Project(
      projectId: projectId ?? this.projectId,
      projectCode: projectCode ?? this.projectCode,
      projectDesc: projectDesc ?? this.projectDesc,
      projectName: projectName ?? this.projectName,
      projectOwner: projectOwner ?? this.projectOwner,
      projectSponsor: projectSponsor ?? this.projectSponsor,
      projectBudget: projectBudget ?? this.projectBudget,
      projectBalance: projectBalance ?? this.projectBalance,
      projectCurrency: projectCurrency ?? this.projectCurrency,
      projectStartDate: projectStartDate ?? this.projectStartDate,
      creationDate: creationDate ?? this.creationDate,
      lastUpdated: lastUpdated ?? this.lastUpdated,
      createdBy: createdBy ?? this.createdBy,
      expiryDate: expiryDate ?? this.expiryDate,
      status: status ?? this.status,
      reportList: reportList ?? this.reportList,
      transactionList: transactionList ?? this.transactionList,
      photoList: photoList ?? this.photoList,
      profileUsersIds: profileUsersIds ?? this.profileUsersIds,
      profileUsers: profileUsers ?? this.profileUsers
    );
  }
}