using ApplicationCore.DTOs.Rol;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces;
using Infrastructure.Contexts;
using Mapster;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace Infrastructure.Services
{
    public class RolService : IRolService
    {
        private readonly NostalgiaTVContext _context;

        public RolService(NostalgiaTVContext context) => _context = context;

        public async Task<List<RolResponse>> GetAllAsync() =>
            await _context.Roles
                .Include(r => r.Menus)
                .ProjectToType<RolResponse>()
                .ToListAsync();

        public async Task<RolResponse> CreateAsync(RolRequest request)
        {
            var menus = await _context.Menus
                .Where(m => request.MenuIds.Contains(m.Id))
                .ToListAsync();

            var rol = new Rol
            {
                Name = request.Name,
                Description = request.Description,
                Menus = menus
            };

            _context.Roles.Add(rol);
            await _context.SaveChangesAsync();
            return rol.Adapt<RolResponse>();
        }

        public async Task<RolResponse> UpdateAsync(int id, RolRequest request)
        {
            var rol = await _context.Roles
                .Include(r => r.Menus)
                .FirstOrDefaultAsync(r => r.Id == id)
                ?? throw new NotFoundException($"Rol {id} not found");

            rol.Name = request.Name;
            rol.Description = request.Description;
            rol.Menus = await _context.Menus
                .Where(m => request.MenuIds.Contains(m.Id))
                .ToListAsync();

            await _context.SaveChangesAsync();
            return rol.Adapt<RolResponse>();
        }

        public async Task DeleteAsync(int id)
        {
            var rol = await _context.Roles.FindAsync(id)
                ?? throw new NotFoundException($"Rol {id} not found");
            _context.Roles.Remove(rol);
            await _context.SaveChangesAsync();
        }
    }
}
