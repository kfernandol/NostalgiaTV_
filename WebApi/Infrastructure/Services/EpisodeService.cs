using ApplicationCore.DTOs.Episode;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces;
using Infrastructure.Contexts;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services
{
    public class EpisodeService : IEpisodeService
    {
        private readonly NostalgiaTVContext _context;

        public EpisodeService(NostalgiaTVContext context) => _context = context;

        public async Task<List<EpisodeResponse>> GetBySeriesAsync(int seriesId)
        {
            var exists = await _context.Series.AnyAsync(s => s.Id == seriesId);
            if (!exists) throw new NotFoundException($"Series {seriesId} not found");

            return await _context.Episodes
                .Where(e => e.SeriesId == seriesId)
                .OrderBy(e => e.Order)
                .ProjectToType<EpisodeResponse>()
                .ToListAsync();
        }

        public async Task<EpisodeResponse> CreateAsync(EpisodeRequest request)
        {
            var exists = await _context.Series.AnyAsync(s => s.Id == request.SeriesId);
            if (!exists) throw new NotFoundException($"Series {request.SeriesId} not found");

            var episode = request.Adapt<Episode>();
            _context.Episodes.Add(episode);
            await _context.SaveChangesAsync();
            return episode.Adapt<EpisodeResponse>();
        }
    }
}
