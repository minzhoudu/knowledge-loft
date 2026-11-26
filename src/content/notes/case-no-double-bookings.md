---
title: 'Case: no double bookings'
kind: case
area: backend
summary: Making it impossible, not just unlikely, for two customers to book the same slot.
updated: 2026-11-27
---

**Project:** Moj Vulkanizer, a booking platform for tire shops.

## The problem

Two customers can open the same free slot at the same moment. Checking availability in application code and then inserting is a race: both checks pass, both inserts succeed, and the shop has a conflict.

## The approach

Let the database enforce it. PostgreSQL has **exclusion constraints**: a constraint that rejects a row if it conflicts with an existing one under rules you define. With the `btree_gist` extension, "same service bay and overlapping time range" can be declared as a conflict.

The application still checks availability to show free slots, but correctness no longer depends on it. A losing insert fails with a clear error, and the customer is offered another time.

## Around it

- An availability engine for opening hours, holidays, service bays and time zones.
- Times stored in UTC, shown in the shop's time zone.
- Reminders over WhatsApp and push notifications, iOS included.

## Result

Double bookings went from unlikely to impossible by construction.
