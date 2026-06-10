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
import { createClient } from '@/lib/supabase/client'
import type { Hotel, Profile, Property } from '@/types'

const PROPERTIES_KEY = 'mojo-apartments-properties'
const ACTIVE_PROPERTY_KEY = 'mojo-apartments-active-property'

export type NewPropertyInput = Omit<Property, 'id' | 'code'> & { code?: string }

function hotelToProperty(hotel: Hotel): Property {
  return {
    id: hotel.id,
    name: hotel.name,
    code: 'MOJO',
    address: hotel.address ?? '',
    city: 'Accra',
    region: 'Greater Accra',
    totalRooms: 30,
  }
}

interface PropertyContextValue {
  properties: Property[]
  activeProperty: Property
  activePropertyId: string
  setActivePropertyId: (id: string) => void
  addProperty: (input: NewPropertyInput) => Property
  isAdmin: boolean
  profile: Profile | null
}

const PropertyContext = createContext<PropertyContextValue | null>(null)

function generatePropertyCode(name: string, existing: Property[]): string {
  const base = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 4) || 'PROP'

  let code = base
  let suffix = 1
  while (existing.some((p) => p.code === code)) {
    code = `${base}${suffix}`
    suffix += 1
  }
  return code
}

export function PropertyProvider({
  children,
  initialHotel,
  initialProfile,
}: {
  children: ReactNode
  initialHotel?: Hotel | null
  initialProfile?: Profile | null
}) {
  const seedFromHotel = initialHotel ? [hotelToProperty(initialHotel)] : seedProperties
  const [propertiesList, setPropertiesList] = useState<Property[]>(seedFromHotel)
  const [activePropertyId, setActivePropertyIdState] = useState(seedFromHotel[0].id)
  const [profile, setProfile] = useState<Profile | null>(initialProfile ?? null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (initialHotel) {
      const mapped = hotelToProperty(initialHotel)
      setPropertiesList([mapped])
      setActivePropertyIdState(mapped.id)
      setHydrated(true)
      return
    }
    try {
      const storedProperties = localStorage.getItem(PROPERTIES_KEY)
      const storedActive = localStorage.getItem(ACTIVE_PROPERTY_KEY)

      if (storedProperties) {
        const parsed = JSON.parse(storedProperties) as Property[]
        if (parsed.length > 0) setPropertiesList(parsed)
      }

      if (storedActive) {
        setActivePropertyIdState(storedActive)
      }
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true)
  }, [initialHotel])

  useEffect(() => {
    if (initialHotel || !process.env.NEXT_PUBLIC_SUPABASE_URL) return

    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (!prof) return
      setProfile(prof as Profile)
      if (prof.hotel_id) {
        const { data: hotel } = await supabase
          .from('hotels')
          .select('*')
          .eq('id', prof.hotel_id)
          .maybeSingle()
        if (hotel) {
          const mapped = hotelToProperty(hotel as Hotel)
          setPropertiesList([mapped])
          setActivePropertyIdState(mapped.id)
        }
      }
    })
  }, [initialHotel])

  useEffect(() => {
    if (initialHotel || !hydrated) return
    localStorage.setItem(PROPERTIES_KEY, JSON.stringify(propertiesList))
  }, [propertiesList, hydrated])

  useEffect(() => {
    if (initialHotel || !hydrated) return
    localStorage.setItem(ACTIVE_PROPERTY_KEY, activePropertyId)
  }, [activePropertyId, hydrated, initialHotel])

  const activeProperty = useMemo(() => {
    return propertiesList.find((p) => p.id === activePropertyId) ?? propertiesList[0]
  }, [propertiesList, activePropertyId])

  const setActivePropertyId = useCallback(
    (id: string) => {
      if (propertiesList.some((p) => p.id === id)) {
        setActivePropertyIdState(id)
      }
    },
    [propertiesList],
  )

  const addProperty = useCallback(
    (input: NewPropertyInput): Property => {
      const property: Property = {
        id: crypto.randomUUID(),
        name: input.name.trim(),
        code: input.code?.trim().toUpperCase() || generatePropertyCode(input.name, propertiesList),
        address: input.address.trim(),
        city: input.city.trim(),
        region: input.region.trim(),
        totalRooms: input.totalRooms,
      }

      setPropertiesList((prev) => [...prev, property])
      setActivePropertyIdState(property.id)
      return property
    },
    [propertiesList],
  )

  const value = useMemo(
    () => ({
      properties: propertiesList,
      activeProperty,
      activePropertyId: activeProperty.id,
      setActivePropertyId,
      addProperty,
      isAdmin: profile?.role === 'owner' || currentUser.role === 'admin',
      profile,
    }),
    [propertiesList, activeProperty, setActivePropertyId, addProperty, profile],
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
