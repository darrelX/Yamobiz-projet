import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

import Dashboard from './pages/Dashboard'
import Sales from './pages/Sales'
import Stock from './pages/Stock'
import Credits from './pages/Credits'
import Reports from './pages/Reports'
import Simulator from './pages/Simulator'

import Layout from './components/Layout'


function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (!user) return <Navigate to="/login" replace />

  return children
}


function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (user) return <Navigate to="/dashboard" replace />

  return children
}


export default function App() {

  return (

    <BrowserRouter>

      <AuthProvider>

        <Routes>


          {/* Pages publiques */}

          <Route
            path="/"
            element={<Landing />}
          />


          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />


          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />


          {/* Password reset */}

          <Route
            path="/forgot-password"
            element={<ForgotPassword />}
          />


          <Route
            path="/reset-password"
            element={<ResetPassword />}
          />



          {/* Pages privées */}

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >

            <Route
              path="dashboard"
              element={<Dashboard />}
            />

            <Route
              path="sales"
              element={<Sales />}
            />

            <Route
              path="stock"
              element={<Stock />}
            />

            <Route
              path="credits"
              element={<Credits />}
            />

            <Route
              path="reports"
              element={<Reports />}
            />

            <Route
              path="simulator"
              element={<Simulator />}
            />

          </Route>



          {/* Page inexistante */}

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />


        </Routes>

      </AuthProvider>

    </BrowserRouter>

  )
}