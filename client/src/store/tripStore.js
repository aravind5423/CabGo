import { create } from 'zustand';

export const useTripStore = create((set) => ({
  activeTrip: null,
  driverLocation: null,
  rideRequests: [],

  setActiveTrip: (trip) => set({ activeTrip: trip }),
  clearActiveTrip: () => set({ activeTrip: null, driverLocation: null }),
  setDriverLocation: (coords) => set({ driverLocation: coords }),
  setRideRequests: (requests) => set({ rideRequests: requests }),
}));
