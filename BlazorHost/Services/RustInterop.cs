using Microsoft.JSInterop;
using System.Text.Json;

namespace BlazorHost.Services;

public class RustInterop : IAsyncDisposable
{
    private readonly IJSRuntime _jsRuntime;
    private bool _isInitialized = false;

    public RustInterop(IJSRuntime jsRuntime)
    {
        _jsRuntime = jsRuntime;
    }

    public async Task InitializeAsync()
    {
        if (!_isInitialized)
        {
            await _jsRuntime.InvokeVoidAsync("rustInterop.init");
            _isInitialized = true;
        }
    }

    public async Task<OutlierSummary> DetectOutliersAsync(double[] data)
    {
        await InitializeAsync();
        var jsonResult = await _jsRuntime.InvokeAsync<string>("rustInterop.detectOutliers", data);
        return JsonSerializer.Deserialize<OutlierSummary>(jsonResult, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) 
               ?? new OutlierSummary();
    }

    public async Task<string> SayHelloAsync(string name)
    {
        await InitializeAsync();
        return await _jsRuntime.InvokeAsync<string>("rustInterop.sayHello", name);
    }

    public async ValueTask DisposeAsync()
    {
        // Add cleanup if needed
    }
}

public class OutlierSummary
{
    public int Count { get; set; }
    public double[] Outliers { get; set; } = [];
    public double LowerBound { get; set; }
    public double UpperBound { get; set; }
}
