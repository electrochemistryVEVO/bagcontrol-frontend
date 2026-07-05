import axiosApi from './config/axios';

export type AuthResponse = {
    token: string;
    email: string;
    nombre: string;
    rol: string;
    aeropuerto: string;
};

export type AuthUser = {
    email: string;
    nombre: string;
    rol: string;
    aeropuerto: string;
};

const TOKEN_KEY = 'bagcontrol_token';
const USER_KEY  = 'bagcontrol_user';

const STORAGE_USER = 'bagcontrol_user';

export const AuthService = {
    async login(email: string, password: string): Promise<AuthResponse> {
        const { data } = await axiosApi.post<AuthResponse>('/auth/login', { email, password });
        AuthService.saveSession(data);
        return data;
    },

    async register(email: string, password: string, nombre: string): Promise<AuthResponse> {
        const { data } = await axiosApi.post<AuthResponse>('/auth/register', { email, password, nombre });
        AuthService.saveSession(data);
        return data;
    },

    async obtenerInfoSesion(): Promise<AuthUser> {
        const { data } = await axiosApi.get<AuthResponse>('/auth/me', {
            headers: { Authorization: `Bearer ${AuthService.getToken()}` },
        });
        const user: AuthUser = { email: data.email, nombre: data.nombre, rol: data.rol, aeropuerto: data.aeropuerto };
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        return user;
    },

    saveSession(data: AuthResponse) {
        localStorage.setItem(TOKEN_KEY, data.token);
        const user: AuthUser = { email: data.email, nombre: data.nombre, rol: data.rol, aeropuerto: data.aeropuerto };
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        document.cookie = `bagcontrol_token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    },

    getToken(): string | null {
        return localStorage.getItem(TOKEN_KEY);
    },

    getUser(): AuthUser | null {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    },

    isAuthenticated(): boolean {
        return !!AuthService.getToken();
    },

    updateUser(partial: Partial<AuthUser>) {
        const current = AuthService.getUser();
        if (!current) return;
        const updated = { ...current, ...partial };
        localStorage.setItem(USER_KEY, JSON.stringify(updated));
    },

    logout() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        document.cookie = 'bagcontrol_token=; path=/; max-age=0';
    },
};
