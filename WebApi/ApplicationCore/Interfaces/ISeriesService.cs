using ApplicationCore.DTOs.Series;
using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Interfaces
{
    public interface ISeriesService
    {
        Task<List<SeriesResponse>> GetAllAsync();
        Task<SeriesResponse> GetByIdAsync(int id);
        Task<SeriesResponse> CreateAsync(SeriesRequest request);
        Task<SeriesResponse> UpdateAsync(int id, SeriesRequest request);
        Task DeleteAsync(int id);
    }
}
