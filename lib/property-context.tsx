'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import {
  createProperty,
  fetchManagerAssignedProperties,
  fetchOwnerProperties,
  switchActiveProperty,
  uploadPropertyProfileImage,
} from '@/app/actions/properties'
import { createClient } from '@/lib/supabase/client'
import { propertyImagePublicUrl } from '@/lib/properties/image-storage'
import type { Profile, Property } from '@/types'

export type NewPropertyInput = Omit<Property, 'id' | 'code' | 'imageUrl'> & {
  code?: string
  profileImage?: Blob | null
}

interface PropertyContextValue {
  properties: Property[]
  activeProperty: Property
  activePropertyId: string
  /** Switch the active working property (updates session hotel_id server-side). */
  switchProperty: (id: string) => Promise<boolean>
  addProperty: (input: NewPropertyInput) => Promise<Property | null>
  isAdmin: boolean
  canSwitchProperty: boolean
  canAddProperty: boolean
  userRole: Profile['role'] | null
  assignedHotelId: string | null
  profile: Profile | null
  loading: boolean
  /** Re-fetch property list from the server (e.g. after settings save). */
  reloadProperties: () => Promise<void>
}

const PropertyContext = createContext<PropertyContextValue | null>(null)

const emptyProperty: Property = {
  id: '',
  name: 'No property',
  code: '—',
  address: '',
  city: '',
  region: '',
  totalRooms: 0,
  imageUrl: null,
}

/** Skip property fetches on auth/MFA routes — avoids racing server actions on the same page URL. */
function isAuthOrMfaPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/accept-invite' ||
    pathname === '/enroll-mfa' ||
    pathname === '/verify-mfa' ||
    pathname.startsWith('/auth/')
  )
}

export function PropertyProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const skipPropertyLoad = isAuthOrMfaPath(pathname)
  const [propertiesList, setPropertiesList] = useState<Property[]>([])
  const [activePropertyId, setActivePropertyIdState] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const applyPropertyList = useCallback((list: Property[], hotelId: string | null) => {
    setPropertiesList(list)
    const active = hotelId ? (list.find((p) => p.id === hotelId) ?? list[0]) : list[0]
    if (active) setActivePropertyIdState(active.id)
  }, [])

  const loadProperties = useCallback(async (prof: Profile) => {
    try {
      if (prof.role === 'owner') {
        const result = await fetchOwnerProperties()
        if (result.success && result.data && result.data.length > 0) {
          applyPropertyList(result.data, prof.hotel_id)
          return
        }
      }

      if (prof.role === 'manager') {
        const result = await fetchManagerAssignedProperties()
        if (result.success && result.data && result.data.length > 0) {
          applyPropertyList(result.data, prof.hotel_id)
          return
        }
      }

      if (prof.hotel_id) {
        const supabase = createClient()
        const [{ data: hotel }, { count: roomCount }] = await Promise.all([
          supabase.from('hotels').select('*').eq('id', prof.hotel_id).maybeSingle(),
          supabase
            .from('rooms')
            .select('id', { count: 'exact', head: true })
            .eq('hotel_id', prof.hotel_id),
        ])

        if (hotel) {
          const mapped: Property = {
            id: hotel.id,
            name: hotel.name,
            code: hotel.name.slice(0, 4).toUpperCase(),
            address: hotel.address ?? '',
            city: hotel.city ?? 'Accra',
            region: hotel.region ?? 'Greater Accra',
            totalRooms: roomCount ?? 0,
            imageUrl: propertyImagePublicUrl(hotel.profile_image_path),
          }
          applyPropertyList([mapped], mapped.id)
        }
      }
    } catch (err) {
      console.error('[property-context] loadProperties failed:', err)
    }
  }, [applyPropertyList])

  useEffect(() => {
    if (skipPropertyLoad) {
      setLoading(false)
      return
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setLoading(false)
      return
    }

    const supabase = createClient()
    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!user) {
          setLoading(false)
          return
        }

        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        if (!prof) {
          setLoading(false)
          return
        }

        setProfile(prof as Profile)
        await loadProperties(prof as Profile)
        setLoading(false)
      })
      .catch((err) => {
        console.error('[property-context] initial load failed:', err)
        setLoading(false)
      })
  }, [loadProperties, skipPropertyLoad])

  const activeProperty = useMemo(() => {
    return propertiesList.find((p) => p.id === activePropertyId) ?? propertiesList[0] ?? emptyProperty
  }, [propertiesList, activePropertyId])

  const refreshSwitchableProperties = useCallback(async (prof: Profile) => {
    await loadProperties(prof)
  }, [loadProperties])

  const canAddProperty = profile?.role === 'owner'
  const canSwitchProperty =
    profile?.role === 'owner' ||
    (profile?.role === 'manager' && propertiesList.length > 1)

  const switchProperty = useCallback(
    async (id: string): Promise<boolean> => {
      if (!canSwitchProperty || !profile) return false
      if (id === activePropertyId) return true

      try {
        const result = await switchActiveProperty(id)
        if (!result.success) return false

        const next = { ...profile, hotel_id: id }
        setProfile(next)
        await refreshSwitchableProperties(next)
        return true
      } catch (err) {
        console.error('[property-context] switchProperty failed:', err)
        return false
      }
    },
    [canSwitchProperty, activePropertyId, profile, refreshSwitchableProperties],
  )

  const reloadProperties = useCallback(async () => {
    if (profile) await refreshSwitchableProperties(profile)
  }, [profile, refreshSwitchableProperties])

  const addProperty = useCallback(
    async (input: NewPropertyInput): Promise<Property | null> => {
      if (!canAddProperty || !profile) return null

      const result = await createProperty({
        name: input.name,
        address: input.address,
        city: input.city,
        region: input.region,
        totalRooms: input.totalRooms,
      })

      if (!result.success || !result.data) return null

      const property = result.data

      if (input.profileImage) {
        const formData = new FormData()
        formData.append('file', input.profileImage, 'profile.jpg')
        const upload = await uploadPropertyProfileImage(property.id, formData)
        if (upload.success && upload.data?.imageUrl) {
          property.imageUrl = upload.data.imageUrl
        }
      }

      const next = { ...profile, hotel_id: property.id }
      setProfile(next)
      await refreshSwitchableProperties(next)
      return property
    },
    [canAddProperty, profile, refreshSwitchableProperties],
  )

  const value = useMemo(
    () => ({
      properties: propertiesList,
      activeProperty,
      activePropertyId: activeProperty.id,
      switchProperty,
      addProperty,
      isAdmin: profile?.role === 'owner',
      canSwitchProperty,
      canAddProperty,
      userRole: profile?.role ?? null,
      assignedHotelId: profile?.hotel_id ?? null,
      profile,
      loading,
      reloadProperties,
    }),
    [
      propertiesList,
      activeProperty,
      switchProperty,
      addProperty,
      canSwitchProperty,
      canAddProperty,
      profile,
      loading,
      reloadProperties,
    ],
  )

  return <PropertyContext.Provider value={value}>{children}</PropertyContext.Provider>
}

export function useProperty() {
  const context = useContext(PropertyContext)
  if (!context) {
    throw new Error('useProperty must be used within PropertyProvider')
  }
  return context
}
