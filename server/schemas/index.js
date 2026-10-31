// server/schemas/index.js
// Centralised Zod validation schemas for all API request payloads
// Usage: const { authRegisterSchema } = require('../schemas');

'use strict';

const { z } = require('zod');

// ── Auth Schemas ──────────────────────────────────────────────

const authRegisterSchema = z.object({
  name:              z.string().min(2,  'Name must be at least 2 characters').max(100),
  email:             z.string().email('Invalid email address'),
  password:          z.string().min(6,  'Password must be at least 6 characters').max(128),
  mobile:            z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile number (10 digits, starting 6-9)'),
  role:              z.enum(['passenger', 'driver'], { errorMap: () => ({ message: 'Role must be passenger or driver' }) }),
  // Driver-only optional fields
  license_no:        z.string().max(20).optional(),
  license_expiry:    z.string().optional(),
  vehicle_type:      z.string().optional(),
  vehicle_number:    z.string().optional(),
  model:             z.string().optional(),
  // Passenger-only optional fields
  default_address:   z.string().max(300).optional(),
  emergency_contact: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.role === 'driver') {
    if (!data.license_no) {
      ctx.addIssue({ path: ['license_no'], code: z.ZodIssueCode.custom, message: 'License number is required for drivers' });
    }
    if (!data.license_expiry) {
      ctx.addIssue({ path: ['license_expiry'], code: z.ZodIssueCode.custom, message: 'License expiry is required for drivers' });
    }
  }
});

const authLoginSchema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ── Passenger / Ride Schemas ──────────────────────────────────

const rideSearchSchema = z.object({
  pickup:      z.string().min(1, 'Pickup is required').max(300),
  destination: z.string().min(1, 'Destination is required').max(300),
  type:        z.enum(['sedan', 'suv', 'hatchback', 'auto', 'bike']).optional(),
});

const rideBookingSchema = z.object({
  pickup_location: z.string().min(1, 'Pickup location is required').max(300),
  destination:     z.string().min(1, 'Destination is required').max(300),
  vehicle_type:    z.enum(['sedan', 'suv', 'hatchback', 'auto', 'bike'], {
    errorMap: () => ({ message: 'vehicle_type must be sedan, suv, hatchback, auto, or bike' }),
  }),
});

const rideCancelSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ── Driver Schemas ────────────────────────────────────────────

const availabilitySchema = z.object({
  availability: z.enum(['online', 'offline'], {
    errorMap: () => ({ message: 'availability must be online or offline' }),
  }),
});

const tripCompleteSchema = z.object({
  distance_km:    z.number().positive('distance_km must be a positive number').optional(),
  final_fare:     z.number().positive('final_fare must be a positive number').optional(),
  payment_method: z.enum(['cash', 'card', 'wallet', 'upi']).optional(),
});

// ── Rating Schema ─────────────────────────────────────────────

const ratingSchema = z.object({
  trip_id: z.number().int().positive('trip_id must be a positive integer'),
  rating:  z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  comment: z.string().max(1000).optional(),
});

// ── Admin / SuperAdmin Schemas ────────────────────────────────

const driverApprovalSchema = z.object({
  status: z.enum(['approved', 'rejected', 'pending'], {
    errorMap: () => ({ message: 'status must be approved, rejected, or pending' }),
  }),
  reason: z.string().max(500).optional(),
});

const fareRuleSchema = z.object({
  vehicle_type: z.enum(['sedan', 'suv', 'hatchback', 'auto', 'bike']),
  base_fare:    z.number().positive(),
  per_km_rate:  z.number().positive(),
  min_fare:     z.number().positive().optional(),
  surge_multiplier: z.number().min(1).optional(),
  status:       z.enum(['active', 'inactive']).optional(),
});

const systemSettingsSchema = z.object({
  commission_rate:         z.number().min(0).max(100).optional(),
  max_cancellations_per_day: z.number().int().min(0).optional(),
  maintenance_mode:        z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one setting must be provided',
});

module.exports = {
  // Auth
  authRegisterSchema,
  authLoginSchema,
  // Passenger
  rideSearchSchema,
  rideBookingSchema,
  rideCancelSchema,
  // Driver
  availabilitySchema,
  tripCompleteSchema,
  // Ratings
  ratingSchema,
  // Admin
  driverApprovalSchema,
  fareRuleSchema,
  systemSettingsSchema,
};

