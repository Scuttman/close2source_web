// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'spending_entry.dart';

// **************************************************************************
// TypeAdapterGenerator
// **************************************************************************

class SpendingEntryAdapter extends TypeAdapter<SpendingEntry> {
  @override
  final int typeId = 1;

  @override
  SpendingEntry read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return SpendingEntry(
      id: fields[0] as String,
      description: fields[1] as String,
      category: fields[2] as String,
      amount: fields[3] as double,
      date: fields[4] as String,
      localImagePath: fields[5] as String?,
    );
  }

  @override
  void write(BinaryWriter writer, SpendingEntry obj) {
    writer
      ..writeByte(6)
      ..writeByte(0)
      ..write(obj.id)
      ..writeByte(1)
      ..write(obj.description)
      ..writeByte(2)
      ..write(obj.category)
      ..writeByte(3)
      ..write(obj.amount)
      ..writeByte(4)
      ..write(obj.date)
      ..writeByte(5)
      ..write(obj.localImagePath);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SpendingEntryAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}
