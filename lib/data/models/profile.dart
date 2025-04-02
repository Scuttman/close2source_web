import '../data_imports.dart';

class Profile {
  final String profileId;
  final String profileCode;
  final String profileName;
  final String profileDesc;
  final String profileOwner;
  final String profileSponsor;
  final double profileBudget;
  final String profileBalance;
  final String profileCurrency;
  final Timestamp profileStartDate;
  final Timestamp creationDate;
  final Timestamp lastUpdated;
  final String createdBy;
  final Timestamp expiryDate;
  final String status;
  final String profileType; // NEW: e.g., 'Project', 'School', etc.
  final List<dynamic> reportList;
  final List<dynamic> transactionList;
  final List<dynamic> photoList;
  final List<String> profileUsersIds;
  final List<dynamic> profileUsers;

  Profile({
    required this.profileId,
    required this.profileCode,
    required this.profileName,
    required this.profileDesc,
    required this.profileOwner,
    required this.profileSponsor,
    required this.profileBudget,
    required this.profileBalance,
    required this.profileCurrency,
    required this.profileStartDate,
    required this.creationDate,
    required this.lastUpdated,
    required this.createdBy,
    required this.expiryDate,
    required this.status,
    required this.profileType,
    required this.reportList,
    required this.transactionList,
    required this.photoList,
    required this.profileUsersIds,
    required this.profileUsers,
  });

  factory Profile.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Profile(
      profileId: data['profileId'] ?? '',
      profileCode: data['profileCode'] ?? '',
      profileName: data['profileName'] ?? '',
      profileDesc: data['profileDesc'] ?? '',
      profileOwner: data['profileOwner'] ?? '',
      profileSponsor: data['profileSponsor'] ?? '',
      profileBudget: (data['profileBudget'] ?? 0).toDouble(),
      profileBalance: data['profileBalance'] ?? '0',
      profileCurrency: data['profileCurrency'] ?? 'USD',
      profileStartDate: _convertToTimestamp(data['profileStartDate']),
      creationDate: _convertToTimestamp(data['creationDate']),
      lastUpdated: _convertToTimestamp(data['lastUpdated']),
      expiryDate: _convertToTimestamp(data['expiryDate']),
      createdBy: data['createdBy'] ?? '',
      status: data['status'] ?? 'active',
      profileType: data['profileType'] ?? 'General',
      reportList: data['reportList'] ?? [],
      transactionList: data['transactionList'] ?? [],
      photoList: data['photoList'] ?? [],
      profileUsersIds: List<String>.from(data['profileUsersIds'] ?? []),
      profileUsers: data['profileUsers'] ?? [],
    );
  }

  static Timestamp _convertToTimestamp(dynamic value) {
    if (value is Timestamp) {
      return value;
    } else if (value is String) {
      DateTime parsedDate = DateTime.tryParse(value) ?? DateTime.now();
      return Timestamp.fromDate(parsedDate);
    } else {
      return Timestamp.now();
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'profileId': profileId,
      'profileCode': profileCode,
      'profileName': profileName,
      'profileDesc': profileDesc,
      'profileOwner': profileOwner,
      'profileSponsor': profileSponsor,
      'profileBudget': profileBudget,
      'profileBalance': profileBalance,
      'profileCurrency': profileCurrency,
      'profileStartDate': profileStartDate,
      'creationDate': creationDate,
      'lastUpdated': lastUpdated,
      'createdBy': createdBy,
      'expiryDate': expiryDate,
      'status': status,
      'profileType': profileType,
      'reportList': reportList,
      'transactionList': transactionList,
      'photoList': photoList,
      'profileUsersIds': profileUsersIds,
      'profileUsers': profileUsers,
    };
  }

  Profile copyWith({
    String? profileId,
    String? profileCode,
    String? profileName,
    String? profileDesc,
    String? profileOwner,
    String? profileSponsor,
    double? profileBudget,
    String? profileBalance,
    String? profileCurrency,
    Timestamp? profileStartDate,
    Timestamp? creationDate,
    Timestamp? lastUpdated,
    String? createdBy,
    Timestamp? expiryDate,
    String? status,
    String? profileType,
    List<dynamic>? reportList,
    List<dynamic>? transactionList,
    List<dynamic>? photoList,
    List<String>? profileUsersIds,
    List<dynamic>? profileUsers,
  }) {
    return Profile(
      profileId: profileId ?? this.profileId,
      profileCode: profileCode ?? this.profileCode,
      profileName: profileName ?? this.profileName,
      profileDesc: profileDesc ?? this.profileDesc,
      profileOwner: profileOwner ?? this.profileOwner,
      profileSponsor: profileSponsor ?? this.profileSponsor,
      profileBudget: profileBudget ?? this.profileBudget,
      profileBalance: profileBalance ?? this.profileBalance,
      profileCurrency: profileCurrency ?? this.profileCurrency,
      profileStartDate: profileStartDate ?? this.profileStartDate,
      creationDate: creationDate ?? this.creationDate,
      lastUpdated: lastUpdated ?? this.lastUpdated,
      createdBy: createdBy ?? this.createdBy,
      expiryDate: expiryDate ?? this.expiryDate,
      status: status ?? this.status,
      profileType: profileType ?? this.profileType,
      reportList: reportList ?? this.reportList,
      transactionList: transactionList ?? this.transactionList,
      photoList: photoList ?? this.photoList,
      profileUsersIds: profileUsersIds ?? this.profileUsersIds,
      profileUsers: profileUsers ?? this.profileUsers,
    );
  }
}