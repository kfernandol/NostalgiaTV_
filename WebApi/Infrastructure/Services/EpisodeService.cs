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
                .Include(e => e.EpisodeType)
                .OrderBy(e => e.Season)
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

            await _context.Entry(episode).Reference(e => e.EpisodeType).LoadAsync();
            return episode.Adapt<EpisodeResponse>();
        }

        public async Task<EpisodeResponse> UpdateAsync(int id, UpdateEpisodeTypeRequest request)
        {
            var episode = await _context.Episodes
                .Include(e => e.EpisodeType)
                .FirstOrDefaultAsync(e => e.Id == id)
                ?? throw new NotFoundException($"Episode {id} not found");

            episode.EpisodeTypeId = request.EpisodeTypeId;
            await _context.SaveChangesAsync();

            // Reload to get updated EpisodeType name
            await _context.Entry(episode).Reference(e => e.EpisodeType).LoadAsync();
            return episode.Adapt<EpisodeResponse>();
        }
    }
}
