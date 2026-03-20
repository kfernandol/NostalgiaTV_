using ApplicationCore.DTOs.Channel;
using ApplicationCore.Interfaces;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WebApi.Controllers
{
    [ApiController]
    [Authorize]
    [ApiVersion("1")]
    [Route("api/v{version:apiVersion}/channels")]
    public class ChannelController : ControllerBase
    {
        private readonly IChannelService _channelService;

        public ChannelController(IChannelService channelService) => _channelService = channelService;

        [HttpGet]
        public async Task<IActionResult> GetAll() => Ok(await _channelService.GetAllAsync());

        [HttpPost]
        public async Task<IActionResult> Create(ChannelRequest request) => Ok(await _channelService.CreateAsync(request));

        [HttpPut("{id}/series")]
        public async Task<IActionResult> AssignSeries(int id, AssignSeriesRequest request) => Ok(await _channelService.AssignSeriesAsync(id, request));
    }
}
