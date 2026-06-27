import type { POI } from '../shared/types'

export const pois: POI[] = [
  {
    id: 'poi-1',
    name: 'Old Stone Bridge',
    category: 'landmark',
    lat: 51.508,
    lng: -0.095,
    radius_m: 50,
    short_hook: 'A centuries-old crossing over the river.',
    history: 'Built in 1820 to connect the market town with the mill district.',
    folklore: 'Locals say the bridge keeper still walks the span on foggy nights.',
    culture_note: 'Featured on the town crest and annual heritage walk.',
  },
  {
    id: 'poi-2',
    name: 'Riverside Market',
    category: 'market',
    lat: 51.502,
    lng: -0.085,
    radius_m: 80,
    short_hook: 'Weekend stalls along the waterfront.',
    history: 'Trading here since the 1700s; rebuilt after the 1891 flood.',
    folklore: 'Vendors leave an empty chair for the "river guest" at dawn.',
    culture_note: 'Known for handmade crafts and seasonal produce.',
  },
]
