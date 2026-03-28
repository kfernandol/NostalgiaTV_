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
                    StartTime = e.StartTime,
                    EndTime = e.EndTime,
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

            // Get episodes already used in the last 24h to avoid repeating
            var recentlyUsed = await _context.ChannelScheduleEntries
                .Where(e => e.ChannelId == channelId && e.StartTime >= DateTime.UtcNow.AddHours(-24))
                .Select(e => e.EpisodeId)
                .ToHashSetAsync();

            var random = new Random();
            var current = from;
            var newEntries = new List<ChannelScheduleEntry>();
            int? lastEpisodeId = null;

            while (current < until)
            {
                // Prefer episodes not used in last 24h and not the same as last
                var pool = episodes
                    .Where(e => e.Id != lastEpisodeId && !recentlyUsed.Contains(e.Id))
                    .ToList();

                // If no fresh episodes available, allow repeats but still avoid consecutive
                if (!pool.Any())
                {
                    pool = episodes.Where(e => e.Id != lastEpisodeId).ToList();
                    recentlyUsed.Clear(); // Reset the recent list
                }

                // Last resort: any episode
                if (!pool.Any()) pool = episodes;

                var episode = pool[random.Next(pool.Count)];
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
                current = end;
            }

            _context.ChannelScheduleEntries.AddRange(newEntries);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Generated {count} schedule entries for channel {id}", newEntries.Count, channelId);
        }

        // Called by ChannelBroadcastService to get current and next entry
        public async Task<ChannelScheduleEntry?> GetCurrentEntryAsync(int channelId)
        {
            var now = DateTime.UtcNow;
            await EnsureScheduleGeneratedAsync(channelId, now.AddHours(24));

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
