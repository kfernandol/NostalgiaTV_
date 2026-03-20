using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Entities
{
    public class Series
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string? Description { get; set; }

        public ICollection<Episode> Episodes { get; set; } = [];
        public ICollection<Channel> Channels { get; set; } = [];
    }
}
