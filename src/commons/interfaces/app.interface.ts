export interface Address {
  province: string;
  ward: string;
  detail: string;
  district?: string;
}

export interface Location {
  longitude: number;
  latitude: number;
}
