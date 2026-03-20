using ApplicationCore.DTOs.Series;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces;
using Infrastructure.Contexts;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services
{
    public class SeriesService : ISeriesService
    {
        private readonly NostalgiaTVContext _context;

        public SeriesService(NostalgiaTVContext context)
        {
            _context = context;
        }

        public async Task<List<SeriesResponse>> GetAllAsync() => await _context.Series.ProjectToType<SeriesResponse>().ToListAsync();

        public async Task<SeriesResponse> GetByIdAsync(int id)
        {
            var series = await _context.Series.FindAsync(id)
                ?? throw new NotFoundException($"Series {id} not found");
            return series.Adapt<SeriesResponse>();
        }

        public async Task<SeriesResponse> CreateAsync(SeriesRequest request)
        {
            var series = request.Adapt<Series>();
            _context.Series.Add(series);
            await _context.SaveChangesAsync();
            return series.Adapt<SeriesResponse>();
        }

        public async Task<SeriesResponse> UpdateAsync(int id, SeriesRequest request)
        {
            var series = await _context.Series.FindAsync(id)
                ?? throw new NotFoundException($"Series {id} not found");
            request.Adapt(series);
            await _context.SaveChangesAsync();
            return series.Adapt<SeriesResponse>();
        }

        public async Task DeleteAsync(int id)
        {
            var series = await _context.Series.FindAsync(id)
                ?? throw new NotFoundException($"Series {id} not found");
            _context.Series.Remove(series);
            await _context.SaveChangesAsync();
        }
    }
}
