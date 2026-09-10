import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import {
  ProtectedRoute,
  AdminRoute,
  RequireCompleteProfile,
  ChairpersonRoute,
  PatronRoute,
  StaffOrAdminRoute,
} from './components/ProtectedRoute'
import RoleLanding from './pages/RoleLanding'
import HostelExplorer from './pages/HostelExplorer'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Profile from './pages/Profile'
import ApplyForRoom from './pages/ApplyForRoom'
import MyApplications from './pages/MyApplications'
import MyAccommodation from './pages/MyAccommodation'
import Finance from './pages/Finance'
import SubmitComplaint from './pages/SubmitComplaint'
import MyComplaints from './pages/MyComplaints'
import Announcements from './pages/Announcements'
import CreateAnnouncement from './pages/CreateAnnouncement'
import ReviewQueue from './pages/admin/ReviewQueue'
import PaymentVerificationQueue from './pages/admin/PaymentVerificationQueue'
import Roster from './pages/admin/Roster'
import AllComplaints from './pages/admin/AllComplaints'
import AllApplications from './pages/admin/AllApplications'
import Dashboard from './pages/admin/Dashboard'
import Inventory from './pages/admin/Inventory'
import UserManagement from './pages/admin/UserManagement'
import ChairpersonDashboard from './pages/chairperson/ChairpersonDashboard'
import PatronDashboard from './pages/patron/PatronDashboard'
import StudentDirectory from './pages/patron/StudentDirectory'
import PatronHub from './pages/patron/PatronHub'
import AllAnnouncements from './pages/admin/AllAnnouncements'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<RoleLanding />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route path="/accommodation/explore" element={<HostelExplorer />} />
        <Route
          path="/accommodation/apply"
          element={
            <RequireCompleteProfile>
              <ApplyForRoom />
            </RequireCompleteProfile>
          }
        />
        <Route
          path="/accommodation/applications"
          element={
            <ProtectedRoute>
              <MyApplications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accommodation/mine"
          element={
            <ProtectedRoute>
              <MyAccommodation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accommodation/finance"
          element={
            <ProtectedRoute>
              <Finance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accommodation/complaints"
          element={
            <ProtectedRoute>
              <MyComplaints />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accommodation/complaints/new"
          element={
            <ProtectedRoute>
              <SubmitComplaint />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accommodation/announcements"
          element={
            <ProtectedRoute>
              <Announcements />
            </ProtectedRoute>
          }
        />
        <Route
          path="/announcements/new"
          element={
            <StaffOrAdminRoute>
              <CreateAnnouncement />
            </StaffOrAdminRoute>
          }
        />

        <Route
          path="/chairperson/complaints"
          element={
            <ChairpersonRoute>
              <ChairpersonDashboard />
            </ChairpersonRoute>
          }
        />
        <Route
          path="/patron/complaints"
          element={
            <PatronRoute>
              <PatronDashboard />
            </PatronRoute>
          }
        />
        <Route
          path="/patron/dashboard"
          element={
            <PatronRoute>
              <PatronHub />
            </PatronRoute>
          }
        />
        <Route
          path="/patron/applications"
          element={
            <PatronRoute>
              <ReviewQueue />
            </PatronRoute>
          }
        />
        <Route
          path="/patron/directory"
          element={
            <PatronRoute>
              <StudentDirectory />
            </PatronRoute>
          }
        />
        <Route
          path="/patron/payments"
          element={
            <PatronRoute>
              <PaymentVerificationQueue />
            </PatronRoute>
          }
        />

        <Route
          path="/admin/applications"
          element={
            <AdminRoute>
              <ReviewQueue />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/payments"
          element={
            <AdminRoute>
              <PaymentVerificationQueue />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/roster"
          element={
            <AdminRoute>
              <Roster />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/complaints"
          element={
            <AdminRoute>
              <AllComplaints />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/all-applications"
          element={
            <AdminRoute>
              <AllApplications />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <AdminRoute>
              <Dashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <AdminRoute>
              <Inventory />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <UserManagement />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/announcements"
          element={
            <AdminRoute>
              <AllAnnouncements />
            </AdminRoute>
          }
        />

        <Route path="*" element={<ComingSoon />} />
      </Routes>
    </Layout>
  )
}

function ComingSoon() {
  return (
    <div className="max-w-md mx-auto card p-6 text-center mt-12">
      <h1 className="text-lg mb-2">Coming soon</h1>
      <p className="text-sm text-body/70">
        This part of the Accommodation section ships in a later phase. Try{' '}
        <span className="font-medium text-heading">Find a Room</span> in the sidebar.
      </p>
    </div>
  )
}
