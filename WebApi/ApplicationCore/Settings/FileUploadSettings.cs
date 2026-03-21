using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Settings
{
    public class FileUploadSettings
    {
        public int MaxFileSizeMB { get; set; } = 5;
        public string[] AllowedExtensions { get; set; } = [".jpg", ".jpeg", ".png", ".webp"];
        public string StoragePath { get; set; } = "wwwroot/uploads/channels";
    }
}
