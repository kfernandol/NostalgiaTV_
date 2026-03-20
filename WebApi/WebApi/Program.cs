
using ApplicationCore;
using Infrastructure;
using Serilog;
using WebApi.Extensions;

namespace WebApi
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            builder.Host.UseSerilog((context, config) => config.ReadFrom.Configuration(context.Configuration));

            // Add services to the container.
            builder.Services.AddControllers();
            builder.Services.AddApplicationCore(builder.Configuration);
            builder.Services.AddInfrastructure(builder.Configuration);
            builder.Services.AddApiVersioningConfig();
            builder.Services.AddRateLimitingConfig();
            builder.Services.AddJwtAuthentication(builder.Configuration);
            builder.Services.AddOpenApiConfig();
            builder.Services.AddExceptionHandling();
            builder.Services.AddValidationConfig();
            builder.Services.AddCorsConfig(builder.Configuration);

            var app = builder.Build();

            app.UseCors("DefaultPolicy");
            app.UseSerilogRequestLogging();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseOpenApiConfig();
            }

            app.UseExceptionHandler();
            app.UseHttpsRedirection();
            app.UseAuthentication();
            app.UseAuthorization();
            app.UseRateLimiter();
            app.MapControllers();
            app.Run();
        }
    }
}
