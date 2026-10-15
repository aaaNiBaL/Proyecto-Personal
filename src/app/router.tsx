import { createBrowserRouter } from 'react-router-dom'
import { CatalogPage } from '../pages/CatalogPage'
import { AccountPage } from '../pages/AccountPage'
import { ContributionsPage } from '../pages/ContributionsPage'
import { HomePage } from '../pages/HomePage'
import { LibraryPage } from '../pages/LibraryPage'
import { MangaDetailPage } from '../pages/MangaDetailPage'
import { ModerationPage } from '../pages/ModerationPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { ProfileSettingsPage } from '../pages/ProfileSettingsPage'
import { PublicProfilePage } from '../pages/PublicProfilePage'
import { MangaListsPage } from '../pages/MangaListsPage'
import { PublicMangaListPage } from '../pages/PublicMangaListPage'
import { WikiPage } from '../pages/WikiPage'
import { CommunityPage } from '../pages/CommunityPage'
import { AccountSettingsPage } from '../pages/AccountSettingsPage'
import { EditProfilePage } from '../pages/EditProfilePage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/explorar',
    element: <CatalogPage />,
  },
  {
    path: '/wiki',
    element: <WikiPage />,
  },
  {
    path: '/comunidad',
    element: <CommunityPage />,
  },
  {
    path: '/manga/:id',
    element: <MangaDetailPage />,
  },
  {
    path: '/cuenta',
    element: <AccountPage />,
  },
  {
    path: '/biblioteca',
    element: <LibraryPage />,
  },
  {
    path: '/registro',
    element: <AccountPage />,
  },
  {
    path: '/usuario/:username',
    element: <PublicProfilePage />,
  },
  {
    path: '/listas/:id',
    element: <PublicMangaListPage />,
  },
  {
    path: '/listas',
    element: <MangaListsPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/contribuciones',
        element: <ContributionsPage />,
      },
      {
        path: '/moderacion',
        element: <ModerationPage />,
      },
      {
        path: '/perfil',
        element: <ProfileSettingsPage />,
      },
      {
        path: '/perfil/editar',
        element: <EditProfilePage />,
      },
      {
        path: '/ajustes',
        element: <AccountSettingsPage />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
