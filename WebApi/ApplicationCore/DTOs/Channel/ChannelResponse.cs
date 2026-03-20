using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.DTOs.Channel
{
    public class ChannelResponse
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool IsRandom { get; set; }
        public List<int> SeriesIds { get; set; } = [];
    }
}
