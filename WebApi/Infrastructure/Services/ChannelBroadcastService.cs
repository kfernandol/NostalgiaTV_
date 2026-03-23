using ApplicationCore.DTOs.Channel;
using ApplicationCore.Entities;
using Infrastructure.Contexts;
using Infrastructure.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services
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

                _playlists[channel.Id] = episodes;
                _states[channel.Id] = new ChannelBroadcastState
                {
                    ChannelId = channel.Id,
                    CurrentEpisodeId = episodes[0].Id,
                    CurrentSecond = 0,
                    StartedAt = DateTime.UtcNow
                };
            }
        }

        private async Task BroadcastStates()
        {
            foreach (var (channelId, state) in _states)
            {
                state.CurrentSecond = (DateTime.UtcNow - state.StartedAt).TotalSeconds;

                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();

                var episode = await context.Episodes
                    .Include(e => e.Series)
                    .FirstOrDefaultAsync(e => e.Id == state.CurrentEpisodeId);

                if (episode == null) continue;

                var response = new ChannelStateResponse
                {
                    ChannelId = channelId,
                    EpisodeId = episode.Id,
                    EpisodeTitle = episode.Title,
                    FilePath = episode.FilePath!.Replace("wwwroot", "").Replace("\\", "/"),
                    SeriesName = episode.Series.Name,
                    SeriesLogoPath = episode.Series.LogoPath,
                    CurrentSecond = state.CurrentSecond
                };

                await _hubContext.Clients.Group($"channel-{channelId}")
                    .SendAsync("ChannelState", response);
            }
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
    }
}