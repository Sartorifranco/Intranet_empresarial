import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout, PublicLayout } from '../components'
import {
  AdminContent,
  AdminDashboard,
  AdminDirectory,
  AdminResources,
  AdminShifts,
  AdminUsers,
  AppsHub,
  Directory,
  Home,
  IntranetHub,
  Resources,
} from '../pages'
import { ProtectedRoute } from './ProtectedRoute'
import { AdminRoute } from './AdminRoute'
import { ModulePermissionRoute } from './ModulePermissionRoute'

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="login" element={<Navigate to="/" replace />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<PublicLayout />}>
            <Route path="intranet" element={<IntranetHub />} />
            <Route path="accesos-directos" element={<AppsHub />} />
            <Route element={<ModulePermissionRoute permission="view_directory" module="directoryEnabled" />}>
              <Route path="directorio" element={<Directory />} />
            </Route>
            <Route element={<ModulePermissionRoute permission="view_drive" module="resourcesEnabled" />}>
              <Route path="recursos" element={<Resources />} />
            </Route>
          </Route>

          <Route path="admin" element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="content" element={<AdminContent />} />
              <Route path="directory" element={<AdminDirectory />} />
              <Route path="shifts" element={<AdminShifts />} />
              <Route path="resources" element={<AdminResources />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="usuarios" element={<Navigate to="/admin/users" replace />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
