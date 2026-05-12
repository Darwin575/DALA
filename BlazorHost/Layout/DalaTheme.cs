using MudBlazor;

namespace BlazorHost.Layout;

public static class DalaTheme
{
    public static MudTheme DefaultTheme = new MudTheme()
    {
        PaletteDark = new PaletteDark()
        {
            Primary = "#00f2ff", // Neon Cyan
            Secondary = "#7000ff", // Purple accent
            Background = "#0f172a", // Deep Slate
            AppbarBackground = "#0f172a",
            DrawerBackground = "#1e293b",
            Surface = "#1e293b",
            TextPrimary = "#f8fafc",
            TextSecondary = "#94a3b8",
        }
    };
}
