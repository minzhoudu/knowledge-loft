---
title: 'Case: tire shops to car washes'
kind: case
area: backend
summary: How a booking app built for tire shops took on a car wash without a rewrite.
updated: 2026-11-27
---

**Project:** Moj Vulkanizer.

## The problem

The app was built for tire shops: seasonal tire changes, three vehicle types, tire-specific wording. Then a potential client turned up who washes cars, and some shops wanted to offer bikes or motorbikes.

## The approach

Most of the work had been done earlier, by modelling one level more generally than the first customer needed:

- **Services have a kind.** "Seasonal tire change" is one kind; everything else is "other", with its own prices and durations per vehicle type.
- **Vehicle types belong to each shop.** A shop adds bikes or motorbikes and sets prices for them; the others never see them.
- **Tire-only features check the kind.** The "remind me next season" checkbox only appears when a customer books a seasonal tire change, so a car wash customer never sees it.

So a car wash could add services like interior cleaning without a single code change. What stayed tire-specific was wording: the product name, the domain and some landing page copy.

## Result

The car wash is on the platform alongside the first tire shops.

## What I took from it

A first customer defines the problem, not the data model. Model the general case ("a service, for a kind of vehicle") and let the specific one ("seasonal tire change") be a value in it.
