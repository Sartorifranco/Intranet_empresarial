import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout, PublicLayout } from '../components'
import {
  AdminAudit,
  AdminContent,
  AdminDashboard,
  AdminDirectory,
  AdminDriveLab,
  AdminResources,
  AdminShifts,
  AdminUsers,
  AppsHub,
  BoardList,
  BoardViewerPage,
  Directory,
  DriveDocumentViewerPage,
  Home,
  IntranetHub,
  Resources,
} from '../pages'
import { ProtectedRoute } from './ProtectedRoute'
import { AdminRoute } from './AdminRoute'
import { BoardsRoute } from './BoardsRoute'
import { SuperAdminRoute } from './SuperAdminRoute'
import { ModulePermissionRoute } from './ModulePermissionRoute'

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="login" element={<Navigate to="/" replace />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<BoardsRoute />}>
            <Route path="tableros/:boardId" element={<BoardViewerPage />} />
          </Route>

          <Route element={<ModulePermissionRoute permission="view_drive" module="resourcesEnabled" />}>
            <Route path="recursos/documento/:fileId" element={<DriveDocumentViewerPage />} />
          </Route>

          <Route element={<PublicLayout />}>
            <Route path="intranet" element={<IntranetHub />} />
            <Route path="accesos-directos" element={<AppsHub />} />
            <Route element={<ModulePermissionRoute permission="view_directory" module="directoryEnabled" />}>
              <Route path="directorio" element={<Directory />} />
            </Route>
            <Route element={<ModulePermissionRoute permission="view_drive" module="resourcesEnabled" />}>
              <Route path="recursos" element={<Resources />} />
              <Route path="mis-areas" element={<Navigate to="/recursos" replace />} />
            </Route>

            <Route element={<BoardsRoute />}>
              <Route path="tableros" element={<BoardList />} />
            </Route>
          </Route>

          <Route path="admin" element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="content" element={<AdminContent />} />
              <Route path="directory" element={<AdminDirectory />} />
              <Route path="shifts" element={<AdminShifts />} />
              <Route element={<ModulePermissionRoute permission="view_drive" module="resourcesEnabled" redirectTo="/admin" />}>
                <Route path="resources" element={<AdminResources />} />
                <Route path="drive-lab" element={<AdminDriveLab />} />
              </Route>
              <Route path="users" element={<AdminUsers />} />
              <Route element={<SuperAdminRoute />}>
                <Route path="auditoria" element={<AdminAudit />} />
              </Route>
              <Route path="usuarios" element={<Navigate to="/admin/users" replace />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
