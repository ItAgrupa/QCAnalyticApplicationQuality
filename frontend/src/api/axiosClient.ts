import axios from 'axios'

const axiosClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach bearer token and active company to every request
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  const companyRaw = localStorage.getItem('active_company')
  if (companyRaw) {
    try {
      const company = JSON.parse(companyRaw)
      if (company?.id) config.headers['X-Company-Id'] = String(company.id)
    } catch {
      // ignore JSON parse errors
    }
  }
  return config
})

// On 401 — clear auth and send the user back to login.
// If the browser is already on /login we skip the redirect so the page can
// show the error message instead of silently reloading.
axiosClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
      window.location.replace('/login')
    }
    return Promise.reject(error)
  },
)

export default axiosClient
