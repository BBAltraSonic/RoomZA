import {
  ShieldAlert,
  ShoppingCart,
  Bus,
  Activity,
  Wifi,
  Coffee,
  HeartPulse,
  Banknote,
  GraduationCap,
  Train,
  Car,
  Fuel,
  Dumbbell,
  Shirt,
  Briefcase,
  Store,
  GlassWater,
  TrainFront
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type LayerCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
  pinColor: string;
  overpassQuery?: string;
  staticDataId?: string;
  comingSoon?: boolean;
};

export type LayerGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  categories: LayerCategory[];
};

export const NEIGHBORHOOD_LAYERS: LayerGroup[] = [
  {
    id: "essentials",
    label: "Essentials",
    icon: ShoppingCart,
    color: "var(--zone-green)",
    categories: [
      {
        id: "groceries",
        label: "Groceries",
        icon: ShoppingCart,
        pinColor: "var(--zone-green)",
        overpassQuery: 'nwr["shop"~"supermarket|convenience"]',
      },
      {
        id: "clinics",
        label: "Clinics & Pharmacies",
        icon: HeartPulse,
        pinColor: "var(--zone-green)",
        overpassQuery: 'nwr["amenity"~"clinic|pharmacy|hospital"]',
      },
      {
        id: "atms",
        label: "ATMs & Banks",
        icon: Banknote,
        pinColor: "var(--zone-green)",
        overpassQuery: 'nwr["amenity"~"bank|atm"]',
      },
      {
        id: "schools",
        label: "Schools & Universities",
        icon: GraduationCap,
        pinColor: "var(--zone-green)",
        overpassQuery: 'nwr["amenity"~"school|university|college"]',
      },
    ],
  },
  {
    id: "transport",
    label: "Transport",
    icon: Bus,
    color: "var(--zone-orange)",
    categories: [
      {
        id: "gautrain",
        label: "Gautrain",
        icon: Train,
        pinColor: "var(--zone-orange)",
        staticDataId: "gautrain",
      },
      {
        id: "myciti",
        label: "MyCiTi",
        icon: Bus,
        pinColor: "var(--zone-orange)",
        staticDataId: "myciti",
      },
      {
        id: "trains",
        label: "Train Stations",
        icon: TrainFront,
        pinColor: "var(--zone-orange)",
        overpassQuery: 'nwr["railway"="station"]',
      },
      {
        id: "taxi_ranks",
        label: "Taxi Ranks",
        icon: Car,
        pinColor: "var(--zone-orange)",
        staticDataId: "taxi_ranks",
      },
      {
        id: "bus_stops",
        label: "Bus Stops",
        icon: Bus,
        pinColor: "var(--zone-orange)",
        overpassQuery: 'nwr["highway"="bus_stop"]',
      },
    ],
  },
  {
    id: "safety",
    label: "Safety",
    icon: ShieldAlert,
    color: "var(--zone-red)",
    categories: [
      {
        id: "police",
        label: "Police Stations",
        icon: ShieldAlert,
        pinColor: "var(--zone-red)",
        overpassQuery: 'nwr["amenity"="police"]',
      },
      {
        id: "crime_zones",
        label: "Crime Heat Zones",
        icon: Activity,
        pinColor: "var(--zone-red)",
        comingSoon: true,
      },
      {
        id: "security",
        label: "Security Coverage",
        icon: ShieldAlert,
        pinColor: "var(--zone-red)",
        comingSoon: true,
      },
    ],
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    icon: Coffee,
    color: "var(--zone-purple)",
    categories: [
      {
        id: "restaurants",
        label: "Restaurants & Cafes",
        icon: Coffee,
        pinColor: "var(--zone-purple)",
        overpassQuery: 'nwr["amenity"~"restaurant|cafe|fast_food"]',
      },
      {
        id: "gyms",
        label: "Gyms",
        icon: Dumbbell,
        pinColor: "var(--zone-purple)",
        overpassQuery: 'nwr["leisure"~"fitness_centre|fitness_station"]',
      },
      {
        id: "malls",
        label: "Shopping Centres",
        icon: Store,
        pinColor: "var(--zone-purple)",
        overpassQuery: 'nwr["shop"="mall"]',
      },
      {
        id: "nightlife",
        label: "Nightlife",
        icon: GlassWater,
        pinColor: "var(--zone-purple)",
        overpassQuery: 'nwr["amenity"~"bar|pub|nightclub"]',
      },
    ],
  },
  {
    id: "utilities",
    label: "Utilities",
    icon: Wifi,
    color: "var(--zone-blue)",
    categories: [
      {
        id: "petrol",
        label: "Petrol Stations",
        icon: Fuel,
        pinColor: "var(--zone-blue)",
        overpassQuery: 'nwr["amenity"="fuel"]',
      },
      {
        id: "fibre",
        label: "Fibre Coverage",
        icon: Wifi,
        pinColor: "var(--zone-blue)",
        comingSoon: true,
      },
      {
        id: "loadshedding",
        label: "Loadshedding Zones",
        icon: Activity,
        pinColor: "var(--zone-blue)",
        comingSoon: true,
      },
    ],
  },
  {
    id: "services",
    label: "Services",
    icon: Briefcase,
    color: "var(--zone-clay)",
    categories: [
      {
        id: "laundry",
        label: "Laundry Services",
        icon: Shirt,
        pinColor: "var(--zone-clay)",
        overpassQuery: 'nwr["shop"="laundry"]',
      },
      {
        id: "coworking",
        label: "Co-working",
        icon: Briefcase,
        pinColor: "var(--zone-clay)",
        overpassQuery: 'nwr["amenity"="coworking_space"]',
      },
    ],
  },
];
