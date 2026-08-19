import { useGlobalSettings } from '../context/GlobalSettingsContext'
import { DEFAULT_DEPARTMENTS } from '../services/configService'

export function useDepartments() {
  const { settings, loading } = useGlobalSettings()

  const departments =
    settings.departments.length > 0 ? settings.departments : [...DEFAULT_DEPARTMENTS]

  return { departments, loading }
}

export function useContactDepartments() {
  const { departments, loading } = useDepartments()

  const contactDepartments = departments.filter(
    (department) => department.toLocaleLowerCase('es-AR') !== 'general',
  )

  return {
    departments: contactDepartments.length > 0 ? contactDepartments : departments,
    loading,
  }
}
