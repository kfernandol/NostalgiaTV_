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
        private readonly FileUploadService _fileUploadService;

        public SeriesService(NostalgiaTVContext context, FileUploadService fileUploadService)
        {
            _context = context;
            _fileUploadService = fileUploadService;
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

            if (request.Logo != null)
                series.LogoPath = await _fileUploadService.UploadAsync(request.Logo, "series");

            _context.Series.Add(series);
            await _context.SaveChangesAsync();
            return series.Adapt<SeriesResponse>();
        }

        public async Task<SeriesResponse> UpdateAsync(int id, SeriesRequest request)
        {
            var series = await _context.Series.FindAsync(id)
                ?? throw new NotFoundException($"Series {id} not found");

            request.Adapt(series);

            if (request.Logo != null)
                series.LogoPath = await _fileUploadService.UploadAsync(request.Logo, "series");

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

        public async Task<SeriesResponse> AssignCategoriesAsync(int seriesId, List<int> categoryIds)
        {
            var series = await _context.Series
                .Include(s => s.Categories)
                .FirstOrDefaultAsync(s => s.Id == seriesId)
                ?? throw new NotFoundException($"Series {seriesId} not found");

            series.Categories = await _context.Categories
                .Where(c => categoryIds.Contains(c.Id))
                .ToListAsync();

            await _context.SaveChangesAsync();
            return series.Adapt<SeriesResponse>();
        }
    }
}
