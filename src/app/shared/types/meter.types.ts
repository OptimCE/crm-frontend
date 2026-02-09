export enum TarifGroup {
  LOW_TENSION = 1,
  HIGH_TENSION = 2,
}

export enum ReadingFrequency {
  MONTHLY = 1,
  YEARLY = 2,
}

export enum MeterDataStatus {
  ACTIVE = 1,
  INACTIVE = 2,
  WAITING_GRD = 3,
  WAITING_MANAGER = 4,
}

export enum MeterRate {
  SIMPLE = 1,
  BI_HOURLY = 2,
  EXCLUSIVE_NIGHT = 3,
}

export enum ClientType {
  RESIDENTIAL = 1,
  PROFESSIONAL = 2,
  INDUSTRIAL = 3,
}

export enum InjectionStatus {
  AUTOPROD_OWNER = 1,
  AUTOPROD_RIGHTS = 2,
  INJECTION_OWNER = 3,
  INJECTION_RIGHTS = 4,
  NONE = 5
}

export enum ProductionChain {
  PHOTOVOLTAIC = 1,
  WIND = 2,
  HYDRO = 3,
  BIOMASS = 4,
  BIOGAS = 5,
  COGEN_FOSSIL = 6,
  OTHER = 7,
  NONE = 8
}
export enum PhaseCategory{
  SINGLE = 1,
  THREE = 3
}
