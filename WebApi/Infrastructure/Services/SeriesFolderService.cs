using ApplicationCore.Settings;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services
{
    public class SeriesFolderService
    {
        private readonly MediaSettings _settings;

        public SeriesFolderService(IOptions<MediaSettings> settings)
        {
            _settings = settings.Value;
        }

        public string CreateSeriesFolder(string seriesName, int seasons)
        {
            var safeName = string.Concat(seriesName.Split(Path.GetInvalidFileNameChars()));
            var seriesPath = Path.Combine(_settings.BasePath, "series", safeName);

            Directory.CreateDirectory(seriesPath);

            for (int i = 1; i <= seasons; i++)
                Directory.CreateDirectory(Path.Combine(seriesPath, $"season {i}"));

            Directory.CreateDirectory(Path.Combine(seriesPath, "specials"));
            Directory.CreateDirectory(Path.Combine(seriesPath, "movies"));

            return seriesPath;
        }

        public void UpdateSeriesFolders(string folderPath, int newSeasons)
        {
            if (!Directory.Exists(folderPath)) return;

            var existing = Directory.GetDirectories(folderPath)
                .Select(Path.GetFileName)
                .Where(n => n != null && n.StartsWith("season "))
                .Select(n => int.TryParse(n!.Replace("season ", ""), out var num) ? num : 0)
                .Where(n => n > 0)
                .ToList();

            var maxExisting = existing.Any() ? existing.Max() : 0;

            for (int i = maxExisting + 1; i <= newSeasons; i++)
                Directory.CreateDirectory(Path.Combine(folderPath, $"season {i}"));
        }
    }
}