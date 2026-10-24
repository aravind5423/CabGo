-- ============================================================
-- Online Cab Booking System — Full Database Schema
-- ============================================================
-- Run: mysql -u root -p < database/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS cab_booking
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cab_booking;

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  user_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,          -- bcrypt-style hash (HMAC-SHA256)
  mobile      VARCHAR(15)  NOT NULL,
  role        ENUM('passenger','driver','admin','superadmin') NOT NULL,
  status      ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_email  (email),
  INDEX idx_users_role   (role),
  INDEX idx_users_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- 2. PASSENGER PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS passenger_profiles (
  passenger_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id            INT UNSIGNED NOT NULL UNIQUE,
  default_address    VARCHAR(255),
  emergency_contact  VARCHAR(15),
  CONSTRAINT fk_pp_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 3. DRIVER PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_profiles (
  driver_id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id             INT UNSIGNED NOT NULL UNIQUE,
  license_no          VARCHAR(50)  NOT NULL,
  license_expiry      DATE         NOT NULL,
  verification_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  availability        ENUM('online','offline') NOT NULL DEFAULT 'offline',
  rating              DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  CONSTRAINT fk_dp_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_dp_status (verification_status),
  INDEX idx_dp_avail  (availability)
) ENGINE=InnoDB;

-- ============================================================
-- 4. VEHICLES
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  driver_id       INT UNSIGNED NOT NULL,
  vehicle_number  VARCHAR(20)  NOT NULL UNIQUE,
  vehicle_type    ENUM('sedan','suv','hatchback','auto','bike') NOT NULL,
  model           VARCHAR(100) NOT NULL,
  capacity        TINYINT UNSIGNED NOT NULL DEFAULT 4,
  status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
  CONSTRAINT fk_v_driver FOREIGN KEY (driver_id)
    REFERENCES driver_profiles(driver_id) ON DELETE CASCADE,
  INDEX idx_v_driver (driver_id),
  INDEX idx_v_type   (vehicle_type),
  INDEX idx_v_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- 5. SERVICE AREAS
-- ============================================================
CREATE TABLE IF NOT EXISTS service_areas (
  area_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  area_name  VARCHAR(100) NOT NULL,
  city       VARCHAR(100) NOT NULL,
  state      VARCHAR(100) NOT NULL,
  status     ENUM('active','inactive') NOT NULL DEFAULT 'active',
  INDEX idx_sa_city   (city),
  INDEX idx_sa_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- 6. FARE RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS fare_rules (
  fare_id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vehicle_type      ENUM('sedan','suv','hatchback','auto','bike') NOT NULL,
  base_fare         DECIMAL(8,2) NOT NULL,
  per_km_rate       DECIMAL(8,2) NOT NULL,
  per_minute_rate   DECIMAL(8,2) NOT NULL,
  cancellation_fee  DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  status            ENUM('active','inactive') NOT NULL DEFAULT 'active',
  UNIQUE KEY uq_fare_type (vehicle_type)
) ENGINE=InnoDB;

-- ============================================================
-- 7. RIDE REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS ride_requests (
  request_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  passenger_id      INT UNSIGNED NOT NULL,
  pickup_location   VARCHAR(255) NOT NULL,
  destination       VARCHAR(255) NOT NULL,
  vehicle_type      ENUM('sedan','suv','hatchback','auto','bike') NOT NULL DEFAULT 'sedan',
  requested_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estimated_fare    DECIMAL(8,2),
  status            ENUM('pending','accepted','rejected','cancelled','completed') NOT NULL DEFAULT 'pending',
  CONSTRAINT fk_rr_passenger FOREIGN KEY (passenger_id)
    REFERENCES passenger_profiles(passenger_id) ON DELETE CASCADE,
  INDEX idx_rr_passenger (passenger_id),
  INDEX idx_rr_status    (status),
  INDEX idx_rr_requested (requested_at)
) ENGINE=InnoDB;

-- ============================================================
-- 8. TRIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS trips (
  trip_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_id    INT UNSIGNED NOT NULL UNIQUE,
  passenger_id  INT UNSIGNED NOT NULL,
  driver_id     INT UNSIGNED NOT NULL,
  vehicle_id    INT UNSIGNED NOT NULL,
  start_time    DATETIME,
  end_time      DATETIME,
  distance_km   DECIMAL(8,2),
  fare          DECIMAL(8,2),
  trip_status   ENUM('accepted','in_progress','completed','cancelled') NOT NULL DEFAULT 'accepted',
  CONSTRAINT fk_t_request   FOREIGN KEY (request_id)   REFERENCES ride_requests(request_id),
  CONSTRAINT fk_t_passenger FOREIGN KEY (passenger_id) REFERENCES passenger_profiles(passenger_id),
  CONSTRAINT fk_t_driver    FOREIGN KEY (driver_id)    REFERENCES driver_profiles(driver_id),
  CONSTRAINT fk_t_vehicle   FOREIGN KEY (vehicle_id)   REFERENCES vehicles(vehicle_id),
  INDEX idx_t_passenger (passenger_id),
  INDEX idx_t_driver    (driver_id),
  INDEX idx_t_status    (trip_status),
  INDEX idx_t_start     (start_time)
) ENGINE=InnoDB;

-- ============================================================
-- 9. PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  payment_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id         INT UNSIGNED NOT NULL UNIQUE,
  passenger_id    INT UNSIGNED NOT NULL,
  amount          DECIMAL(8,2) NOT NULL,
  payment_method  ENUM('cash','card','wallet','upi') NOT NULL DEFAULT 'cash',
  payment_status  ENUM('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  paid_at         DATETIME,
  CONSTRAINT fk_pay_trip      FOREIGN KEY (trip_id)      REFERENCES trips(trip_id),
  CONSTRAINT fk_pay_passenger FOREIGN KEY (passenger_id) REFERENCES passenger_profiles(passenger_id),
  INDEX idx_pay_passenger (passenger_id),
  INDEX idx_pay_status    (payment_status),
  INDEX idx_pay_paid_at   (paid_at)
) ENGINE=InnoDB;

-- ============================================================
-- 10. RATINGS & REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS ratings_reviews (
  review_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id          INT UNSIGNED NOT NULL,
  reviewer_id      INT UNSIGNED NOT NULL,
  reviewed_user_id INT UNSIGNED NOT NULL,
  rating           TINYINT UNSIGNED NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment          TEXT,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rr_trip     FOREIGN KEY (trip_id)          REFERENCES trips(trip_id),
  CONSTRAINT fk_rr_reviewer FOREIGN KEY (reviewer_id)      REFERENCES users(user_id),
  CONSTRAINT fk_rr_reviewed FOREIGN KEY (reviewed_user_id) REFERENCES users(user_id),
  INDEX idx_rr_trip     (trip_id),
  INDEX idx_rr_reviewed (reviewed_user_id)
) ENGINE=InnoDB;

-- ============================================================
-- 11. ADMIN PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_permissions (
  permission_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id         INT UNSIGNED NOT NULL,
  permission_name  VARCHAR(100) NOT NULL,
  CONSTRAINT fk_ap_admin FOREIGN KEY (admin_id)
    REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY uq_admin_perm (admin_id, permission_name),
  INDEX idx_ap_admin (admin_id)
) ENGINE=InnoDB;

-- ============================================================
-- 12. SYSTEM LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS system_logs (
  log_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED,
  action      VARCHAR(100) NOT NULL,
  description TEXT,
  ip_address  VARCHAR(45),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sl_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_sl_user      (user_id),
  INDEX idx_sl_action    (action),
  INDEX idx_sl_created   (created_at)
) ENGINE=InnoDB;

-- ============================================================
-- 13. SYSTEM SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key   VARCHAR(50) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

