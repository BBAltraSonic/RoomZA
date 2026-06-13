export type StaticPOI = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

export const SA_TRANSPORT_DATA: Record<string, StaticPOI[]> = {
  gautrain: [
    { id: "gautrain-1", name: "Pretoria Station", lat: -25.7562, lng: 28.1894 },
    { id: "gautrain-2", name: "Centurion Station", lat: -25.8504, lng: 28.1882 },
    { id: "gautrain-3", name: "Midrand Station", lat: -25.9989, lng: 28.1368 },
    { id: "gautrain-4", name: "Marlboro Station", lat: -26.0829, lng: 28.1132 },
    { id: "gautrain-5", name: "Sandton Station", lat: -26.1077, lng: 28.0567 },
    { id: "gautrain-6", name: "Rosebank Station", lat: -26.1465, lng: 28.0437 },
    { id: "gautrain-7", name: "Park Station", lat: -26.1969, lng: 28.0415 },
    { id: "gautrain-8", name: "Rhodesfield Station", lat: -26.1287, lng: 28.2239 },
    { id: "gautrain-9", name: "OR Tambo International", lat: -26.1367, lng: 28.2411 },
    { id: "gautrain-10", name: "Hatfield Station", lat: -25.7478, lng: 28.2381 },
  ],
  myciti: [
    { id: "myciti-1", name: "Civic Centre", lat: -33.9213, lng: 18.4287 },
    { id: "myciti-2", name: "Thibault Square", lat: -33.9189, lng: 18.4223 },
    { id: "myciti-3", name: "Stadium", lat: -33.9056, lng: 18.4116 },
    { id: "myciti-4", name: "Woodbridge", lat: -33.8829, lng: 18.4842 },
    { id: "myciti-5", name: "Table View", lat: -33.8211, lng: 18.4975 },
    { id: "myciti-6", name: "Omuramba", lat: -33.8647, lng: 18.5144 },
    { id: "myciti-7", name: "Century City", lat: -33.8885, lng: 18.5113 },
    { id: "myciti-8", name: "Gardens", lat: -33.9318, lng: 18.4144 },
    { id: "myciti-9", name: "Sea Point", lat: -33.9185, lng: 18.3888 },
    { id: "myciti-10", name: "Camps Bay", lat: -33.9515, lng: 18.3789 },
  ],
  taxi_ranks: [
    { id: "taxi-1", name: "Bree Street Taxi Rank (JHB)", lat: -26.1982, lng: 28.0354 },
    { id: "taxi-2", name: "MTN Taxi Rank (JHB)", lat: -26.1989, lng: 28.0432 },
    { id: "taxi-3", name: "Cape Town Station Deck", lat: -33.9211, lng: 18.4243 },
    { id: "taxi-4", name: "Bellville Taxi Rank", lat: -33.9015, lng: 18.6321 },
    { id: "taxi-5", name: "Durban Station Taxi Rank", lat: -29.8505, lng: 31.0251 },
    { id: "taxi-6", name: "Berea Road Taxi Rank (DBN)", lat: -29.8601, lng: 31.0113 },
    { id: "taxi-7", name: "Pretoria Station Taxi Rank", lat: -25.7561, lng: 28.1884 },
    { id: "taxi-8", name: "Bloed Street Taxi Rank (PTA)", lat: -25.7412, lng: 28.1891 },
  ]
};
