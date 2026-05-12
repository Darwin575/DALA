using Microsoft.AspNetCore.Components.Forms;

namespace DALA.Core;

public interface IDataService
{
    Task IngestFileAsync(IBrowserFile file);
    Task<IEnumerable<dynamic>> ExecuteQueryAsync(string sql);
    IObservable<double> IngestionProgress { get; }
}
