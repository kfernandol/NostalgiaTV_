using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Entities
{
    public class ChannelBroadcastState
    {
        public int ChannelId { get; set; }
        public int CurrentEpisodeId { get; set; }
        public double CurrentSecond { get; set; }
        public DateTime StartedAt { get; set; }
    }
}
