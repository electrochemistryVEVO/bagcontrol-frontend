import axios from 'axios';

const axiosApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api",
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default axiosApi;