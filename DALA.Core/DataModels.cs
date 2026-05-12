namespace DALA.Core;

public record DataColumn(string Name, string DataType, bool IsNullable);

public record TableSchema(string TableName, List<DataColumn> Columns);
