import axiosApi from './config/axios';

export type AuthResponse = {
    token: string;
    email: string;
    nombre: string;
};

const TOKEN_KEY = 'bagcontrol_token';
const USER_KEY  = 'bagcontrol_user';

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

    saveSession(data: AuthResponse) {
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify({ email: data.email, nombre: data.nombre }));
        document.cookie = `bagcontrol_token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    },

    getToken(): string | null {
        return localStorage.getItem(TOKEN_KEY);
    },

    getUser(): { email: string; nombre: string } | null {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    },

    isAuthenticated(): boolean {
        return !!AuthService.getToken();
    },

    logout() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        document.cookie = 'bagcontrol_token=; path=/; max-age=0';
    },
};
