using ApplicationCore.DTOs.Episode;
using ApplicationCore.DTOs.Series;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces;
using ApplicationCore.Models;
using Infrastructure.Contexts;
using Infrastructure.Services.InternalServices;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services
{
    public class SeriesService : ISeriesService
    {
        private readonly NostalgiaTVContext _context;
        private readonly FileUploadService _fileUploadService;
        private readonly SeriesFolderService _folderService;

        public SeriesService(NostalgiaTVContext context, FileUploadService fileUploadService, SeriesFolderService folderService)
        {
            _context = context;
            _fileUploadService = fileUploadService;
            _folderService = folderService;
        }

        public async Task<List<SeriesResponse>> GetAllAsync() => await _context.Series.ProjectToType<SeriesResponse>().ToListAsync();

        public async Task<SeriesResponse> GetByIdAsync(int id)
        {
            var series = await _context.Series.FindAsync(id)
                ?? throw new NotFoundException($"Series {id} not found");
            return series.Adapt<SeriesResponse>();
        }

        public async Task<SeriesResponse> CreateAsync(SeriesRequest request)
        {
            var series = request.Adapt<Series>();

            if (request.Logo != null)
                series.LogoPath = await _fileUploadService.UploadAsync(request.Logo, "series");

            series.FolderPath = _folderService.CreateSeriesFolder(request.Name, request.Seasons);

            _context.Series.Add(series);
            await _context.SaveChangesAsync();
            return series.Adapt<SeriesResponse>();
        }

        public async Task<SeriesResponse> UpdateAsync(int id, SeriesRequest request)
        {
            var series = await _context.Series.FindAsync(id)
                ?? throw new NotFoundException($"Series {id} not found");

            request.Adapt(series);

            if (request.Logo != null)
                series.LogoPath = await _fileUploadService.UploadAsync(request.Logo, "series");

            if (!string.IsNullOrEmpty(series.FolderPath))
                _folderService.UpdateSeriesFolders(series.FolderPath, request.Seasons);
            else
                series.FolderPath = _folderService.CreateSeriesFolder(request.Name, request.Seasons);

            await _context.SaveChangesAsync();
            return series.Adapt<SeriesResponse>();
        }

        public async Task DeleteAsync(int id)
        {
            var series = await _context.Series.FindAsync(id)
                ?? throw new NotFoundException($"Series {id} not found");
            _context.Series.Remove(series);
            await _context.SaveChangesAsync();
        }

        public async Task<SeriesResponse> AssignCategoriesAsync(int seriesId, List<int> categoryIds)
        {
            var series = await _context.Series
                .Include(s => s.Categories)
                .FirstOrDefaultAsync(s => s.Id == seriesId)
                ?? throw new NotFoundException($"Series {seriesId} not found");

            series.Categories = await _context.Categories
                .Where(c => categoryIds.Contains(c.Id))
                .ToListAsync();

            await _context.SaveChangesAsync();
            return series.Adapt<SeriesResponse>();
        }

        public async Task<List<EpisodeResponse>> ScanFolderAsync(int seriesId)
        {
            var series = await _context.Series.FindAsync(seriesId)
                ?? throw new NotFoundException($"Series {seriesId} not found");

            if (string.IsNullOrEmpty(series.FolderPath) || !Directory.Exists(series.FolderPath))
                throw new BadRequestException("Series folder not found.");

            var episodeTypes = await _context.EpisodeTypes.ToListAsync();
            var regularType = episodeTypes.First(t => t.Name == "Regular");
            var specialType = episodeTypes.First(t => t.Name == "Special");
            var movieType = episodeTypes.First(t => t.Name == "Movie");

            var existingEpisodes = await _context.Episodes
                .Where(e => e.SeriesId == seriesId)
                .ToListAsync();

            // Build map of existing episodes by normalized FilePath
            var existingByPath = existingEpisodes
                .Where(e => e.FilePath != null)
                .ToDictionary(e => NormalizePath(e.FilePath!), e => e);

            var scannedFiles = new List<(string FilePath, int Season, int EpisodeTypeId)>();
            var allDirs = Directory.GetDirectories(series.FolderPath);

            // Season folders
            foreach (var seasonDir in allDirs.Where(d =>
                Path.GetFileName(d).StartsWith("season ", StringComparison.OrdinalIgnoreCase)))
            {
                var dirName = Path.GetFileName(seasonDir.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
                var numberPart = dirName.Replace("season ", "", StringComparison.OrdinalIgnoreCase).Trim();
                var seasonNumber = int.TryParse(numberPart, out var n) ? n : 0;

                foreach (var file in Directory.GetFiles(seasonDir))
                    scannedFiles.Add((file, seasonNumber, regularType.Id));
            }

            // Specials folder
            var specialsDir = allDirs.FirstOrDefault(d =>
                Path.GetFileName(d).Equals("specials", StringComparison.OrdinalIgnoreCase))
                ?? Path.Combine(series.FolderPath, "specials");

            if (Directory.Exists(specialsDir))
                foreach (var file in Directory.GetFiles(specialsDir))
                    scannedFiles.Add((file, 0, specialType.Id));

            // Movies folder
            var moviesDir = allDirs.FirstOrDefault(d =>
                Path.GetFileName(d).Equals("movies", StringComparison.OrdinalIgnoreCase))
                ?? Path.Combine(series.FolderPath, "movies");

            if (Directory.Exists(moviesDir))
                foreach (var file in Directory.GetFiles(moviesDir))
                    scannedFiles.Add((file, 0, movieType.Id));

            var scannedPaths = scannedFiles.Select(f => NormalizePath(f.FilePath)).ToHashSet();

            // Remove episodes whose file no longer exists
            var toRemove = existingEpisodes.Where(e =>
                e.FilePath == null || !scannedPaths.Contains(NormalizePath(e.FilePath))).ToList();
            _context.Episodes.RemoveRange(toRemove);

            // Add or update
            foreach (var (filePath, season, episodeTypeId) in scannedFiles)
            {
                var key = NormalizePath(filePath);
                var fileTitle = Path.GetFileNameWithoutExtension(filePath);

                if (existingByPath.TryGetValue(key, out var existing))
                {
                    // File already exists — only update FilePath if it changed (shouldn't happen but just in case)
                    // Never overwrite Title or EpisodeNumber if they were manually edited
                    var titleMatchesFile = existing.Title == fileTitle;
                    var wasManuallyEdited = !titleMatchesFile || existing.EpisodeNumber > 0;

                    if (!wasManuallyEdited)
                    {
                        // Not edited — safe to update title from filename
                        existing.Title = fileTitle;
                    }

                    existing.FilePath = filePath;
                    existing.Season = season;
                    existing.EpisodeTypeId = episodeTypeId;
                }
                else
                {
                    // New file — create with filename as title
                    _context.Episodes.Add(new Episode
                    {
                        Title = fileTitle,
                        FilePath = filePath,
                        SeriesId = seriesId,
                        Season = season,
                        EpisodeNumber = 0,
                        EpisodeTypeId = episodeTypeId
                    });
                }
            }

            await _context.SaveChangesAsync();

            return await _context.Episodes
                .Where(e => e.SeriesId == seriesId)
                .Include(e => e.EpisodeType)
                .ProjectToType<EpisodeResponse>()
                .ToListAsync();
        }

        private static string NormalizePath(string path) => path.Replace("\\", "/").ToLowerInvariant().Trim();

        public async Task<PagedResult<SeriesResponse>> GetPublicAsync(SeriesFilterRequest filter)
        {
            var query = _context.Series.AsQueryable();

            if (!string.IsNullOrWhiteSpace(filter.Name))
                query = query.Where(s => s.Name.Contains(filter.Name));

            if (filter.ChannelId.HasValue)
                query = query.Where(s => s.Channels.Any(c => c.Id == filter.ChannelId));

            if (filter.EpisodeTypeId.HasValue)
                query = query.Where(s => s.Episodes.Any(e => e.EpisodeTypeId == filter.EpisodeTypeId));

            var totalCount = await query.CountAsync();

            var items = await query
                .OrderBy(s => s.Name)
                .Skip((filter.Page - 1) * filter.PageSize)
                .Take(filter.PageSize)
                .ProjectToType<SeriesResponse>()
                .ToListAsync();

            return new PagedResult<SeriesResponse>
            {
                Items = items,
                TotalCount = totalCount,
                Page = filter.Page,
                PageSize = filter.PageSize
            };
        }
    }
}
