using Microsoft.JSInterop;
using BlazorHost.Pages;
using System.Text.Json.Serialization;

namespace BlazorHost.Services;

public class DuckDBInterop : IAsyncDisposable
{
    private readonly IJSRuntime _jsRuntime;
    private IJSObjectReference? _module;

    public DuckDBInterop(IJSRuntime jsRuntime)
    {
        _jsRuntime = jsRuntime;
    }

    private async Task EnsureModuleLoaded()
    {
        if (_module == null)
        {
            _module = await _jsRuntime.InvokeAsync<IJSObjectReference>("import", "./js/duckdb_init.js");
        }
    }

    public async Task<string> ImputeMissingValuesAsync(double?[] data, string method)
    {
        await EnsureModuleLoaded();
        if (_module == null) return "Error: Module not loaded";
        return await _module.InvokeAsync<string>("imputeMissingValues", data, method);
    }

    public async Task<string> RunTestQueryAsync()
    {
        await EnsureModuleLoaded();
        if (_module == null) return "Error: Module not loaded";
        return await _module.InvokeAsync<string>("runTestQuery");
    }

    public async Task IngestLargeCSVAsync(IJSObjectReference file, string tableName, DotNetObjectReference<Diagnostic> progressRef)
    {
        await EnsureModuleLoaded();
        if (_module == null) return;
        await _module.InvokeVoidAsync("ingestLargeCSV", file, tableName, progressRef);
    }

    public async Task IngestFromInputAsync(string elementId, string tableName, DotNetObjectReference<Diagnostic> progressRef)
    {
        await EnsureModuleLoaded();
        if (_module == null) return;
        await _module.InvokeVoidAsync("ingestFromInput", elementId, tableName, progressRef);
    }

    public async Task ClearAllStorageAsync()
    {
        await EnsureModuleLoaded();
        if (_module == null) return;
        await _module.InvokeVoidAsync("clearAllStorage");
    }

    public async Task GetInventoryAsync(DotNetObjectReference<Diagnostic> progressRef)
    {
        await EnsureModuleLoaded();
        if (_module == null) return;
        await _module.InvokeVoidAsync("getInventory", progressRef);
    }

    public async Task<string> GetTableProfileAsync(string tableName)
    {
        await EnsureModuleLoaded();
        if (_module == null) return "{}";
        return await _module.InvokeAsync<string>("getTableProfile", tableName);
    }

    public async ValueTask DisposeAsync()
    {
        if (_module != null)
        {
            await _module.DisposeAsync();
        }
    }
}
