using ApplicationCore.Interfaces;
using Infrastructure.BackgroundServices;
using Infrastructure.Contexts;
using Infrastructure.Mappings;
using Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
        {
            MappingConfig.Configure();

            services.AddDbContext<NostalgiaTVContext>(options => options.UseSqlServer(configuration.GetConnectionString("DefaultConnection")));

            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<ISeriesService, SeriesService>();
            services.AddScoped<IEpisodeService, EpisodeService>();
            services.AddScoped<IChannelService, ChannelService>();
            services.AddScoped<IRolService, RolService>();
            services.AddScoped<IUserService, UserService>();
            services.AddScoped<IMenuService, MenuService>();

            services.AddHostedService<TokenCleanupService>();

            return services;
        }
    }
}
