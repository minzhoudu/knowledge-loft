---
title: 'Case: a subdomain per shop'
kind: case
area: backend
summary: Giving every shop on Moj Vulkanizer its own address, on a free hosting plan, without breaking login.
updated: 2026-11-27
---

**Project:** Moj Vulkanizer, a booking platform for tire shops.

## The problem

Shop owners send their admin link around, so `mojvulkanizer.com/admin/my-shop` should be `my-shop.mojvulkanizer.com`. The platform's own dashboard should live at `platform.mojvulkanizer.com`. All of it on Vercel's free plan, with the domain staying at Namecheap.

## The approach

- **DNS:** a wildcard `*` CNAME pointing at Vercel. Vercel's free plan does support wildcard domains.
- **The certificate was the tricky part.** A wildcard SSL certificate needs a DNS-01 challenge, and Vercel can't answer it while the domain's DNS lives elsewhere. The fix: two NS records that hand only `_acme-challenge` to Vercel's nameservers. Everything else, email forwarding included, stays at Namecheap.
- **Routing:** Next.js middleware rewrites `{shop}.mojvulkanizer.com` to `/admin/{shop}` and `platform.` to `/platforma`. The customer booking page stays on the main domain.
- **Login across subdomains:** Better Auth's cross-subdomain cookies and wildcard trusted origins, so one sign-in works everywhere.

## What broke along the way

- Login redirects lost their place, until the `next` parameter survived the hop between hosts.
- Nav links still contained `/admin/{shop}`, so paths doubled up on the subdomain. Links became host-aware.
- The platform rewrite swallowed the password-reset pages, which now pass straight through.
- Signups can no longer take reserved names like `platform`.

## Result

Every shop has its own address. I checked it in production with `curl`: each subdomain answers with the expected rewrite.
