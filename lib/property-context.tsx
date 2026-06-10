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
import { properties as seedProperties } from '@/lib/mock-data'
import { currentUser } from '@/lib/mock-data'
import {
  createProperty,
  fetchOwnerProperties,
  switchActiveProperty,
} from '@/app/actions/properties'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Property } from '@/types'

export type NewPropertyInput = Omit<Property, 'id' | 'code'> & { code?: string }

interface PropertyContextValue {
  properties: Property[]
  activeProperty: Property
  activePropertyId: string
  /** Switch the owner's active property (updates session hotel_id server-side). */
  switchProperty: (id: string) => Promise<boolean>
  addProperty: (input: NewPropertyInput) => Promise<Property | null>
  isAdmin: boolean
  canSwitchProperty: boolean
  userRole: Profile['role'] | null
  assignedHotelId: string | null
  profile: Profile | null
  loading: boolean
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
}

export function PropertyProvider({ children }: { children: ReactNode }) {
  const [propertiesList, setPropertiesList] = useState<Property[]>(seedProperties)
  const [activePropertyId, setActivePropertyIdState] = useState(seedProperties[0]?.id ?? '')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const canSwitchProperty = profile ? profile.role === 'owner' : false

  const loadProperties = useCallback(async (prof: Profile) => {
    if (prof.role === 'owner') {
      const result = await fetchOwnerProperties()
      if (result.success && result.data && result.data.length > 0) {
        setPropertiesList(result.data)
        const active = prof.hotel_id
          ? (result.data.find((p) => p.id === prof.hotel_id) ?? result.data[0])
          : result.data[0]
        setActivePropertyIdState(active.id)
        return
      }
    }

    if (prof.hotel_id) {
      const supabase = createClient()
      const { data: hotel } = await supabase
        .from('hotels')
        .select('*, rooms(count)')
        .eq('id', prof.hotel_id)
        .maybeSingle()

      if (hotel) {
        const roomCount =
          hotel.rooms && Array.isArray(hotel.rooms) && hotel.rooms[0]
            ? (hotel.rooms[0] as { count: number }).count
            : 0
        const mapped: Property = {
          id: hotel.id,
          name: hotel.name,
          code: hotel.name.slice(0, 4).toUpperCase(),
          address: hotel.address ?? '',
          city: hotel.city ?? 'Accra',
          region: hotel.region ?? 'Greater Accra',
          totalRooms: roomCount,
        }
        setPropertiesList([mapped])
        setActivePropertyIdState(mapped.id)
      }
    }
  }, [])

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setLoading(false)
      return
    }

    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
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
  }, [loadProperties])

  const activeProperty = useMemo(() => {
    return propertiesList.find((p) => p.id === activePropertyId) ?? propertiesList[0] ?? emptyProperty
  }, [propertiesList, activePropertyId])

  const switchProperty = useCallback(
    async (id: string): Promise<boolean> => {
      if (!canSwitchProperty) return false
      if (!propertiesList.some((p) => p.id === id)) return false
      if (id === activePropertyId) return true

      const result = await switchActiveProperty(id)
      if (!result.success) return false

      setActivePropertyIdState(id)
      setProfile((prev) => (prev ? { ...prev, hotel_id: id } : prev))
      return true
    },
    [canSwitchProperty, propertiesList, activePropertyId],
  )

  const addProperty = useCallback(
    async (input: NewPropertyInput): Promise<Property | null> => {
      if (!canSwitchProperty) return null

      const result = await createProperty({
        name: input.name,
        address: input.address,
        city: input.city,
        region: input.region,
        totalRooms: input.totalRooms,
      })

      if (!result.success || !result.data) return null

      const property = result.data
      setPropertiesList((prev) => [...prev.filter((p) => p.id !== property.id), property])
      setActivePropertyIdState(property.id)
      setProfile((prev) => (prev ? { ...prev, hotel_id: property.id } : prev))
      return property
    },
    [canSwitchProperty],
  )

  const value = useMemo(
    () => ({
      properties: propertiesList,
      activeProperty,
      activePropertyId: activeProperty.id,
      switchProperty,
      addProperty,
      isAdmin: profile ? profile.role === 'owner' : currentUser.role === 'admin',
      canSwitchProperty,
      userRole: profile?.role ?? null,
      assignedHotelId: profile?.hotel_id ?? null,
      profile,
      loading,
    }),
    [
      propertiesList,
      activeProperty,
      switchProperty,
      addProperty,
      canSwitchProperty,
      profile,
      loading,
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
