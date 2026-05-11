using Microsoft.JSInterop;

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

    public async ValueTask DisposeAsync()
    {
        if (_module != null)
        {
            await _module.DisposeAsync();
        }
    }
}
