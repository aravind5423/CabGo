-- ============================================================
-- Online Cab Booking System — Demo Seed Data
-- ============================================================
-- Run: mysql -u root -p < database/seed.sql
-- ============================================================

USE cab_booking;

-- Clear previous data in reverse FK order
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE system_logs;
TRUNCATE TABLE admin_permissions;
TRUNCATE TABLE ratings_reviews;
TRUNCATE TABLE payments;
TRUNCATE TABLE trips;
TRUNCATE TABLE ride_requests;
TRUNCATE TABLE fare_rules;
TRUNCATE TABLE service_areas;
TRUNCATE TABLE vehicles;
TRUNCATE TABLE driver_profiles;
TRUNCATE TABLE passenger_profiles;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. USERS
-- Passwords hashed with PBKDF2 (10000 iterations, sha512):
-- SuperAdmin@123 -> a32787940ee8a339ab7bd36041005e5c:d0a57400a81e0e25b9d1b06e92ed4788acfaf8615ffe34e97339e38a1aed54fad29dec4d1628f77faca215c913709845fea14753f427a9a17383dd8ee930cf0b
-- Admin@123      -> 45eb5be6c91dc51d0c0156cee5d3081f:77f2f6568c4f65abe6db3b9d3c08c63a2f8a8bb154b67bac2c58d7bcbb9346299391e1f6bc7aeb2c07d6664553481a28a61778bf9e45c6c1283ccfd5451bc0e9
-- Driver@123     -> 7dc4ecfff080fd88cc040056dddc9902:0f819506381489428e1f671665e222a8b1355ab1ec8e67646f95627140169a36d9767740975b7fd1230829416917f8abcfe1abffd596c0d8e9916193bbdaf687
-- Pass@123       -> a7388a1b736a79cd185537f82ebcd6cf:68edaaac91c730185d83cfbd2676d0e1e0e83623796a5e82310ea02bc34f02c2352f620ebd2f431a8d05f8e0b72d620fe6b3970edf62d4868661cf4eda46a865

INSERT INTO users (user_id, name, email, password, mobile, role, status, created_at) VALUES
-- 1 Super Admin
(1,  'Super Administrator',   'superadmin@cab.com', 'a32787940ee8a339ab7bd36041005e5c:d0a57400a81e0e25b9d1b06e92ed4788acfaf8615ffe34e97339e38a1aed54fad29dec4d1628f77faca215c913709845fea14753f427a9a17383dd8ee930cf0b', '9876543200', 'superadmin', 'active', NOW()),
-- 2 Admins
(2,  'Operations Admin',      'admin@cab.com',      '45eb5be6c91dc51d0c0156cee5d3081f:77f2f6568c4f65abe6db3b9d3c08c63a2f8a8bb154b67bac2c58d7bcbb9346299391e1f6bc7aeb2c07d6664553481a28a61778bf9e45c6c1283ccfd5451bc0e9', '9876543201', 'admin',      'active', NOW()),
(3,  'Fleet Supervisor Admin','admin2@cab.com',     '45eb5be6c91dc51d0c0156cee5d3081f:77f2f6568c4f65abe6db3b9d3c08c63a2f8a8bb154b67bac2c58d7bcbb9346299391e1f6bc7aeb2c07d6664553481a28a61778bf9e45c6c1283ccfd5451bc0e9', '9876543202', 'admin',      'active', NOW()),
-- 5 Drivers
(4,  'Rajesh Kumar',          'driver1@cab.com',    '7dc4ecfff080fd88cc040056dddc9902:0f819506381489428e1f671665e222a8b1355ab1ec8e67646f95627140169a36d9767740975b7fd1230829416917f8abcfe1abffd596c0d8e9916193bbdaf687', '9876543210', 'driver',     'active', NOW()),
(5,  'Suresh Sharma',         'driver2@cab.com',    '7dc4ecfff080fd88cc040056dddc9902:0f819506381489428e1f671665e222a8b1355ab1ec8e67646f95627140169a36d9767740975b7fd1230829416917f8abcfe1abffd596c0d8e9916193bbdaf687', '9876543211', 'driver',     'active', NOW()),
(6,  'Karthik Varma',         'driver3@cab.com',    '7dc4ecfff080fd88cc040056dddc9902:0f819506381489428e1f671665e222a8b1355ab1ec8e67646f95627140169a36d9767740975b7fd1230829416917f8abcfe1abffd596c0d8e9916193bbdaf687', '9876543212', 'driver',     'active', NOW()),
(7,  'Anand Prakash',         'driver4@cab.com',    '7dc4ecfff080fd88cc040056dddc9902:0f819506381489428e1f671665e222a8b1355ab1ec8e67646f95627140169a36d9767740975b7fd1230829416917f8abcfe1abffd596c0d8e9916193bbdaf687', '9876543213', 'driver',     'active', NOW()),
(8,  'Manoj Selvam',          'driver5@cab.com',    '7dc4ecfff080fd88cc040056dddc9902:0f819506381489428e1f671665e222a8b1355ab1ec8e67646f95627140169a36d9767740975b7fd1230829416917f8abcfe1abffd596c0d8e9916193bbdaf687', '9876543214', 'driver',     'active', NOW()),
-- 5 Passengers
(9,  'Aravind Passenger',     'passenger1@cab.com', 'a7388a1b736a79cd185537f82ebcd6cf:68edaaac91c730185d83cfbd2676d0e1e0e83623796a5e82310ea02bc34f02c2352f620ebd2f431a8d05f8e0b72d620fe6b3970edf62d4868661cf4eda46a865', '9876543220', 'passenger',  'active', NOW()),
(10, 'Priya Mohan',           'passenger2@cab.com', 'a7388a1b736a79cd185537f82ebcd6cf:68edaaac91c730185d83cfbd2676d0e1e0e83623796a5e82310ea02bc34f02c2352f620ebd2f431a8d05f8e0b72d620fe6b3970edf62d4868661cf4eda46a865', '9876543221', 'passenger',  'active', NOW()),
(11, 'Rahul Dravid',          'passenger3@cab.com', 'a7388a1b736a79cd185537f82ebcd6cf:68edaaac91c730185d83cfbd2676d0e1e0e83623796a5e82310ea02bc34f02c2352f620ebd2f431a8d05f8e0b72d620fe6b3970edf62d4868661cf4eda46a865', '9876543222', 'passenger',  'active', NOW()),
(12, 'Sneha Reddy',           'passenger4@cab.com', 'a7388a1b736a79cd185537f82ebcd6cf:68edaaac91c730185d83cfbd2676d0e1e0e83623796a5e82310ea02bc34f02c2352f620ebd2f431a8d05f8e0b72d620fe6b3970edf62d4868661cf4eda46a865', '9876543223', 'passenger',  'active', NOW()),
(13, 'Vikram Seth',           'passenger5@cab.com', 'a7388a1b736a79cd185537f82ebcd6cf:68edaaac91c730185d83cfbd2676d0e1e0e83623796a5e82310ea02bc34f02c2352f620ebd2f431a8d05f8e0b72d620fe6b3970edf62d4868661cf4eda46a865', '9876543224', 'passenger',  'active', NOW());

-- 2. PASSENGER PROFILES (5 Profiles)
INSERT INTO passenger_profiles (passenger_id, user_id, default_address, emergency_contact) VALUES
(1, 9,  'No 12, 4th Main Road, Anna Nagar, Chennai',        '9876543299'),
(2, 10, 'Tower 4, Green Glade Apts, OMR, Chennai',          '9876543298'),
(3, 11, 'Flat 302, Palm Meadows, Whitefield, Bangalore',     '9876543297'),
(4, 12, 'Plot 88, Jubilee Hills Road 36, Hyderabad',        '9876543296'),
(5, 13, '14B, Marine Drive Sea View Mansion, Mumbai',       '9876543295');

-- 3. DRIVER PROFILES (5 Drivers)
INSERT INTO driver_profiles (driver_id, user_id, license_no, license_expiry, verification_status, availability, rating) VALUES
(1, 4, 'TN-01-2021-008976', '2029-12-31', 'approved', 'online',  4.90),
(2, 5, 'TN-02-2020-004321', '2028-06-30', 'approved', 'online',  4.75),
(3, 6, 'TN-09-2022-005612', '2030-03-31', 'approved', 'online',  4.85),
(4, 7, 'TN-05-2019-009834', '2027-11-15', 'approved', 'offline', 4.60),
(5, 8, 'TN-03-2023-001278', '2031-08-20', 'approved', 'online',  4.95);

-- 4. VEHICLES (8 Registered Fleet Vehicles)
INSERT INTO vehicles (vehicle_id, driver_id, vehicle_number, vehicle_type, model, capacity, status) VALUES
(1, 1, 'TN-09-AB-1234', 'sedan',     'Honda City (Pearl White)',                 4, 'active'),
(2, 2, 'TN-07-CD-5678', 'suv',       'Toyota Innova Crysta (Silver Metallic)',   7, 'active'),
(3, 3, 'TN-01-EF-9012', 'hatchback', 'Maruti Suzuki Swift (Magma Grey)',         4, 'active'),
(4, 4, 'TN-10-GH-3456', 'auto',      'Bajaj RE Compact (Yellow-Green)',          3, 'active'),
(5, 5, 'TN-02-JK-7890', 'bike',      'TVS Apache RTR 160 (Matte Blue)',          1, 'active'),
(6, 1, 'TN-09-MN-4321', 'sedan',     'Hyundai Verna Turbo (Starry Night)',       4, 'inactive'),
(7, 2, 'TN-07-PQ-8765', 'suv',       'Mahindra XUV700 AX7 (Midnight Black)',     7, 'active'),
(8, 3, 'TN-01-RS-2109', 'hatchback', 'Tata Altroz XZ (Downtown Red)',            4, 'active');

-- 5. SERVICE AREAS
INSERT INTO service_areas (area_id, area_name, city, state, status) VALUES
(1, 'Chennai Central & Marina', 'Chennai', 'Tamil Nadu', 'active'),
(2, 'T. Nagar & Nungambakkam',   'Chennai', 'Tamil Nadu', 'active'),
(3, 'OMR & IT Corridor',         'Chennai', 'Tamil Nadu', 'active'),
(4, 'Airport & Meenambakkam',    'Chennai', 'Tamil Nadu', 'active'),
(5, 'Velachery & Adyar',         'Chennai', 'Tamil Nadu', 'active');

-- 6. FARE RULES
INSERT INTO fare_rules (fare_id, vehicle_type, base_fare, per_km_rate, per_minute_rate, cancellation_fee, status) VALUES
(1, 'sedan',     100.00, 18.00, 2.00, 50.00, 'active'),
(2, 'suv',       150.00, 25.00, 3.00, 70.00, 'active'),
(3, 'hatchback',  80.00, 14.00, 1.50, 40.00, 'active'),
(4, 'auto',       40.00, 10.00, 1.00, 20.00, 'active'),
(5, 'bike',       25.00,  7.00, 0.75, 15.00, 'active');

-- 7. RIDE REQUESTS (Sample requests across all passengers)
INSERT INTO ride_requests (request_id, passenger_id, pickup_location, destination, vehicle_type, requested_at, estimated_fare, status) VALUES
(1, 1, 'Anna Nagar Roundtana',            'T. Nagar Ranganathan St',          'sedan',     DATE_SUB(NOW(), INTERVAL 5 HOUR),   245.00, 'completed'),
(2, 2, 'OMR Tech Park Gateway',           'Chennai Airport Terminal 2',       'suv',       DATE_SUB(NOW(), INTERVAL 4 HOUR),   480.00, 'completed'),
(3, 3, 'Phoenix Market City, Velachery',  'Marina Beach Lighthouse',          'hatchback', DATE_SUB(NOW(), INTERVAL 3 HOUR),   195.00, 'completed'),
(4, 4, 'Tidel Park, Tharamani',           'Besant Nagar Beach Promenade',     'auto',      DATE_SUB(NOW(), INTERVAL 2 HOUR),   110.00, 'completed'),
(5, 5, 'Koyambedu CMBT Bus Terminus',     'Central Railway Station Terminal', 'bike',      DATE_SUB(NOW(), INTERVAL 1 HOUR),    85.00, 'completed'),
(6, 1, 'Phoenix Market City, Velachery',  'Marina Beach Lighthouse',          'sedan',     DATE_SUB(NOW(), INTERVAL 15 MINUTE), 280.00, 'pending'),
(7, 2, 'Sholinganallur Junction',         'Siruseri SIPCOT IT Park Gate 1',   'suv',       DATE_SUB(NOW(), INTERVAL 8 MINUTE),  220.00, 'pending');

-- 8. TRIPS (5 Completed Trips)
INSERT INTO trips (trip_id, request_id, passenger_id, driver_id, vehicle_id, start_time, end_time, distance_km, fare, trip_status) VALUES
(1, 1, 1, 1, 1, DATE_SUB(NOW(), INTERVAL 5 HOUR), DATE_SUB(NOW(), INTERVAL 265 MINUTE),  8.50, 253.00, 'completed'),
(2, 2, 2, 2, 2, DATE_SUB(NOW(), INTERVAL 4 HOUR), DATE_SUB(NOW(), INTERVAL 200 MINUTE), 15.20, 530.00, 'completed'),
(3, 3, 3, 3, 3, DATE_SUB(NOW(), INTERVAL 3 HOUR), DATE_SUB(NOW(), INTERVAL 150 MINUTE), 10.40, 225.60, 'completed'),
(4, 4, 4, 4, 4, DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 95 MINUTE),   6.20, 102.00, 'completed'),
(5, 5, 5, 5, 5, DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_SUB(NOW(), INTERVAL 38 MINUTE),   7.80,  79.60, 'completed');

-- 9. PAYMENTS (5 Completed Payments)
INSERT INTO payments (payment_id, trip_id, passenger_id, amount, payment_method, payment_status, paid_at) VALUES
(1, 1, 1, 253.00, 'wallet', 'completed', DATE_SUB(NOW(), INTERVAL 265 MINUTE)),
(2, 2, 2, 530.00, 'card',   'completed', DATE_SUB(NOW(), INTERVAL 200 MINUTE)),
(3, 3, 3, 225.60, 'upi',    'completed', DATE_SUB(NOW(), INTERVAL 150 MINUTE)),
(4, 4, 4, 102.00, 'cash',   'completed', DATE_SUB(NOW(), INTERVAL 95 MINUTE)),
(5, 5, 5,  79.60, 'wallet', 'completed', DATE_SUB(NOW(), INTERVAL 38 MINUTE));

-- 10. RATINGS & REVIEWS
INSERT INTO ratings_reviews (review_id, trip_id, reviewer_id, reviewed_user_id, rating, comment, created_at) VALUES
(1, 1, 9,  4, 5, 'Very clean car and polite driver! Reached on time.',                 DATE_SUB(NOW(), INTERVAL 4 HOUR)),
(2, 2, 10, 5, 5, 'Smooth ride through expressway traffic. Highly recommended!',         DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(3, 3, 11, 6, 5, 'Punctual pickup and careful driving in heavy rain.',                  DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(4, 4, 12, 7, 4, 'Good quick trip, driver was courteous.',                             DATE_SUB(NOW(), INTERVAL 1 HOUR)),
(5, 5, 13, 8, 5, 'Fastest way through city traffic. Safe rider with sanitized helmet.', DATE_SUB(NOW(), INTERVAL 30 MINUTE));

-- 11. ADMIN PERMISSIONS
INSERT INTO admin_permissions (permission_id, admin_id, permission_name) VALUES
-- Admin 1 (user_id 2)
(1, 2, 'manage_users'),
(2, 2, 'manage_trips'),
(3, 2, 'manage_fares'),
(4, 2, 'view_reports'),
-- Admin 2 (user_id 3)
(5, 3, 'manage_trips'),
(6, 3, 'view_reports');

-- 12. SYSTEM LOGS
INSERT INTO system_logs (log_id, user_id, action, description, ip_address, created_at) VALUES
(1, 1, 'SYSTEM_INIT',     'Full platform seed data initialized successfully with 13 users & 8 vehicles', '127.0.0.1', NOW()),
(2, 1, 'SETTINGS_UPDATE', 'Global commission configured to 15.0% and max cancellations to 3',            '127.0.0.1', NOW()),
(3, 2, 'DRIVER_APPROVAL', 'Approved driver registration for Rajesh Kumar (TN-01-2021-008976)',          '127.0.0.1', NOW()),
(4, 2, 'FLEET_AUDIT',     'Verified vehicle fitness certificate for TN-09-AB-1234',                      '127.0.0.1', NOW()),
(5, 1, 'SECURITY_AUDIT',  'RBAC privilege enforcement verified for operations admin roster',             '127.0.0.1', NOW());
