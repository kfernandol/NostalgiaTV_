using ApplicationCore.DTOs.Channel;
using ApplicationCore.DTOs.Rol;
using ApplicationCore.DTOs.Series;
using ApplicationCore.Entities;
using Mapster;
using System;
using System.Collections.Generic;
using System.Text;

namespace Infrastructure.Mappings
{
    public static class MappingConfig
    {
        public static void Configure()
        {
            TypeAdapterConfig<Channel, ChannelResponse>.NewConfig()
                .Map(dest => dest.SeriesIds, src => src.Series.Select(s => s.Id).ToList());

            TypeAdapterConfig<SeriesRequest, Series>.NewConfig()
                .Map(dest => dest.StartDate, src => DateOnly.FromDateTime(src.StartDate))
                .Map(dest => dest.EndDate, src => src.EndDate.HasValue ? DateOnly.FromDateTime(src.EndDate.Value) : (DateOnly?)null);

            TypeAdapterConfig<Series, SeriesResponse>.NewConfig()
                .Map(dest => dest.CategoryIds, src => src.Categories.Select(c => c.Id).ToList())
                .Map(dest => dest.StartDate, src => src.StartDate.ToString("yyyy-MM-dd"))
                .Map(dest => dest.EndDate, src => src.EndDate.HasValue ? src.EndDate.Value.ToString("yyyy-MM-dd") : null);

            TypeAdapterConfig<Rol, RolResponse>.NewConfig()
                .Map(dest => dest.MenuIds, src => src.Menus.Select(m => m.Id).ToList());
        }
    }
}
