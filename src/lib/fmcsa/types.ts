export interface FmcsaCarrier {
  usdotNumber: string;
  legalName: string;
  dbaName: string | null;
  entityType: string;
  operatingStatus: string;
  mcNumber: string | null;
  phyStreet: string;
  phyCity: string;
  phyState: string;
  phyZipcode: string;
  phyCountry: string;
  mailingStreet: string;
  mailingCity: string;
  mailingState: string;
  mailingZipcode: string;
  mailingCountry: string;
  telephone: string;
  fax: string | null;
  emailAddress: string | null;
  totalDrivers: number;
  totalPowerUnits: number;
  safetyRating: string | null;
  safetyRatingDate: string | null;
  ratingDate: string | null;
  crashTotal: number;
  fatalCrash: number;
  injCrash: number;
  towCrash: number;
  driverInsp: number;
  driverOosInsp: number;
  driverOosRate: number;
  vehicleInsp: number;
  vehicleOosInsp: number;
  vehicleOosRate: number;
  hazmatInsp: number;
  hazmatOosInsp: number;
  hazmatOosRate: number;
}

export interface FmcsaApiResponse {
  content: {
    carrier: FmcsaCarrier;
  };
}

export interface FmcsaLookupResult {
  success: boolean;
  data: FmcsaCarrier | null;
  error: string | null;
  cachedAt: Date | null;
}
