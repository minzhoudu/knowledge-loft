---
title: Ecommerce for big brands
kind: note
area: commerce
summary: What stores for FENDI Casa, Louis Poulsen and others taught me about commerce code.
updated: 2026-11-27
---

I built backend features on Salesforce Commerce Cloud for design brands like Flos, B&B Italia, Louis Poulsen and FENDI Casa, and later worked on Magento 2 for a drugstore chain. Commerce code is unforgiving: every bug costs someone money.

## Payments are a state machine

Authorised, captured, refunded, failed, under fraud review: model the states and transitions explicitly (we used Adyen), and make every webhook safe to receive twice.

## Checkout edge cases are the product

Multi-address shipping, split deliveries, store pickup. Those "rare" paths are where the expensive bugs live.

## The platform has opinions

SFCC and Magento both reward working with their extension points and punish fighting them. Learn the platform's way before adding your own.

## Content and commerce drift apart

Shops and marketing sites tend to grow separately. Bringing them together (see the Lilly Drogerie case file) removes a whole class of inconsistencies.
