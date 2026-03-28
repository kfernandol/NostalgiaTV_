using ApplicationCore.DTOs.Channel;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces;
using Infrastructure.BackgroundServices;
using Infrastructure.Contexts;
using Infrastructure.Services.InternalServices;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services
{
    public class ChannelService : IChannelService
    {
        private readonly NostalgiaTVContext _context;
        private readonly FileUploadService _fileUploadService;
        private readonly ChannelBroadcastService _broadcastService;

        public ChannelService(NostalgiaTVContext context, FileUploadService fileUploadService, ChannelBroadcastService broadcastService)
        {
            _context = context;
            _fileUploadService = fileUploadService;
            _broadcastService = broadcastService;
        }

        public async Task<List<ChannelResponse>> GetAllAsync() => await _context.Channels.Include(c => c.Series)
        .ProjectToType<ChannelResponse>().ToListAsync();

        public async Task<ChannelResponse> CreateAsync(ChannelRequest request)
        {
            string logoPath = string.Empty;

            if(request.Logo != null)
                logoPath = await _fileUploadService.UploadAsync(request.Logo, "channels");

            var channel = new Channel
            {
                Name = request.Name,
                LogoPath = logoPath,
                History = request.History,
                StartDate = request.StartDate,
                EndDate = request.EndDate
            };
            _context.Channels.Add(channel);
            await _context.SaveChangesAsync();
            return channel.Adapt<ChannelResponse>();
        }

        public async Task<ChannelResponse> AssignSeriesAsync(int channelId, AssignSeriesRequest request)
        {
            var channel = await _context.Channels
                .Include(c => c.Series)
                .FirstOrDefaultAsync(c => c.Id == channelId)
                ?? throw new NotFoundException($"Channel {channelId} not found");

            channel.Series = await _context.Series
                .Where(s => request.SeriesIds.Contains(s.Id))
                .ToListAsync();

            await _context.SaveChangesAsync();
            await _broadcastService.ReloadChannelAsync(channelId);
            return channel.Adapt<ChannelResponse>();
        }

        public async Task<ChannelResponse> UpdateAsync(int id, ChannelRequest request)
        {
            var channel = await _context.Channels.FindAsync(id)
                ?? throw new NotFoundException($"Channel {id} not found");

            channel.Name = request.Name;
            channel.History = request.History;
            channel.StartDate = request.StartDate;
            channel.EndDate = request.EndDate;

            if (request.Logo != null)
                channel.LogoPath = await _fileUploadService.UploadAsync(request.Logo, "channels");

            await _context.SaveChangesAsync();
            return channel.Adapt<ChannelResponse>();
        }
    }
}
