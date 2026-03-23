using ApplicationCore.DTOs.Channel;
using ApplicationCore.Interfaces;
using Asp.Versioning;
using Infrastructure.Contexts;
using Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WebApi.Controllers
{
    [ApiController]
    [ApiVersion("1")]
    [Route("api/v{version:apiVersion}/public")]
    public class PublicController : ControllerBase
    {
        private readonly IChannelService _channelService;
        private readonly ChannelBroadcastService _broadcastService;

        public PublicController(IChannelService channelService, ChannelBroadcastService broadcastService)
        {
            _channelService = channelService;
            _broadcastService = broadcastService;
        }

        [HttpGet("channels/{channelId}/state")]
        public async Task<IActionResult> GetChannelState(int channelId, [FromServices] NostalgiaTVContext context)
        {
            var state = _broadcastService.GetState(channelId);
            if (state == null) return NotFound();

            var episode = await context.Episodes
                .Include(e => e.Series)
                .FirstOrDefaultAsync(e => e.Id == state.CurrentEpisodeId);

            if (episode == null) return NotFound();

            return Ok(new ChannelStateResponse
            {
                ChannelId = channelId,
                EpisodeId = episode.Id,
                EpisodeTitle = episode.Title,
                FilePath = episode.FilePath!.Replace("wwwroot", "").Replace("\\", "/"),
                SeriesName = episode.Series.Name,
                SeriesLogoPath = episode.Series.LogoPath,
                CurrentSecond = state.CurrentSecond
            });
        }

        [HttpGet("channels")]
        public async Task<IActionResult> GetChannels() => Ok(await _channelService.GetAllAsync());
    }
}