import {
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { auth } from '../services/firebase'
import {
  ensureGoogleUserProfile,
  ensureSuperAdminPermissions,
  getUserProfile,
  type UserProfile,
} from '../services/userService'

const GOOGLE_TOKEN_STORAGE_KEY = 'googleToken'

interface AuthContextValue {
  user: User | null
  userProfile: UserProfile | null
  googleAccessToken: string | null
  loading: boolean
  profileLoading: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  loginWithGoogle: (rememberMe?: boolean) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() =>
    sessionStorage.getItem(GOOGLE_TOKEN_STORAGE_KEY),
  )
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  const loadProfile = useCallback(async (uid: string, email?: string | null) => {
    setProfileLoading(true)
    try {
      await ensureSuperAdminPermissions(uid, email)
      const profile = await getUserProfile(uid)
      setUserProfile(profile)
    } catch (err) {
      console.error('Error al cargar el perfil de usuario:', err)
      setUserProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    await loadProfile(user.uid, user.email)
  }, [user, loadProfile])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)

      if (currentUser) {
        await loadProfile(currentUser.uid, currentUser.email)
      } else {
        setUserProfile(null)
        setProfileLoading(false)
        sessionStorage.removeItem(GOOGLE_TOKEN_STORAGE_KEY)
        setGoogleAccessToken(null)
      }

      setLoading(false)
    })

    return unsubscribe
  }, [loadProfile])

  const login = async (email: string, password: string, rememberMe = true) => {
    await setPersistence(
      auth,
      rememberMe ? browserLocalPersistence : browserSessionPersistence,
    )
    await signInWithEmailAndPassword(auth, email, password)
  }

  const loginWithGoogle = async (rememberMe = true) => {
    await setPersistence(
      auth,
      rememberMe ? browserLocalPersistence : browserSessionPersistence,
    )
    const provider = new GoogleAuthProvider()
    provider.addScope('https://www.googleapis.com/auth/calendar.readonly')
    provider.addScope('https://www.googleapis.com/auth/gmail.readonly')
    provider.setCustomParameters({ prompt: 'consent' })

    const result = await signInWithPopup(auth, provider)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    const token = credential?.accessToken

    if (token) {
      sessionStorage.setItem(GOOGLE_TOKEN_STORAGE_KEY, token)
      setGoogleAccessToken(token)
    } else {
      sessionStorage.removeItem(GOOGLE_TOKEN_STORAGE_KEY)
      setGoogleAccessToken(null)
    }

    await ensureGoogleUserProfile(result.user)
    await loadProfile(result.user.uid, result.user.email)
  }

  const logout = async () => {
    sessionStorage.removeItem(GOOGLE_TOKEN_STORAGE_KEY)
    setGoogleAccessToken(null)
    await signOut(auth)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        googleAccessToken,
        loading,
        profileLoading,
        login,
        loginWithGoogle,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
