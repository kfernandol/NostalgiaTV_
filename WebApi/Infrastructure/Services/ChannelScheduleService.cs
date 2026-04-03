using ApplicationCore.DTOs.Channel;
using ApplicationCore.Entities;
using Infrastructure.Contexts;
using Infrastructure.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Text;

namespace Infrastructure.Services
{
    public class ChannelScheduleService
    {
        private readonly NostalgiaTVContext _context;
        private readonly ILogger<ChannelScheduleService> _logger;

        public ChannelScheduleService(NostalgiaTVContext context, ILogger<ChannelScheduleService> logger)
        {
            _context = context;
            _logger = logger;
        }

        // Returns schedule for next 24h for a channel
        public async Task<List<ChannelScheduleEntryResponse>> GetScheduleAsync(int channelId)
        {
            var now = DateTime.UtcNow;
            var until = now.AddHours(24);

            await EnsureScheduleGeneratedAsync(channelId, until);

            return await _context.ChannelScheduleEntries
                .Where(e => e.ChannelId == channelId && e.EndTime >= now && e.StartTime <= until)
                .Include(e => e.Episode).ThenInclude(e => e.Series)
                .OrderBy(e => e.StartTime)
                .Select(e => new ChannelScheduleEntryResponse
                {
                    Id = e.Id,
                    ChannelId = e.ChannelId,
                    EpisodeId = e.EpisodeId,
                    EpisodeTitle = e.Episode.Title,
                    SeriesName = e.Episode.Series.Name,
                    SeriesLogoPath = e.Episode.Series.LogoPath,
                    FilePath = e.Episode.FilePath!.Replace("wwwroot", "").Replace("\\", "/"),
                    StartTime = DateTime.SpecifyKind(e.StartTime, DateTimeKind.Utc),
                    EndTime = DateTime.SpecifyKind(e.EndTime, DateTimeKind.Utc),
                    Season = e.Episode.Season,
                    EpisodeNumber = e.Episode.EpisodeNumber,
                })
                .ToListAsync();
        }

        public async Task EnsureScheduleGeneratedAsync(int channelId, DateTime until)
        {
            // Find where the schedule currently ends for this channel
            var lastEntry = await _context.ChannelScheduleEntries
                .Where(e => e.ChannelId == channelId)
                .OrderByDescending(e => e.EndTime)
                .FirstOrDefaultAsync();

            var generateFrom = lastEntry?.EndTime ?? DateTime.UtcNow;

            if (generateFrom >= until) return; // Already covered

            await GenerateScheduleAsync(channelId, generateFrom, until);
        }

        private async Task GenerateScheduleAsync(int channelId, DateTime from, DateTime until)
        {
            var episodes = await _context.Episodes
                .Include(e => e.Series)
                .Where(e => e.Series.Channels.Any(c => c.Id == channelId) && e.FilePath != null)
                .ToListAsync();

            if (!episodes.Any()) return;

            // Get last episode played per series from existing schedule entries
            var seriesLastEpisodes = await _context.ChannelScheduleEntries
                .Where(e => e.ChannelId == channelId)
                .Include(e => e.Episode)
                .GroupBy(e => e.Episode.SeriesId)
                .ToDictionaryAsync(
                    g => g.Key,
                    g => g.OrderByDescending(e => e.EndTime).Select(e => e.Episode).First()
                );

            // Get episodes already used in the last 24h to avoid repeating
            var recentlyUsed = await _context.ChannelScheduleEntries
                .Where(e => e.ChannelId == channelId && e.StartTime >= DateTime.UtcNow.AddHours(-24))
                .Select(e => e.EpisodeId)
                .ToHashSetAsync();

            var random = new Random();
            var current = from;
            var newEntries = new List<ChannelScheduleEntry>();
            int? lastEpisodeId = null;
            int? lastSeriesId = null;
            double lastDuration = 0;
            const double MinDurationForSeriesRule = 1200; // 20 minutes in seconds

            while (current < until)
            {
                // Filter available series (episodes not in recentlyUsed and respecting rules)
                var availableSeries = episodes
                    .GroupBy(e => e.SeriesId)
                    .Where(g =>
                    {
                        var seriesId = g.Key;
                        var hasFreshEpisodes = g.Any(e => !recentlyUsed.Contains(e.Id));
                        var avoidsConsecutive = !g.Any(e => e.Id == lastEpisodeId);
                        var respectsSeriesRule = lastDuration < MinDurationForSeriesRule || seriesId != lastSeriesId;
                        return hasFreshEpisodes && avoidsConsecutive && respectsSeriesRule;
                    })
                    .Select(g => g.Key)
                    .ToList();

                // If filtering is too strict, relax constraints progressively
                if (!availableSeries.Any())
                {
                    availableSeries = episodes
                        .Where(e => !recentlyUsed.Contains(e.Id)
                                 && e.Id != lastEpisodeId
                                 && (lastDuration < MinDurationForSeriesRule || e.SeriesId != lastSeriesId))
                        .Select(e => e.SeriesId)
                        .Distinct()
                        .ToList();
                }

                if (!availableSeries.Any())
                {
                    availableSeries = episodes
                        .Where(e => e.Id != lastEpisodeId
                                 && (lastDuration < MinDurationForSeriesRule || e.SeriesId != lastSeriesId))
                        .Select(e => e.SeriesId)
                        .Distinct()
                        .ToList();
                    recentlyUsed.Clear();
                }

                if (!availableSeries.Any())
                {
                    availableSeries = episodes
                        .Where(e => e.Id != lastEpisodeId)
                        .Select(e => e.SeriesId)
                        .Distinct()
                        .ToList();
                }

                if (!availableSeries.Any())
                {
                    availableSeries = episodes.Select(e => e.SeriesId).Distinct().ToList();
                }

                // Pick a random series
                var selectedSeriesId = availableSeries[random.Next(availableSeries.Count)];
                var seriesEpisodes = episodes.Where(e => e.SeriesId == selectedSeriesId).ToList();

                // Find the next sequential episode for this series
                Episode? episode;
                if (seriesLastEpisodes.TryGetValue(selectedSeriesId, out var lastEpisode))
                {
                    // Get next episode after the last one played (same season, next number or next season, episode 1)
                    episode = seriesEpisodes
                        .Where(e => e.Season > lastEpisode.Season ||
                                   (e.Season == lastEpisode.Season && e.EpisodeNumber > lastEpisode.EpisodeNumber))
                        .OrderBy(e => e.Season)
                        .ThenBy(e => e.EpisodeNumber)
                        .FirstOrDefault();

                    // If no next episode, wrap around to the first episode
                    if (episode == null)
                    {
                        episode = seriesEpisodes
                            .OrderBy(e => e.Season)
                            .ThenBy(e => e.EpisodeNumber)
                            .First();
                    }
                }
                else
                {
                    // First time playing this series, start from the beginning
                    episode = seriesEpisodes
                        .OrderBy(e => e.Season)
                        .ThenBy(e => e.EpisodeNumber)
                        .First();
                }

                var duration = await VideoHelper.GetVideoDurationAsync(episode.FilePath!);
                if (duration <= 0) duration = 1800; // fallback 30min

                var end = current.AddSeconds(duration);
                newEntries.Add(new ChannelScheduleEntry
                {
                    ChannelId = channelId,
                    EpisodeId = episode.Id,
                    StartTime = current,
                    EndTime = end,
                });

                recentlyUsed.Add(episode.Id);
                lastEpisodeId = episode.Id;
                lastSeriesId = episode.SeriesId;
                lastDuration = duration;
                current = end;

                // Update tracking for this series
                seriesLastEpisodes[selectedSeriesId] = episode;
            }

            _context.ChannelScheduleEntries.AddRange(newEntries);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Generated {count} schedule entries for channel {id}", newEntries.Count, channelId);
        }

        // Called by ChannelBroadcastService to get current entry (does NOT generate schedule)
        public async Task<ChannelScheduleEntry?> GetCurrentEntryAsync(int channelId)
        {
            var now = DateTime.UtcNow;

            return await _context.ChannelScheduleEntries
                .Include(e => e.Episode).ThenInclude(e => e.Series)
                .Where(e => e.ChannelId == channelId && e.StartTime <= now && e.EndTime > now)
                .FirstOrDefaultAsync();
        }

        public async Task<ChannelScheduleEntry?> GetNextEntryAsync(int channelId)
        {
            var now = DateTime.UtcNow;
            return await _context.ChannelScheduleEntries
                .Include(e => e.Episode).ThenInclude(e => e.Series)
                .Where(e => e.ChannelId == channelId && e.StartTime > now)
                .OrderBy(e => e.StartTime)
                .FirstOrDefaultAsync();
        }

        // Cleanup old entries (older than 24h)
        public async Task CleanupOldEntriesAsync()
        {
            var cutoff = DateTime.UtcNow.AddHours(-24);
            var old = await _context.ChannelScheduleEntries
                .Where(e => e.EndTime < cutoff)
                .ToListAsync();
            _context.ChannelScheduleEntries.RemoveRange(old);
            await _context.SaveChangesAsync();
        }
    }
}
