using ApplicationCore.DTOs.Channel;
using ApplicationCore.Entities;
using ApplicationCore.Models;
using Infrastructure.Contexts;
using Infrastructure.Helpers;
using Infrastructure.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.BackgroundServices
{
    public class ChannelBroadcastService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHubContext<ChannelHub> _hubContext;
        private readonly ILogger<ChannelBroadcastService> _logger;

        // In-memory state per channel
        private readonly Dictionary<int, ChannelBroadcastState> _states = new();
        private readonly Dictionary<int, List<Episode>> _playlists = new();

        public ChannelBroadcastService(
            IServiceScopeFactory scopeFactory,
            IHubContext<ChannelHub> hubContext,
            ILogger<ChannelBroadcastService> logger)
        {
            _scopeFactory = scopeFactory;
            _hubContext = hubContext;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await InitializeStates();

            while (!stoppingToken.IsCancellationRequested)
            {
                await BroadcastStates();
                await Task.Delay(1000, stoppingToken);
            }
        }

        private async Task InitializeStates()
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();

            var channels = await context.Channels
                .Include(c => c.Series)
                .ToListAsync();

            _logger.LogInformation("Found {count} channels", channels.Count);

            foreach (var channel in channels)
            {
                var seriesIds = channel.Series.Select(s => s.Id).ToList();
                _logger.LogInformation("Channel {id} has series: {series}", channel.Id, string.Join(",", seriesIds));

                var episodes = await context.Episodes
                    .Include(e => e.Series)
                    .Where(e => seriesIds.Contains(e.SeriesId) && e.FilePath != null)
                    .OrderBy(e => e.SeriesId)
                    .ThenBy(e => e.Season)
                    .ThenBy(e => e.Id)
                    .ToListAsync();

                _logger.LogInformation("Channel {id} has {count} episodes", channel.Id, episodes.Count);

                if (!episodes.Any()) continue;

                var firstEpisode = episodes[0];
                var duration = await VideoHelper.GetVideoDurationAsync(firstEpisode.FilePath!);

                _playlists[channel.Id] = episodes;
                _states[channel.Id] = new ChannelBroadcastState
                {
                    ChannelId = channel.Id,
                    CurrentEpisodeId = firstEpisode.Id,
                    CurrentSecond = 0,
                    StartedAt = DateTime.UtcNow,
                    DurationSeconds = duration
                };
            }
        }

        private async Task BroadcastStates()
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();

            foreach (var (channelId, state) in _states)
            {
                state.CurrentSecond = (DateTime.UtcNow - state.StartedAt).TotalSeconds;

                // Advance to next episode if current one ended
                if (state.CurrentSecond >= state.DurationSeconds)
                    await AdvanceEpisodeAsync(channelId, state);

                var episode = await context.Episodes
                    .Include(e => e.Series)
                    .FirstOrDefaultAsync(e => e.Id == state.CurrentEpisodeId);

                if (episode == null) continue;

                var playlist = _playlists[channelId];
                var currentIndex = playlist.FindIndex(e => e.Id == state.CurrentEpisodeId);
                var nextEpisode = playlist.ElementAtOrDefault(currentIndex + 1) ?? playlist[0];

                var response = new ChannelStateResponse
                {
                    ChannelId = channelId,
                    EpisodeId = episode.Id,
                    EpisodeTitle = episode.Title,
                    FilePath = episode.FilePath!.Replace("wwwroot", "").Replace("\\", "/"),
                    SeriesName = episode.Series.Name,
                    SeriesLogoPath = episode.Series.LogoPath,
                    CurrentSecond = state.CurrentSecond,
                    // NEW
                    NextEpisodeId = nextEpisode.Id,
                    NextEpisodeTitle = nextEpisode.Title,
                    SecondsUntilNext = state.DurationSeconds - state.CurrentSecond
                };

                await _hubContext.Clients.Group($"channel-{channelId}")
                    .SendAsync("ChannelState", response);
            }
        }

        private async Task AdvanceEpisodeAsync(int channelId, ChannelBroadcastState state)
        {
            var playlist = _playlists[channelId];
            var currentIndex = playlist.FindIndex(e => e.Id == state.CurrentEpisodeId);
            var next = playlist.ElementAtOrDefault(currentIndex + 1) ?? playlist[0];

            var duration = await VideoHelper.GetVideoDurationAsync(next.FilePath!);

            state.CurrentEpisodeId = next.Id;
            state.CurrentSecond = 0;
            state.StartedAt = DateTime.UtcNow;
            state.DurationSeconds = duration;

            _logger.LogInformation("Channel {id} advanced to episode {episodeId}", channelId, next.Id);
        }

        public ChannelBroadcastState? GetState(int channelId) =>
            _states.TryGetValue(channelId, out var state) ? state : null;

        public Episode? GetCurrentEpisode(int channelId)
        {
            if (!_states.TryGetValue(channelId, out var state)) return null;
            if (!_playlists.TryGetValue(channelId, out var playlist)) return null;
            return playlist.FirstOrDefault(e => e.Id == state.CurrentEpisodeId);
        }

        public async Task ReloadChannelAsync(int channelId)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();

            var channel = await context.Channels
                .Include(c => c.Series)
                .FirstOrDefaultAsync(c => c.Id == channelId);

            if (channel == null) return;

            var seriesIds = channel.Series.Select(s => s.Id).ToList();
            var episodes = await context.Episodes
                .Include(e => e.Series)
                .Where(e => seriesIds.Contains(e.SeriesId) && e.FilePath != null)
                .OrderBy(e => e.SeriesId)
                .ThenBy(e => e.Season)
                .ThenBy(e => e.Id)
                .ToListAsync();

            if (!episodes.Any())
            {
                _states.Remove(channelId);
                _playlists.Remove(channelId);
                return;
            }

            _playlists[channelId] = episodes;
            _states[channelId] = new ChannelBroadcastState
            {
                ChannelId = channelId,
                CurrentEpisodeId = episodes[0].Id,
                CurrentSecond = 0,
                StartedAt = DateTime.UtcNow
            };
        }

        public async Task<ChannelStateResponse?> GetStateResponseAsync(int channelId)
        {
            var state = GetState(channelId);
            if (state == null) return null;

            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();

            var episode = await context.Episodes
                .Include(e => e.Series)
                .FirstOrDefaultAsync(e => e.Id == state.CurrentEpisodeId);

            if (episode == null) return null;

            return new ChannelStateResponse
            {
                ChannelId = channelId,
                EpisodeId = episode.Id,
                EpisodeTitle = episode.Title,
                FilePath = episode.FilePath!.Replace("wwwroot", "").Replace("\\", "/"),
                SeriesName = episode.Series.Name,
                SeriesLogoPath = episode.Series.LogoPath,
                CurrentSecond = state.CurrentSecond
            };
        }
    }
}