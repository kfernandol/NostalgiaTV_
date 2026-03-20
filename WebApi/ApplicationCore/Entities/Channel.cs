using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Entities
{
    public class Channel
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool IsRandom { get; set; }
        public ICollection<Series> Series { get; set; } = [];
        public ChannelState? State { get; set; }
    }
}
