using System.Net.Http.Json;

namespace BlazorHost.Services;

public class GeminiService
{
    private readonly HttpClient _httpClient;
    private const string ApiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    public GeminiService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<string> InterpretResultsAsync(string query, string jsonData, string apiKey)
    {
        var request = new
        {
            contents = new[]
            {
                new
                {
                    parts = new[]
                    {
                        new { text = $"You are a data analyst. Interpret the following SQL results for this query: '{query}'. Data: {jsonData}" }
                    }
                }
            }
        };

        var response = await _httpClient.PostAsJsonAsync($"{ApiUrl}?key={apiKey}", request);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<GeminiResponse>();
        return result?.Candidates?[0]?.Content?.Parts?[0]?.Text ?? "No interpretation available.";
    }
}

public class GeminiResponse
{
    public Candidate[]? Candidates { get; set; }
}

public class Candidate
{
    public Content? Content { get; set; }
}

public class Content
{
    public Part[]? Parts { get; set; }
}

public class Part
{
    public string? Text { get; set; }
}
