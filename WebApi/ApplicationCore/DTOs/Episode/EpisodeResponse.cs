using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.DTOs.Episode
{
    public class EpisodeResponse
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string FilePath { get; set; } = string.Empty;
        public int Order { get; set; }
        public int SeriesId { get; set; }
    }
}
