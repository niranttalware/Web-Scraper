const API_BASE = 'http://localhost:5000/api';

export const setToken = (token, user = null, rememberMe = true) => {
  if (token) {
    const storage = rememberMe ? localStorage : sessionStorage;
    // Clear the other storage just in case
    (rememberMe ? sessionStorage : localStorage).removeItem('authToken');
    (rememberMe ? sessionStorage : localStorage).removeItem('user');
    
    storage.setItem('authToken', token);
    if (user) storage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('user');
  }
};

export const getToken = () => localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

export const getUser = () => {
  try {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const registerUser = async (email, fullName, password, rememberMe = true) => {
  const response = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, full_name: fullName, password }),
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Registration failed');
  }
  
  setToken(data.token, data.user, rememberMe);
  return data.user;
};

export const loginUser = async (email, password, rememberMe = true) => {
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }
  
  setToken(data.token, data.user, rememberMe);
  return data.user;
};

export const validateToken = async () => {
  const token = getToken();
  if (!token) throw new Error('No token');
  
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  if (!response.ok) {
    setToken(null);
    throw new Error(data.error || 'Token invalid');
  }
  
  return data.user;
};
