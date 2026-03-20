using ApplicationCore.DTOs.Channel;
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
        }
    }
}
