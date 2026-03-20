using ApplicationCore.Entities;
using Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace Infrastructure.Contexts
{
    public class NostalgiaTVContext : DbContext
    {
        public NostalgiaTVContext(DbContextOptions<NostalgiaTVContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Rol> Roles { get; set; }
        public DbSet<Menu> Menus { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<Series> Series { get; set; }
        public DbSet<Episode> Episodes { get; set; }
        public DbSet<Channel> Channels { get; set; }
        public DbSet<ChannelState> ChannelStates { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Menu>()
                .HasMany(m => m.Roles)
                .WithMany(r => r.Menus)
                .UsingEntity("MenuRol");

            // Seed Rol
            modelBuilder.Entity<Rol>().HasData(new Rol
            {
                Id = 1,
                Name = "Administrador",
                Description = "Full access"
            });

            // Seed Menus - grupos padre
            modelBuilder.Entity<Menu>().HasData(
                // Grupos padre (sin URL, solo agrupadores)
                new Menu { Id = 2, Name = "Seguridad", Caption = "SEGURIDAD", Icon = "security", Url = "", IsVisible = true, SortOrder = 1 },
                new Menu { Id = 1, Name = "Contenido", Caption = "CONTENIDO", Icon = "movie", Url = "", IsVisible = true, SortOrder = 2 },

                // Hijos de Seguridad
                new Menu { Id = 6, Name = "Roles", Caption = "Roles", Icon = "admin_panel_settings", Url = "/dashboard/roles", IsVisible = true, SortOrder = 1, ParentId = 2 },
                new Menu { Id = 7, Name = "Users", Caption = "Usuarios", Icon = "people", Url = "/dashboard/users", IsVisible = true, SortOrder = 2, ParentId = 2 },

                // Hijos de Contenido
                new Menu { Id = 3, Name = "Series", Caption = "Series", Icon = "movie", Url = "/dashboard/series", IsVisible = true, SortOrder = 1, ParentId = 1 },
                new Menu { Id = 4, Name = "Episodes", Caption = "Episodios", Icon = "video_library", Url = "/dashboard/episodes", IsVisible = true, SortOrder = 2, ParentId = 1 },
                new Menu { Id = 5, Name = "Channels", Caption = "Canales", Icon = "live_tv", Url = "/dashboard/channels", IsVisible = true, SortOrder = 3, ParentId = 1 }

            );

            modelBuilder.Entity("MenuRol").HasData(
                new { MenusId = 1, RolesId = 1 },
                new { MenusId = 2, RolesId = 1 },
                new { MenusId = 3, RolesId = 1 },
                new { MenusId = 4, RolesId = 1 },
                new { MenusId = 5, RolesId = 1 },
                new { MenusId = 6, RolesId = 1 },
                new { MenusId = 7, RolesId = 1 }
            );

            // Seed User
            modelBuilder.Entity<User>().HasData(new User
            {
                Id = 1,
                Username = "admin",
                PasswordHash = "kvfEh9DsfvFzJseLEA3QIQ==:WSdzlu6ve0AiOFTunKWVTMgQNnCtxd7F8xkEamSy+4Y=",
                RolId = 1
            });
        }
    }
}
