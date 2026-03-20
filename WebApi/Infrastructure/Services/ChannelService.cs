using ApplicationCore.DTOs.Channel;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces;
using Infrastructure.Contexts;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services
{
    public class ChannelService : IChannelService
    {
        private readonly NostalgiaTVContext _context;

        public ChannelService(NostalgiaTVContext context) => _context = context;

        public async Task<List<ChannelResponse>> GetAllAsync() => await _context.Channels.Include(c => c.Series)
        .ProjectToType<ChannelResponse>().ToListAsync();

        public async Task<ChannelResponse> CreateAsync(ChannelRequest request)
        {
            var channel = request.Adapt<Channel>();
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
            return channel.Adapt<ChannelResponse>();
        }
    }
}
