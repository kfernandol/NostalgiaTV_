using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.DTOs.Channel
{
    public class ChannelRequest
    {
        public string Name { get; set; } = string.Empty;
        public bool IsRandom { get; set; }
    }
}
