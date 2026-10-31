// server/routes/ratings.js
// Ratings and reviews REST API endpoints for trips, drivers, and passengers

'use strict';

const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { logAction, getClientIp } = require('../middleware/logger');

module.exports = function ratingsRoute(router) {

  // ── POST /api/ratings ────────────────────────────────────────
  // Submit a rating and review for a completed trip
  router.post('/api/ratings', async (req, res) => {
    const guard = requireRole(['passenger', 'driver'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const { trip_id, rating, comment } = req.body || {};
    const tripId = parseInt(trip_id, 10);
    const starRating = parseInt(rating, 10);

    if (!tripId || !starRating || starRating < 1 || starRating > 5) {
      return req.sendJSON(400, {
        success: false,
        message: 'Valid trip_id and rating (integer between 1 and 5) are required.'
      });
    }

    try {
      // Find trip details
      const [trips] = await pool.execute(
        `SELECT t.trip_id, t.trip_status, t.driver_id, t.passenger_id,
                pp.user_id AS passenger_user_id,
                dp.user_id AS driver_user_id
         FROM trips t
         JOIN passenger_profiles pp ON t.passenger_id = pp.passenger_id
         JOIN driver_profiles dp ON t.driver_id = dp.driver_id
         WHERE t.trip_id = ?`,
        [tripId]
      );

      if (trips.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Trip not found.' });
      }

      const trip = trips[0];
      if (trip.trip_status !== 'completed') {
        return req.sendJSON(400, {
          success: false,
          message: 'Ratings can only be submitted for completed trips.'
        });
      }

      const currentUserId = guard.user.user_id;
      let reviewedUserId = null;
      let isRatingDriver = false;

      if (currentUserId === trip.passenger_user_id) {
        reviewedUserId = trip.driver_user_id;
        isRatingDriver = true;
      } else if (currentUserId === trip.driver_user_id) {
        reviewedUserId = trip.passenger_user_id;
        isRatingDriver = false;
      } else {
        return req.sendJSON(403, {
          success: false,
          message: 'You were not a participant in this trip.'
        });
      }

      // Check if current user already submitted a review for this trip
      const [existing] = await pool.execute(
        `SELECT review_id FROM ratings_reviews WHERE trip_id = ? AND reviewer_id = ? LIMIT 1`,
        [tripId, currentUserId]
      );

      if (existing.length > 0) {
        return req.sendJSON(409, {
          success: false,
          message: 'You have already submitted a rating for this trip.'
        });
      }

      const cleanComment = comment ? String(comment).trim().slice(0, 1000) : null;

      // Insert review
      const [insertRes] = await pool.execute(
        `INSERT INTO ratings_reviews (trip_id, reviewer_id, reviewed_user_id, rating, comment, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [tripId, currentUserId, reviewedUserId, starRating, cleanComment]
      );

      // If rating a driver, recalculate driver average rating and update driver_profiles
      if (isRatingDriver) {
        const [avgRows] = await pool.execute(
          `SELECT AVG(rating) AS avg_rating, COUNT(*) AS count
           FROM ratings_reviews
           WHERE reviewed_user_id = ?`,
          [reviewedUserId]
        );
        const newAvg = avgRows[0]?.avg_rating ? parseFloat(avgRows[0].avg_rating).toFixed(2) : 5.00;
        await pool.execute(
          `UPDATE driver_profiles SET rating = ? WHERE user_id = ?`,
          [newAvg, reviewedUserId]
        );
      }

      await logAction({
        userId:      currentUserId,
        action:      'SUBMIT_RATING',
        description: `Trip #${tripId} rated ${starRating} stars`,
        ip:          getClientIp(req),
      });

      return req.sendJSON(201, {
        success: true,
        message: 'Thank you for your rating!',
        review_id: insertRes.insertId,
        rating: starRating
      });
    } catch (err) {
      console.error('[ratings POST]', err);
      return req.sendJSON(500, { success: false, message: 'Failed to submit rating.' });
    }
  });

  // ── GET /api/ratings/driver/:id ──────────────────────────────
  // Fetch reviews and average rating for a driver
  router.get('/api/ratings/driver/:id', async (req, res) => {
    const driverId = parseInt(req.params.id, 10);
    if (!driverId) return req.sendJSON(400, { success: false, message: 'Invalid driver ID.' });

    try {
      const [driverRows] = await pool.execute(
        `SELECT dp.driver_id, dp.rating, u.name, u.user_id
         FROM driver_profiles dp
         JOIN users u ON dp.user_id = u.user_id
         WHERE dp.driver_id = ?`,
        [driverId]
      );

      if (driverRows.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Driver not found.' });
      }

      const driver = driverRows[0];

      const [reviews] = await pool.execute(
        `SELECT rr.review_id, rr.rating, rr.comment, rr.created_at,
                u.name AS reviewer_name
         FROM ratings_reviews rr
         JOIN users u ON rr.reviewer_id = u.user_id
         WHERE rr.reviewed_user_id = ?
         ORDER BY rr.created_at DESC
         LIMIT 20`,
        [driver.user_id]
      );

      const [stats] = await pool.execute(
        `SELECT COUNT(*) AS total_reviews, COALESCE(AVG(rating), 0) AS avg_rating
         FROM ratings_reviews
         WHERE reviewed_user_id = ?`,
        [driver.user_id]
      );

      return req.sendJSON(200, {
        success: true,
        driver_id: driverId,
        driver_name: driver.name,
        average_rating: parseFloat(stats[0].avg_rating || driver.rating).toFixed(2),
        total_reviews: stats[0].total_reviews,
        reviews
      });
    } catch (err) {
      console.error('[ratings/driver GET]', err);
      return req.sendJSON(500, { success: false, message: 'Failed to load driver ratings.' });
    }
  });

  // ── GET /api/ratings/passenger/:id ───────────────────────────
  router.get('/api/ratings/passenger/:id', async (req, res) => {
    const passengerId = parseInt(req.params.id, 10);
    if (!passengerId) return req.sendJSON(400, { success: false, message: 'Invalid passenger ID.' });

    try {
      const [passengerRows] = await pool.execute(
        `SELECT pp.passenger_id, u.name, u.user_id
         FROM passenger_profiles pp
         JOIN users u ON pp.user_id = u.user_id
         WHERE pp.passenger_id = ?`,
        [passengerId]
      );

      if (passengerRows.length === 0) {
        return req.sendJSON(404, { success: false, message: 'Passenger not found.' });
      }

      const passenger = passengerRows[0];

      const [reviews] = await pool.execute(
        `SELECT rr.review_id, rr.rating, rr.comment, rr.created_at,
                u.name AS reviewer_name
         FROM ratings_reviews rr
         JOIN users u ON rr.reviewer_id = u.user_id
         WHERE rr.reviewed_user_id = ?
         ORDER BY rr.created_at DESC
         LIMIT 20`,
        [passenger.user_id]
      );

      return req.sendJSON(200, {
        success: true,
        passenger_id: passengerId,
        passenger_name: passenger.name,
        reviews
      });
    } catch (err) {
      console.error('[ratings/passenger GET]', err);
      return req.sendJSON(500, { success: false, message: 'Failed to load passenger ratings.' });
    }
  });

  // ── GET /api/ratings/trip/:trip_id ───────────────────────────
  // Check if current user rated this trip
  router.get('/api/ratings/trip/:trip_id', async (req, res) => {
    const guard = requireRole(['passenger', 'driver'])(req);
    if (!guard.ok) return req.sendJSON(guard.status, { success: false, message: guard.message });

    const tripId = parseInt(req.params.trip_id, 10);
    if (!tripId) return req.sendJSON(400, { success: false, message: 'Invalid trip ID.' });

    try {
      const [reviews] = await pool.execute(
        `SELECT review_id, rating, comment, created_at
         FROM ratings_reviews
         WHERE trip_id = ? AND reviewer_id = ?
         LIMIT 1`,
        [tripId, guard.user.user_id]
      );

      return req.sendJSON(200, {
        success: true,
        rated: reviews.length > 0,
        review: reviews.length > 0 ? reviews[0] : null
      });
    } catch (err) {
      console.error('[ratings/trip GET]', err);
      return req.sendJSON(500, { success: false, message: 'Failed to check trip rating.' });
    }
  });

};
