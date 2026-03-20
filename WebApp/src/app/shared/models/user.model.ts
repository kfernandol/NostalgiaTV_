import { RolResponse } from './rol.model';

export interface UserResponse {
    id: number;
    username: string;
    rol: RolResponse;
}

export interface UserRequest {
    username: string;
    password: string;
    rolId: number;
}
