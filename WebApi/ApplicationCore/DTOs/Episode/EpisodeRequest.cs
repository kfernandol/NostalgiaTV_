using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.DTOs.Episode
{
    public class EpisodeRequest
    {
        public string Title { get; set; } = string.Empty;
        public string? FilePath { get; set; }
        public int Season { get; set; }
        public int EpisodeTypeId { get; set; } = 1;
        public int SeriesId { get; set; }
    }
}
