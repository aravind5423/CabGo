import { create } from 'zustand';

const ACTIVE_TRIP_KEY = 'rydio_active_trip';

function readActiveTrip() {
  try {
    const raw = localStorage.getItem(ACTIVE_TRIP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Passenger-side trip context. The active ride is persisted so a page reload
 * during or right after a trip still shows the live view / rating prompt.
 */
export const useTripStore = create((set) => ({
  activeTrip: readActiveTrip(),
  driverLocation: null,

  setActiveTrip: (trip) => {
    if (trip) localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(trip));
    else localStorage.removeItem(ACTIVE_TRIP_KEY);
    set({ activeTrip: trip });
  },
  clearActiveTrip: () => {
    localStorage.removeItem(ACTIVE_TRIP_KEY);
    set({ activeTrip: null, driverLocation: null });
  },
  setDriverLocation: (coords) => set({ driverLocation: coords }),
}));
