import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Logo from './components/Logo';
import Login from './pages/Login';
import ParkingView from './pages/ParkingView';
import MyBookings from './pages/MyBookings';
import FloorEditor from './pages/admin/FloorEditor';
import AdminBookings from './pages/admin/AdminBookings';
import Metrics from './pages/admin/Metrics';

function Protected({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function Nav() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <nav className="topnav">
      <div className="brand">
        <Logo size={22} />
        <span className="brand-med">MED</span>
        <span className="brand-square">SQUARE</span>
        <span className="brand-app">Parking</span>
      </div>
      <div className="nav-links">
        <NavLink to="/">Parking Map</NavLink>
        <NavLink to="/my-bookings">My Bookings</NavLink>
        {user.role === 'admin' && (
          <>
            <NavLink to="/admin/floors">Floor Designer</NavLink>
            <NavLink to="/admin/bookings">All Bookings</NavLink>
            <NavLink to="/admin/metrics">Metrics</NavLink>
          </>
        )}
      </div>
      <div className="nav-user">
        <span>
          {user.name} <em>({user.role})</em>
        </span>
        <button className="btn btn-ghost" onClick={logout}>
          Logout
        </button>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <>
      <Nav />
      <main className="content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <Protected>
                <ParkingView />
              </Protected>
            }
          />
          <Route
            path="/my-bookings"
            element={
              <Protected>
                <MyBookings />
              </Protected>
            }
          />
          <Route
            path="/admin/floors"
            element={
              <Protected adminOnly>
                <FloorEditor />
              </Protected>
            }
          />
          <Route
            path="/admin/bookings"
            element={
              <Protected adminOnly>
                <AdminBookings />
              </Protected>
            }
          />
          <Route
            path="/admin/metrics"
            element={
              <Protected adminOnly>
                <Metrics />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
