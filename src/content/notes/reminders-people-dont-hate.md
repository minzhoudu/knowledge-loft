---
title: Reminders people don't hate
kind: note
area: craft
summary: Designing Moj Vulkanizer's seasonal "time to change your tyres" reminders.
updated: 2026-11-27
---

Tire shops live by the seasons: twice a year, everyone needs a change. Reminding customers at the right time brings them back, but a careless reminder is spam. How I approached it:

## Ask first

A checkbox when someone books asks whether to remind them next season. It only appears when they book a seasonal tire change, not a wash or a repair.

## One message per person, not per car

We first considered one reminder per vehicle. But all of a customer's cars change tyres in the same season, so that would mean three messages for three cars. Now each customer gets one message, with a personal link to the booking chat, where they can book every car in one visit.

## The link does the work

The personal link records that it was opened, then goes straight to booking. Opting out is on the same page, one tap.

## Send from the shop's own WhatsApp

The official WhatsApp Business API charges per conversation and needs business verification, which is a lot for a small shop. Instead, the admin panel builds a daily queue, with a limit, of ready-made `wa.me` links. The owner taps each one to send it from their own WhatsApp, and it's marked as sent.

## The principle

A reminder should be welcome, easy to act on and easy to stop.
