using Microsoft.JSInterop;

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
        return await _jsRuntime.InvokeAsync<OutlierSummary>("rustInterop.detectOutliers", data);
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
