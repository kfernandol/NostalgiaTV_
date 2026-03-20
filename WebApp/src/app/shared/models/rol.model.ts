import { MenuResponse } from './menu.model';

export interface RolResponse {
    id: number;
    name: string;
    description: string;
    menus: MenuResponse[];
}

export interface RolRequest {
    name: string;
    description: string;
    menuIds: number[];
}
