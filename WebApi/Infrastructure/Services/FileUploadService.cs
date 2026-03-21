using ApplicationCore.Exceptions;
using ApplicationCore.Settings;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Text;

namespace Infrastructure.Services
{
    public class FileUploadService
    {
        private readonly FileUploadSettings _settings;

        public FileUploadService(IOptions<FileUploadSettings> settings)
        {
            _settings = settings.Value;
        }

        public async Task<string> UploadAsync(IFormFile file)
        {
            var maxBytes = _settings.MaxFileSizeMB * 1024 * 1024;
            if (file.Length > maxBytes)
                throw new BadRequestException($"File size exceeds the maximum allowed size of {_settings.MaxFileSizeMB}MB.");

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!_settings.AllowedExtensions.Contains(ext))
                throw new BadRequestException($"File type '{ext}' is not allowed.");

            var fileName = $"{Guid.NewGuid()}{ext}";
            var fullPath = Path.Combine(_settings.StoragePath, fileName);

            Directory.CreateDirectory(_settings.StoragePath);

            using var stream = new FileStream(fullPath, FileMode.Create);
            await file.CopyToAsync(stream);

            return $"/uploads/channels/{fileName}";
        }
    }
}
